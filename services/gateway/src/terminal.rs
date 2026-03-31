//! Real interactive terminal via WebSocket + PTY.
//!
//! Spawns a real shell process (`/bin/zsh` or `/bin/bash`) attached to a
//! pseudo-terminal. The frontend connects via WebSocket (xterm.js) and gets
//! a full interactive shell — tab completion, colors, history, everything.

use actix::prelude::*;
use actix_web::{web, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::time::Duration;

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(15);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(60);
const PTY_READ_INTERVAL: Duration = Duration::from_millis(10);

/// WebSocket handler — upgrades HTTP to WS and spawns the PTY session.
pub async fn ws_terminal(req: HttpRequest, stream: web::Payload) -> Result<HttpResponse, Error> {
    let shell = detect_shell();
    tracing::info!("Starting terminal session with shell: {shell}");
    ws::start(TerminalSession::new(&shell)?, &req, stream)
}

/// Detect the user's preferred shell.
fn detect_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| {
        if std::path::Path::new("/bin/zsh").exists() {
            "/bin/zsh".to_string()
        } else {
            "/bin/bash".to_string()
        }
    })
}

/// Actor that bridges a WebSocket connection to a PTY process.
struct TerminalSession {
    /// PTY writer — sends keystrokes to the shell.
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    /// PTY reader — reads shell output (runs in background).
    reader: Arc<Mutex<Box<dyn Read + Send>>>,
    /// Last heartbeat from client.
    heartbeat: std::time::Instant,
}

impl TerminalSession {
    fn new(shell: &str) -> Result<Self, Error> {
        let pty_system = native_pty_system();

        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| actix_web::error::ErrorInternalServerError(format!("PTY open failed: {e}")))?;

        // Spawn shell process
        let mut cmd = CommandBuilder::new(shell);
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("LANG", "en_US.UTF-8");

        // Set a custom prompt to identify this as cloud-manager terminal
        cmd.env("PS1", "\\[\\033[1;36m\\]cloud-manager\\[\\033[0m\\]:\\[\\033[1;34m\\]\\w\\[\\033[0m\\]$ ");

        pair.slave
            .spawn_command(cmd)
            .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Shell spawn failed: {e}")))?;

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| actix_web::error::ErrorInternalServerError(format!("PTY reader clone failed: {e}")))?;

        let writer = pair.master.take_writer()
            .map_err(|e| actix_web::error::ErrorInternalServerError(format!("PTY writer failed: {e}")))?;

        Ok(Self {
            writer: Arc::new(Mutex::new(writer)),
            reader: Arc::new(Mutex::new(reader)),
            heartbeat: std::time::Instant::now(),
        })
    }

    /// Start heartbeat pings to keep connection alive.
    fn start_heartbeat(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if std::time::Instant::now().duration_since(act.heartbeat) > CLIENT_TIMEOUT {
                tracing::warn!("Terminal WebSocket client timed out, disconnecting");
                ctx.stop();
                return;
            }
            ctx.ping(b"");
        });
    }

    /// Start reading PTY output and pushing to WebSocket.
    fn start_pty_reader(&self, ctx: &mut ws::WebsocketContext<Self>) {
        let reader = Arc::clone(&self.reader);

        ctx.run_interval(PTY_READ_INTERVAL, move |_act, ctx| {
            let mut buf = [0u8; 4096];
            if let Ok(mut reader) = reader.try_lock() {
                // Non-blocking read attempt
                match reader.read(&mut buf) {
                    Ok(0) => {
                        // EOF — shell exited
                        ctx.text("\r\n\x1b[1;31m[Session ended]\x1b[0m\r\n");
                        ctx.stop();
                    }
                    Ok(n) => {
                        // Send raw bytes to xterm.js
                        ctx.binary(bytes::Bytes::copy_from_slice(&buf[..n]));
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        // No data available — normal
                    }
                    Err(_) => {
                        // Read error
                    }
                }
            }
        });
    }
}

impl Actor for TerminalSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.start_heartbeat(ctx);
        self.start_pty_reader(ctx);
        tracing::info!("Terminal WebSocket session started");
    }

    fn stopped(&mut self, _ctx: &mut Self::Context) {
        tracing::info!("Terminal WebSocket session ended");
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for TerminalSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => {
                self.heartbeat = std::time::Instant::now();
                ctx.pong(&msg);
            }
            Ok(ws::Message::Pong(_)) => {
                self.heartbeat = std::time::Instant::now();
            }
            Ok(ws::Message::Text(text)) => {
                // Handle JSON messages from xterm.js
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                    // Resize event: {"type": "resize", "cols": 80, "rows": 24}
                    if parsed.get("type").and_then(|t| t.as_str()) == Some("resize") {
                        // PTY resize would go here with pair.master.resize()
                        return;
                    }
                    // Input event: {"type": "input", "data": "ls\n"}
                    if let Some(data) = parsed.get("data").and_then(|d| d.as_str()) {
                        if let Ok(mut writer) = self.writer.lock() {
                            let _ = writer.write_all(data.as_bytes());
                            let _ = writer.flush();
                        }
                        return;
                    }
                }

                // Raw text input (direct from xterm.js attach addon)
                if let Ok(mut writer) = self.writer.lock() {
                    let _ = writer.write_all(text.as_bytes());
                    let _ = writer.flush();
                }
            }
            Ok(ws::Message::Binary(data)) => {
                // Binary input from xterm.js
                if let Ok(mut writer) = self.writer.lock() {
                    let _ = writer.write_all(&data);
                    let _ = writer.flush();
                }
            }
            Ok(ws::Message::Close(reason)) => {
                tracing::info!("Terminal WebSocket closing: {:?}", reason);
                ctx.stop();
            }
            _ => {}
        }
    }
}

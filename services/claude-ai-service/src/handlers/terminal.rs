use actix::prelude::*;
use actix_web::{web, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;

use crate::anthropic::AnthropicClient;
use crate::models::chat::AnthropicMessage;

/// WebSocket message types for the AI terminal.
#[derive(Debug, serde::Deserialize)]
struct TerminalInput {
    #[serde(rename = "type")]
    msg_type: String,
    content: Option<String>,
}

#[derive(Debug, serde::Serialize)]
struct TerminalOutput {
    #[serde(rename = "type")]
    msg_type: String,
    content: String,
}

/// Actor that manages a WebSocket-based AI terminal session.
pub struct AiTerminalSession {
    client: AnthropicClient,
    history: Vec<AnthropicMessage>,
}

impl AiTerminalSession {
    pub fn new(client: AnthropicClient) -> Self {
        Self {
            client,
            history: Vec::new(),
        }
    }
}

impl Actor for AiTerminalSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        let welcome = TerminalOutput {
            msg_type: "system".to_string(),
            content: "Cloud Manager AI Terminal connected. Type your commands or questions."
                .to_string(),
        };
        if let Ok(json) = serde_json::to_string(&welcome) {
            ctx.text(json);
        }
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for AiTerminalSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => ctx.pong(&msg),
            Ok(ws::Message::Pong(_)) => {}
            Ok(ws::Message::Text(text)) => {
                let input: TerminalInput = match serde_json::from_str(&text) {
                    Ok(input) => input,
                    Err(_) => {
                        // Treat raw text as a command.
                        TerminalInput {
                            msg_type: "command".to_string(),
                            content: Some(text.to_string()),
                        }
                    }
                };

                if let Some(content) = input.content {
                    self.history.push(AnthropicMessage {
                        role: "user".to_string(),
                        content: content.clone(),
                    });

                    let client = self.client.clone();
                    let messages = self.history.clone();

                    let fut = async move {
                        let system = "You are an AI-powered cloud terminal assistant. \
                            Help users with cloud CLI commands, infrastructure queries, \
                            and troubleshooting. Provide concise, terminal-friendly responses.";

                        client.send_message(messages, system, Some(1024)).await
                    };

                    let fut = actix::fut::wrap_future::<_, Self>(fut);
                    ctx.spawn(fut.map(|result, actor, ctx| match result {
                        Ok(response) => {
                            actor.history.push(AnthropicMessage {
                                role: "assistant".to_string(),
                                content: response.content.clone(),
                            });
                            let output = TerminalOutput {
                                msg_type: "response".to_string(),
                                content: response.content,
                            };
                            if let Ok(json) = serde_json::to_string(&output) {
                                ctx.text(json);
                            }
                        }
                        Err(e) => {
                            let output = TerminalOutput {
                                msg_type: "error".to_string(),
                                content: format!("Error: {e}"),
                            };
                            if let Ok(json) = serde_json::to_string(&output) {
                                ctx.text(json);
                            }
                        }
                    }));
                }
            }
            Ok(ws::Message::Binary(_)) => {
                tracing::warn!("Binary messages not supported in AI terminal");
            }
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            _ => ctx.stop(),
        }
    }
}

/// WebSocket upgrade handler for /ws/ai/terminal
pub async fn ws_terminal(
    req: HttpRequest,
    stream: web::Payload,
    client: web::Data<AnthropicClient>,
) -> Result<HttpResponse, Error> {
    let session = AiTerminalSession::new(client.get_ref().clone());
    ws::start(session, &req, stream)
}

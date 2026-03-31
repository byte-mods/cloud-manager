use std::sync::Arc;
use std::time::{Duration, Instant};

use actix::prelude::*;
use actix_web::{web, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;
use rand::Rng;
use serde::{Deserialize, Serialize};

use crate::providers::{self, MonitoringContext};

/// How often we push log entries to the client.
const LOG_PUSH_INTERVAL: Duration = Duration::from_secs(2);
/// How often we send WebSocket pings for keep-alive.
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(10);
/// Timeout for client pong responses.
const CLIENT_TIMEOUT: Duration = Duration::from_secs(30);

// ── Wire types ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct ClientMessage {
    subscribe: Option<LogFilter>,
    unsubscribe: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
struct LogFilter {
    level: Option<String>,
    service: Option<String>,
    search: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct LogStreamEntry {
    id: String,
    timestamp: String,
    level: String,
    service: String,
    message: String,
    trace_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct LogStreamMessage {
    #[serde(rename = "type")]
    msg_type: String,
    entries: Vec<LogStreamEntry>,
}

// ── Mock data for realistic log generation ───────────────────────────────

const SERVICES: &[&str] = &[
    "api-gateway",
    "auth-service",
    "user-service",
    "payment-service",
    "notification-service",
    "cache-layer",
    "database-proxy",
    "scheduler",
    "worker-pool",
    "cdn-edge",
];

const ERROR_MESSAGES: &[&str] = &[
    "Connection timeout after 30s to upstream",
    "Failed to parse request body: unexpected EOF",
    "Database connection pool exhausted (max=100)",
    "TLS handshake failed: certificate expired",
    "Out of memory: container killed by OOM killer",
    "Rate limit exceeded for client 10.0.3.42",
    "Deadlock detected on table orders",
    "Disk usage critical: 98% on /var/data",
];

const WARN_MESSAGES: &[&str] = &[
    "Slow query detected: 1.2s on SELECT * FROM events",
    "Retry attempt 3/5 for upstream call",
    "Memory usage above 80% threshold",
    "Connection pool nearing capacity (85/100)",
    "Deprecated API version v1 called by client dashboard-app",
    "Certificate expires in 7 days",
    "Response time degraded: p99 = 850ms",
    "Cache eviction rate elevated: 120 keys/s",
];

const INFO_MESSAGES: &[&str] = &[
    "Incoming request GET /api/v1/health",
    "Request completed 200 OK in 2ms",
    "Token refresh for client dashboard-app",
    "Scheduled job cron-cleanup started",
    "New WebSocket connection from 10.0.1.15",
    "User login successful: user_42@example.com",
    "Deployment v2.4.1 rolled out to 3/3 pods",
    "Config reload completed successfully",
    "Health check passed for all dependencies",
    "Batch processing completed: 1500 records in 3.2s",
];

const DEBUG_MESSAGES: &[&str] = &[
    "Cache hit for key session:user_42",
    "SQL query plan: Index Scan on users_pkey",
    "JWT token validated, exp=1711800000",
    "gRPC channel rebalanced to 3 backends",
    "Request context: trace_id=abc123, span_id=def456",
    "Serialized response payload: 2.4KB",
    "Connection keep-alive extended for client 10.0.2.8",
    "Feature flag dark-mode-v2 evaluated: true",
];

// ── Actor ────────────────────────────────────────────────────────────────

pub struct LogStreamWsSession {
    last_heartbeat: Instant,
    filter: Option<LogFilter>,
    /// Retained for future use with real cloud SDK providers.
    ctx: Arc<MonitoringContext>,
}

impl LogStreamWsSession {
    pub fn new(ctx: Arc<MonitoringContext>) -> Self {
        Self {
            last_heartbeat: Instant::now(),
            filter: None,
            ctx,
        }
    }

    fn start_heartbeat(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if Instant::now().duration_since(act.last_heartbeat) > CLIENT_TIMEOUT {
                tracing::info!("Log stream WebSocket client timed out, disconnecting");
                ctx.stop();
                return;
            }
            ctx.ping(b"");
        });
    }

    fn start_log_push(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(LOG_PUSH_INTERVAL, |act, ctx| {
            act.push_logs(ctx);
        });
    }

    fn push_logs(&self, ctx: &mut ws::WebsocketContext<Self>) {
        // Only push if a subscription filter is active
        let filter = match &self.filter {
            Some(f) => f,
            None => return,
        };

        // Try real provider first
        if let Some(_provider) = providers::get_logs_provider(&self.ctx) {
            // In real mode we would query CloudWatch here and push results.
            // For now, fall through to mock generation so the endpoint works
            // regardless of cloud credentials.
        }

        // Generate mock log entries
        let entries = generate_mock_entries(filter);

        let msg = LogStreamMessage {
            msg_type: "log_entries".to_string(),
            entries,
        };

        if let Ok(json) = serde_json::to_string(&msg) {
            ctx.text(json);
        }
    }
}

fn generate_mock_entries(filter: &LogFilter) -> Vec<LogStreamEntry> {
    let mut rng = rand::thread_rng();
    let count = rng.gen_range(1..=5);
    let mut entries = Vec::with_capacity(count);

    for _ in 0..count {
        let level = pick_level(&mut rng, filter.level.as_deref());
        let service = pick_service(&mut rng, filter.service.as_deref());
        let message = pick_message(&mut rng, &level);

        // Apply search filter
        if let Some(ref search) = filter.search {
            if !search.is_empty()
                && !message.to_lowercase().contains(&search.to_lowercase())
                && !service.to_lowercase().contains(&search.to_lowercase())
            {
                continue;
            }
        }

        let trace_id = if rng.gen_bool(0.3) {
            Some(format!(
                "{:08x}{:08x}{:08x}{:04x}",
                rng.gen::<u32>(),
                rng.gen::<u32>(),
                rng.gen::<u32>(),
                rng.gen::<u16>()
            ))
        } else {
            None
        };

        entries.push(LogStreamEntry {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            level,
            service,
            message,
            trace_id,
        });
    }

    entries
}

fn pick_level(rng: &mut impl Rng, filter_level: Option<&str>) -> String {
    if let Some(level) = filter_level {
        if level != "all" {
            return level.to_lowercase();
        }
    }
    // Weighted random: info most common, error least common
    let roll: f64 = rng.gen();
    if roll < 0.05 {
        "error".to_string()
    } else if roll < 0.15 {
        "warn".to_string()
    } else if roll < 0.80 {
        "info".to_string()
    } else {
        "debug".to_string()
    }
}

fn pick_service(rng: &mut impl Rng, filter_service: Option<&str>) -> String {
    if let Some(service) = filter_service {
        if !service.is_empty() && service != "all" {
            return service.to_string();
        }
    }
    SERVICES[rng.gen_range(0..SERVICES.len())].to_string()
}

fn pick_message(rng: &mut impl Rng, level: &str) -> String {
    let pool = match level {
        "error" => ERROR_MESSAGES,
        "warn" => WARN_MESSAGES,
        "debug" => DEBUG_MESSAGES,
        _ => INFO_MESSAGES,
    };
    pool[rng.gen_range(0..pool.len())].to_string()
}

impl Actor for LogStreamWsSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.start_heartbeat(ctx);
        self.start_log_push(ctx);
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for LogStreamWsSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(data)) => {
                self.last_heartbeat = Instant::now();
                ctx.pong(&data);
            }
            Ok(ws::Message::Pong(_)) => {
                self.last_heartbeat = Instant::now();
            }
            Ok(ws::Message::Text(text)) => {
                self.last_heartbeat = Instant::now();

                match serde_json::from_str::<ClientMessage>(&text) {
                    Ok(msg) => {
                        if let Some(filter) = msg.subscribe {
                            self.filter = Some(filter.clone());
                            tracing::debug!(filter = ?self.filter, "Log stream subscription updated");

                            let ack = serde_json::json!({
                                "type": "subscription_update",
                                "filter": filter,
                            });
                            if let Ok(json) = serde_json::to_string(&ack) {
                                ctx.text(json);
                            }
                        }
                        if msg.unsubscribe == Some(true) {
                            self.filter = None;
                            tracing::debug!("Log stream subscription cleared");

                            let ack = serde_json::json!({
                                "type": "unsubscribed",
                            });
                            if let Ok(json) = serde_json::to_string(&ack) {
                                ctx.text(json);
                            }
                        }
                    }
                    Err(_) => {
                        let err = serde_json::json!({
                            "type": "error",
                            "message": "Invalid message format. Expected: {\"subscribe\": {\"level\": \"error\", \"service\": \"api-gateway\", \"search\": \"timeout\"}} or {\"unsubscribe\": true}",
                        });
                        if let Ok(json) = serde_json::to_string(&err) {
                            ctx.text(json);
                        }
                    }
                }
            }
            Ok(ws::Message::Binary(_)) => {
                tracing::warn!("Binary messages not supported on log stream WebSocket");
            }
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            _ => ctx.stop(),
        }
    }
}

// ── HTTP handler ─────────────────────────────────────────────────────────

pub async fn ws_log_stream(
    req: HttpRequest,
    stream: web::Payload,
    monitoring_ctx: web::Data<Arc<MonitoringContext>>,
) -> Result<HttpResponse, Error> {
    let session = LogStreamWsSession::new(monitoring_ctx.get_ref().clone());
    ws::start(session, &req, stream)
}

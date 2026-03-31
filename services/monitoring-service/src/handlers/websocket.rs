use std::collections::HashSet;
use std::sync::Arc;
use std::time::{Duration, Instant};

use actix::prelude::*;
use actix_web::{web, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;
use rand::Rng;
use serde::{Deserialize, Serialize};

use crate::providers::MonitoringContext;

/// How often we push metric snapshots to the client.
const METRIC_INTERVAL: Duration = Duration::from_secs(5);
/// How often we send WebSocket pings for keep-alive.
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(10);
/// Timeout for client pong responses.
const CLIENT_TIMEOUT: Duration = Duration::from_secs(30);

// ── Wire types ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct ClientMessage {
    subscribe: Option<Vec<String>>,
    unsubscribe: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MetricSnapshot {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub timestamp: String,
    pub metrics: Vec<LiveMetric>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LiveMetric {
    pub name: String,
    pub display_name: String,
    pub value: f64,
    pub unit: String,
}

// ── Simulated state for smooth value transitions ─────────────────────────

struct SimulatedValues {
    cpu: f64,
    memory: f64,
    disk: f64,
    network_in: f64,
    network_out: f64,
    request_rate: f64,
    error_rate: f64,
}

impl Default for SimulatedValues {
    fn default() -> Self {
        Self {
            cpu: 45.0,
            memory: 62.0,
            disk: 55.0,
            network_in: 120.0,
            network_out: 80.0,
            request_rate: 1200.0,
            error_rate: 0.8,
        }
    }
}

impl SimulatedValues {
    /// Advance all values by a small random walk to produce smooth transitions.
    fn step(&mut self) {
        let mut rng = rand::thread_rng();

        self.cpu = clamp(self.cpu + rng.gen_range(-3.0..3.0), 5.0, 98.0);
        self.memory = clamp(self.memory + rng.gen_range(-1.5..1.5), 20.0, 95.0);
        self.disk = clamp(self.disk + rng.gen_range(-0.5..0.5), 10.0, 95.0);
        self.network_in = clamp(self.network_in + rng.gen_range(-15.0..15.0), 10.0, 500.0);
        self.network_out = clamp(self.network_out + rng.gen_range(-10.0..10.0), 5.0, 300.0);
        self.request_rate = clamp(self.request_rate + rng.gen_range(-80.0..80.0), 200.0, 5000.0);
        self.error_rate = clamp(self.error_rate + rng.gen_range(-0.3..0.3), 0.0, 10.0);
    }

    fn all_metrics(&self) -> Vec<LiveMetric> {
        vec![
            LiveMetric {
                name: "cpu".into(),
                display_name: "CPU Usage".into(),
                value: round2(self.cpu),
                unit: "%".into(),
            },
            LiveMetric {
                name: "memory".into(),
                display_name: "Memory Usage".into(),
                value: round2(self.memory),
                unit: "%".into(),
            },
            LiveMetric {
                name: "disk".into(),
                display_name: "Disk Usage".into(),
                value: round2(self.disk),
                unit: "%".into(),
            },
            LiveMetric {
                name: "network_in".into(),
                display_name: "Network In".into(),
                value: round2(self.network_in),
                unit: "Mbps".into(),
            },
            LiveMetric {
                name: "network_out".into(),
                display_name: "Network Out".into(),
                value: round2(self.network_out),
                unit: "Mbps".into(),
            },
            LiveMetric {
                name: "request_rate".into(),
                display_name: "Request Rate".into(),
                value: round2(self.request_rate),
                unit: "req/s".into(),
            },
            LiveMetric {
                name: "error_rate".into(),
                display_name: "Error Rate".into(),
                value: round2(self.error_rate),
                unit: "%".into(),
            },
        ]
    }
}

fn clamp(v: f64, min: f64, max: f64) -> f64 {
    v.max(min).min(max)
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

// ── Actor ────────────────────────────────────────────────────────────────

pub struct MetricsWsSession {
    last_heartbeat: Instant,
    /// Which metric names the client wants. Empty = all.
    subscriptions: HashSet<String>,
    simulated: SimulatedValues,
    /// Retained for future use with real cloud SDK providers.
    #[allow(dead_code)]
    ctx: Arc<MonitoringContext>,
}

impl MetricsWsSession {
    pub fn new(ctx: Arc<MonitoringContext>) -> Self {
        Self {
            last_heartbeat: Instant::now(),
            subscriptions: HashSet::new(),
            simulated: SimulatedValues::default(),
            ctx,
        }
    }

    fn start_heartbeat(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if Instant::now().duration_since(act.last_heartbeat) > CLIENT_TIMEOUT {
                tracing::info!("WebSocket client timed out, disconnecting");
                ctx.stop();
                return;
            }
            ctx.ping(b"");
        });
    }

    fn start_metric_push(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(METRIC_INTERVAL, |act, ctx| {
            act.push_metrics(ctx);
        });
    }

    fn push_metrics(&mut self, ctx: &mut ws::WebsocketContext<Self>) {
        // Advance simulated values
        self.simulated.step();

        let all = self.simulated.all_metrics();

        let metrics = if self.subscriptions.is_empty() {
            all
        } else {
            all.into_iter()
                .filter(|m| self.subscriptions.contains(&m.name))
                .collect()
        };

        let snapshot = MetricSnapshot {
            msg_type: "metrics".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            metrics,
        };

        if let Ok(json) = serde_json::to_string(&snapshot) {
            ctx.text(json);
        }
    }
}

impl Actor for MetricsWsSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.start_heartbeat(ctx);
        self.start_metric_push(ctx);

        // Send an initial snapshot immediately
        self.push_metrics(ctx);
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for MetricsWsSession {
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
                        if let Some(topics) = msg.subscribe {
                            for t in topics {
                                self.subscriptions.insert(t);
                            }
                            tracing::debug!(subs = ?self.subscriptions, "Updated subscriptions");
                        }
                        if let Some(topics) = msg.unsubscribe {
                            for t in &topics {
                                self.subscriptions.remove(t);
                            }
                            tracing::debug!(subs = ?self.subscriptions, "Updated subscriptions");
                        }

                        // Acknowledge
                        let ack = serde_json::json!({
                            "type": "subscription_update",
                            "subscriptions": self.subscriptions.iter().collect::<Vec<_>>(),
                        });
                        if let Ok(json) = serde_json::to_string(&ack) {
                            ctx.text(json);
                        }
                    }
                    Err(_) => {
                        let err = serde_json::json!({
                            "type": "error",
                            "message": "Invalid message format. Expected: {\"subscribe\": [...]} or {\"unsubscribe\": [...]}",
                        });
                        if let Ok(json) = serde_json::to_string(&err) {
                            ctx.text(json);
                        }
                    }
                }
            }
            Ok(ws::Message::Binary(_)) => {
                tracing::warn!("Binary messages not supported on metrics WebSocket");
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

pub async fn ws_metrics(
    req: HttpRequest,
    stream: web::Payload,
    monitoring_ctx: web::Data<Arc<MonitoringContext>>,
) -> Result<HttpResponse, Error> {
    let session = MetricsWsSession::new(monitoring_ctx.get_ref().clone());
    ws::start(session, &req, stream)
}

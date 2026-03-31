use std::sync::Arc;

use actix_web::{web, HttpResponse};
use serde::Deserialize;

use crate::models::monitoring::LogEntry;
use crate::providers::{self, MonitoringContext};

#[derive(Debug, Deserialize)]
pub struct LogQuery {
    pub level: Option<String>,
    pub service: Option<String>,
    pub search: Option<String>,
    pub limit: Option<usize>,
}

pub async fn query_logs(
    ctx: web::Data<Arc<MonitoringContext>>,
    db: web::Data<cloud_common::Database>,
    query: web::Query<LogQuery>,
) -> HttpResponse {
    let limit = query.limit.unwrap_or(50);

    // Try real provider first
    if let Some(provider) = providers::get_logs_provider(&ctx) {
        let log_group = query.service.as_deref();
        let filter = query.search.as_deref();
        match provider.query_logs(log_group, filter, limit).await {
            Ok(entries) => {
                // Apply level filter on the results if requested
                let filtered: Vec<_> = if let Some(ref level) = query.level {
                    entries
                        .into_iter()
                        .filter(|l| {
                            let log_level = format!("{:?}", l.level).to_lowercase();
                            log_level == level.to_lowercase()
                        })
                        .collect()
                } else {
                    entries
                };
                return HttpResponse::Ok().json(serde_json::json!({
                    "logs": filtered,
                    "total": filtered.len(),
                }));
            }
            Err(e) => {
                tracing::warn!("Real logs provider failed, falling back to DB: {e}");
            }
        }
    }

    // Fallback to SurrealDB
    let logs: Vec<LogEntry> = db.list("logs").await.unwrap_or_default();

    let filtered: Vec<_> = logs
        .iter()
        .filter(|l| {
            if let Some(ref level) = query.level {
                let log_level = format!("{:?}", l.level).to_lowercase();
                if log_level != level.to_lowercase() {
                    return false;
                }
            }
            if let Some(ref service) = query.service {
                if !l.service.contains(service.as_str()) {
                    return false;
                }
            }
            if let Some(ref search) = query.search {
                if !l.message.to_lowercase().contains(&search.to_lowercase()) {
                    return false;
                }
            }
            true
        })
        .take(limit)
        .cloned()
        .collect();

    HttpResponse::Ok().json(serde_json::json!({
        "logs": filtered,
        "total": filtered.len(),
    }))
}

pub async fn stream_logs() -> HttpResponse {
    // Simulate SSE log stream with a few events
    let events = vec![
        r#"data: {"timestamp":"2026-03-30T10:30:00Z","level":"info","service":"api-gateway","message":"Incoming request GET /api/v1/health"}"#,
        r#"data: {"timestamp":"2026-03-30T10:30:01Z","level":"info","service":"api-gateway","message":"Request completed 200 OK in 2ms"}"#,
        r#"data: {"timestamp":"2026-03-30T10:30:02Z","level":"debug","service":"cache-layer","message":"Cache hit for key session:user_42"}"#,
        r#"data: {"timestamp":"2026-03-30T10:30:03Z","level":"warn","service":"database-proxy","message":"Slow query detected: 1.2s on SELECT * FROM events"}"#,
        r#"data: {"timestamp":"2026-03-30T10:30:05Z","level":"info","service":"auth-service","message":"Token refresh for client dashboard-app"}"#,
    ];

    let body = events.join("\n\n") + "\n\n";

    HttpResponse::Ok()
        .content_type("text/event-stream")
        .insert_header(("Cache-Control", "no-cache"))
        .insert_header(("Connection", "keep-alive"))
        .body(body)
}

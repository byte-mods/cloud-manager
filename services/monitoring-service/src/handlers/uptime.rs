use actix_web::{web, HttpResponse};
use chrono::{Duration, Utc};
use uuid::Uuid;

use crate::models::monitoring::{ServiceHealth, ServiceHealthDetail, UptimeHistoryEntry};

pub async fn list_services(db: web::Data<cloud_common::Database>) -> HttpResponse {
    let services: Vec<ServiceHealth> = db.list("services").await.unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({ "services": services }))
}

pub async fn get_service_health(
    db: web::Data<cloud_common::Database>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let service_id = path.into_inner();

    let service: Option<ServiceHealth> = db
        .get("services", &service_id.to_string())
        .await
        .unwrap_or(None);

    match service {
        Some(service) => {
            let now = Utc::now();
            // Generate 24h of health check history at 5-minute intervals
            let history: Vec<UptimeHistoryEntry> = (0..288)
                .map(|i| {
                    let ts = now - Duration::minutes((287 - i) * 5);
                    // Simulate occasional degraded checks based on uptime percentage
                    let failure_rate = (100.0 - service.uptime_pct) / 100.0;
                    let is_down = ((i * 7 + 13) % 1000) as f64 / 1000.0 < failure_rate;
                    let (status, response_ms) = if is_down {
                        ("down".to_string(), 0u64)
                    } else {
                        let jitter = ((i * 31 + 17) % 40) as u64;
                        ("healthy".to_string(), service.avg_response_ms + jitter.saturating_sub(20))
                    };
                    UptimeHistoryEntry {
                        timestamp: ts,
                        status,
                        response_ms,
                    }
                })
                .collect();

            HttpResponse::Ok().json(ServiceHealthDetail {
                service,
                history,
            })
        }
        None => HttpResponse::NotFound().json(serde_json::json!({
            "error": "not_found",
            "message": format!("Service '{}' not found", service_id),
        })),
    }
}

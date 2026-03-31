use actix_web::{web, HttpResponse};

use crate::models::monitoring::{Alert, AlertStatus, AlertSeverity, MonitoringOverview, ServiceHealth};

pub async fn get_overview(db: web::Data<cloud_common::Database>) -> HttpResponse {
    let alerts: Vec<Alert> = db.list("alerts").await.unwrap_or_default();
    let services: Vec<ServiceHealth> = db.list("services").await.unwrap_or_default();

    let active_alerts = alerts.iter().filter(|a| a.status == AlertStatus::Firing).count() as u32;
    let critical_alerts = alerts
        .iter()
        .filter(|a| a.status == AlertStatus::Firing && a.severity == AlertSeverity::Critical)
        .count() as u32;

    let total = services.len() as u32;
    let healthy = services.iter().filter(|s| s.status == "healthy").count() as u32;
    let avg_uptime = if services.is_empty() {
        0.0
    } else {
        services.iter().map(|s| s.uptime_pct).sum::<f64>() / services.len() as f64
    };
    let avg_response = if services.is_empty() {
        0
    } else {
        services.iter().map(|s| s.avg_response_ms).sum::<u64>() / services.len() as u64
    };

    HttpResponse::Ok().json(MonitoringOverview {
        total_services: total,
        healthy_services: healthy,
        active_alerts,
        critical_alerts,
        avg_uptime_pct: (avg_uptime * 100.0).round() / 100.0,
        avg_response_ms: avg_response,
        error_rate_pct: 0.2,
        total_requests_24h: 1_450_000,
    })
}

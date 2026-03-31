use std::sync::Arc;

use actix_web::{web, HttpResponse};
use chrono::Utc;
use uuid::Uuid;

use crate::models::monitoring::{Alert, AlertStatus, CreateAlertRequest};
use crate::providers::{self, MonitoringContext};

pub async fn list_alerts(
    ctx: web::Data<Arc<MonitoringContext>>,
    db: web::Data<cloud_common::Database>,
) -> HttpResponse {
    // Try real provider first
    if let Some(provider) = providers::get_alerts_provider(&ctx) {
        match provider.list_alerts().await {
            Ok(alerts) => {
                return HttpResponse::Ok().json(serde_json::json!({ "alerts": alerts }));
            }
            Err(e) => {
                tracing::warn!("Real alerts provider failed, falling back to DB: {e}");
            }
        }
    }

    // Fallback to SurrealDB
    let alerts: Vec<Alert> = db.list("alerts").await.unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({ "alerts": alerts }))
}

pub async fn create_alert(
    db: web::Data<cloud_common::Database>,
    body: web::Json<CreateAlertRequest>,
) -> HttpResponse {
    let id = Uuid::new_v4();
    let alert = Alert {
        id,
        name: body.name.clone(),
        severity: body.severity.clone(),
        status: AlertStatus::Firing,
        message: body.message.clone(),
        source: body.source.clone(),
        created_at: Utc::now(),
        acknowledged_at: None,
        resolved_at: None,
    };

    let _: Option<Alert> = db
        .create_with_id("alerts", &id.to_string(), alert.clone())
        .await
        .unwrap_or(None);

    HttpResponse::Created().json(alert)
}

pub async fn acknowledge_alert(
    db: web::Data<cloud_common::Database>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let alert_id = path.into_inner();

    let existing: Option<Alert> = db
        .get("alerts", &alert_id.to_string())
        .await
        .unwrap_or(None);

    match existing {
        Some(mut alert) => {
            alert.status = AlertStatus::Acknowledged;
            alert.acknowledged_at = Some(Utc::now());
            let _: Option<Alert> = db
                .update("alerts", &alert_id.to_string(), alert.clone())
                .await
                .unwrap_or(None);
            HttpResponse::Ok().json(alert)
        }
        None => HttpResponse::NotFound().json(serde_json::json!({
            "error": "not_found",
            "message": format!("Alert '{}' not found", alert_id),
        })),
    }
}

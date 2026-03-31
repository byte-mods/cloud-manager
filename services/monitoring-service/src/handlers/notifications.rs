use actix_web::{web, HttpResponse};
use chrono::Utc;
use uuid::Uuid;

use crate::error::MonitoringError;
use crate::models::monitoring::{
    CreateNotificationChannelRequest, NotificationChannel,
};

/// POST /api/v1/monitoring/notifications/channels
pub async fn add_channel(
    db: web::Data<cloud_common::Database>,
    body: web::Json<CreateNotificationChannelRequest>,
) -> Result<HttpResponse, MonitoringError> {
    let id = Uuid::new_v4();
    let channel = NotificationChannel {
        id,
        name: body.name.clone(),
        channel_type: body.channel_type.clone(),
        webhook_url: body.webhook_url.clone(),
        enabled: true,
        created_at: Utc::now(),
    };

    let _: Option<NotificationChannel> = db
        .create_with_id("notification_channels", &id.to_string(), channel.clone())
        .await
        .unwrap_or(None);

    Ok(HttpResponse::Created().json(channel))
}

/// GET /api/v1/monitoring/notifications/channels
pub async fn list_channels(
    db: web::Data<cloud_common::Database>,
) -> Result<HttpResponse, MonitoringError> {
    let channels: Vec<NotificationChannel> = db
        .list("notification_channels")
        .await
        .unwrap_or_default();

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "channels": channels,
        "total": channels.len(),
    })))
}

/// DELETE /api/v1/monitoring/notifications/channels/{id}
pub async fn remove_channel(
    db: web::Data<cloud_common::Database>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse, MonitoringError> {
    let channel_id = path.into_inner();

    // Check if the channel exists first
    let existing: Option<NotificationChannel> = db
        .get("notification_channels", &channel_id.to_string())
        .await
        .unwrap_or(None);

    if existing.is_some() {
        db.delete("notification_channels", &channel_id.to_string())
            .await
            .ok();
        Ok(HttpResponse::NoContent().finish())
    } else {
        Err(MonitoringError::NotFound(format!(
            "Notification channel '{}' not found",
            channel_id
        )))
    }
}

/// POST /api/v1/monitoring/notifications/test/{id}
pub async fn test_channel(
    db: web::Data<cloud_common::Database>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse, MonitoringError> {
    let channel_id = path.into_inner();

    let channel: Option<NotificationChannel> = db
        .get("notification_channels", &channel_id.to_string())
        .await
        .unwrap_or(None);

    let channel = channel.ok_or_else(|| {
        MonitoringError::NotFound(format!("Notification channel '{}' not found", channel_id))
    })?;

    let client = reqwest::Client::new();
    let test_payload = serde_json::json!({
        "text": format!("[Cloud Manager Test] This is a test notification for channel '{}'", channel.name),
        "channel_type": channel.channel_type,
        "timestamp": Utc::now().to_rfc3339(),
    });

    match client.post(&channel.webhook_url).json(&test_payload).send().await {
        Ok(resp) => {
            let status = resp.status();
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "status": "sent",
                "channel_id": channel.id,
                "channel_name": channel.name,
                "webhook_status": status.as_u16(),
            })))
        }
        Err(e) => {
            tracing::warn!(
                channel_id = %channel.id,
                error = %e,
                "Failed to send test notification"
            );
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "status": "failed",
                "channel_id": channel.id,
                "channel_name": channel.name,
                "error": e.to_string(),
            })))
        }
    }
}

/// Send a notification to all enabled channels. Called internally when alerts fire.
pub async fn send_to_all_channels(
    db: &cloud_common::Database,
    message: &str,
    severity: &str,
    source: &str,
) {
    let channels: Vec<NotificationChannel> = db
        .list("notification_channels")
        .await
        .unwrap_or_default();

    let enabled_channels: Vec<&NotificationChannel> =
        channels.iter().filter(|c| c.enabled).collect();

    if enabled_channels.is_empty() {
        return;
    }

    let client = reqwest::Client::new();
    let payload = serde_json::json!({
        "text": message,
        "severity": severity,
        "source": source,
        "timestamp": Utc::now().to_rfc3339(),
    });

    for channel in &enabled_channels {
        match client.post(&channel.webhook_url).json(&payload).send().await {
            Ok(_) => {
                tracing::info!(channel = %channel.name, "Notification sent successfully");
            }
            Err(e) => {
                tracing::warn!(channel = %channel.name, error = %e, "Failed to send notification");
            }
        }
    }
}

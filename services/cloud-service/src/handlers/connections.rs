use actix_web::{web, HttpResponse};
use cloud_common::Database;

/// GET /api/v1/cloud/connections
pub async fn list_connections(db: web::Data<Database>) -> HttpResponse {
    let connections: Vec<serde_json::Value> = db.list("cloud_connections").await.unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "connections": connections,
        "total": connections.len(),
    }))
}

/// POST /api/v1/cloud/connections/{provider}/connect
pub async fn connect_provider(
    db: web::Data<Database>,
    path: web::Path<String>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let provider = path.into_inner();
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let mut data = body.into_inner();

    if let Some(obj) = data.as_object_mut() {
        obj.insert("id".into(), serde_json::json!(id));
        obj.insert("provider".into(), serde_json::json!(provider));
        obj.insert("status".into(), serde_json::json!("connected"));
        obj.insert("connected_at".into(), serde_json::json!(now));
        obj.insert("last_synced".into(), serde_json::json!(now));
    }

    match db.create_with_id::<serde_json::Value>("cloud_connections", &id, data).await {
        Ok(_) => HttpResponse::Created().json(serde_json::json!({
            "id": id,
            "provider": provider,
            "status": "connected",
            "message": "Cloud provider connected",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// POST /api/v1/cloud/connections/{provider}/disconnect
pub async fn disconnect_provider(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let provider = path.into_inner();

    // Find connections for this provider and remove them
    let connections: Vec<serde_json::Value> = db
        .list_filtered("cloud_connections", &format!("provider = '{provider}'"))
        .await
        .unwrap_or_default();

    for conn in &connections {
        if let Some(id) = conn.get("id").and_then(|v| v.as_str()) {
            let _ = db.delete("cloud_connections", id).await;
        }
    }

    HttpResponse::Ok().json(serde_json::json!({
        "provider": provider,
        "status": "disconnected",
        "removed": connections.len(),
    }))
}

/// GET /api/v1/cloud/connections/{provider}/services
pub async fn list_provider_services(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let provider = path.into_inner();
    let services: Vec<serde_json::Value> = db
        .list_filtered("cloud_connections", &format!("provider = '{provider}'"))
        .await
        .unwrap_or_default();

    HttpResponse::Ok().json(serde_json::json!({
        "provider": provider,
        "services": services,
        "total": services.len(),
    }))
}

/// POST /api/v1/cloud/connections/{provider}/sync
pub async fn sync_provider(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let provider = path.into_inner();
    let now = chrono::Utc::now().to_rfc3339();

    // Update last_synced on all connections for this provider
    let connections: Vec<serde_json::Value> = db
        .list_filtered("cloud_connections", &format!("provider = '{provider}'"))
        .await
        .unwrap_or_default();

    for conn in &connections {
        if let Some(id) = conn.get("id").and_then(|v| v.as_str()) {
            let mut updated = conn.clone();
            if let Some(obj) = updated.as_object_mut() {
                obj.insert("last_synced".into(), serde_json::json!(now));
            }
            let _ = db.update::<serde_json::Value>("cloud_connections", id, updated).await;
        }
    }

    HttpResponse::Ok().json(serde_json::json!({
        "provider": provider,
        "status": "synced",
        "synced_at": now,
        "connections_updated": connections.len(),
    }))
}

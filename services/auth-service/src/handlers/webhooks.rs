use actix_web::{web, HttpResponse};
use cloud_common::Database;

/// GET /webhooks
pub async fn list_webhooks(db: web::Data<Database>) -> HttpResponse {
    match db.list::<serde_json::Value>("webhooks").await {
        Ok(items) => HttpResponse::Ok().json(serde_json::json!({
            "webhooks": items,
            "total": items.len(),
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// POST /webhooks
pub async fn create_webhook(
    db: web::Data<Database>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let secret = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let mut data = body.into_inner();

    if let Some(obj) = data.as_object_mut() {
        obj.insert("id".into(), serde_json::json!(id));
        obj.insert("secret".into(), serde_json::json!(secret));
        obj.insert("active".into(), serde_json::json!(true));
        obj.insert("created_at".into(), serde_json::json!(now));
    }

    match db.create_with_id::<serde_json::Value>("webhooks", &id, data).await {
        Ok(_) => HttpResponse::Created().json(serde_json::json!({
            "id": id,
            "secret": secret,
            "message": "Webhook created",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// DELETE /webhooks/{id}
pub async fn delete_webhook(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.delete("webhooks", &id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Webhook deleted",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

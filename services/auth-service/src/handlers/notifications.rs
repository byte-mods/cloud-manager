use actix_web::{web, HttpResponse};
use cloud_common::Database;

/// GET /notifications
pub async fn list_notifications(db: web::Data<Database>) -> HttpResponse {
    match db.list::<serde_json::Value>("notifications").await {
        Ok(items) => HttpResponse::Ok().json(serde_json::json!({
            "notifications": items,
            "total": items.len(),
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// POST /notifications
pub async fn create_notification(
    db: web::Data<Database>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let mut data = body.into_inner();

    if let Some(obj) = data.as_object_mut() {
        obj.insert("id".into(), serde_json::json!(id));
        obj.insert("read".into(), serde_json::json!(false));
        obj.insert("created_at".into(), serde_json::json!(now));
    }

    match db.create_with_id::<serde_json::Value>("notifications", &id, data).await {
        Ok(_) => HttpResponse::Created().json(serde_json::json!({
            "id": id,
            "message": "Notification created",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// PUT /notifications/{id}/read
pub async fn mark_read(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();

    // Fetch existing notification, merge read=true
    let existing: Result<Option<serde_json::Value>, _> = db.get("notifications", &id).await;
    match existing {
        Ok(Some(mut record)) => {
            if let Some(obj) = record.as_object_mut() {
                obj.insert("read".into(), serde_json::json!(true));
                obj.insert("read_at".into(), serde_json::json!(chrono::Utc::now().to_rfc3339()));
            }
            match db.update::<serde_json::Value>("notifications", &id, record).await {
                Ok(_) => HttpResponse::Ok().json(serde_json::json!({
                    "message": "Notification marked as read",
                })),
                Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": e.to_string(),
                })),
            }
        }
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Notification not found",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

use actix_web::{web, HttpResponse};
use cloud_common::Database;

/// GET /api/v1/monitoring/incidents
pub async fn list_incidents(db: web::Data<Database>) -> HttpResponse {
    match db.list::<serde_json::Value>("incidents").await {
        Ok(items) => {
            let total = items.len();
            HttpResponse::Ok().json(serde_json::json!({ "items": items, "total": total }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e })),
    }
}

/// POST /api/v1/monitoring/incidents
pub async fn create_incident(
    db: web::Data<Database>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let mut data = body.into_inner();
    data["id"] = serde_json::json!(uuid::Uuid::new_v4().to_string());
    data["created_at"] = serde_json::json!(chrono::Utc::now().to_rfc3339());
    data["status"] = serde_json::json!(data.get("status").and_then(|v| v.as_str()).unwrap_or("open"));
    match db.create::<serde_json::Value>("incidents", data).await {
        Ok(Some(item)) => HttpResponse::Created().json(item),
        _ => HttpResponse::InternalServerError()
            .json(serde_json::json!({ "error": "Create failed" })),
    }
}

/// GET /api/v1/monitoring/incidents/{id}
pub async fn get_incident(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.get::<serde_json::Value>("incidents", &id).await {
        Ok(Some(item)) => HttpResponse::Ok().json(item),
        Ok(None) => HttpResponse::NotFound()
            .json(serde_json::json!({ "error": format!("Incident {id} not found") })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e })),
    }
}

/// PUT /api/v1/monitoring/incidents/{id}
pub async fn update_incident(
    db: web::Data<Database>,
    path: web::Path<String>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = path.into_inner();
    let mut data = body.into_inner();
    data["updated_at"] = serde_json::json!(chrono::Utc::now().to_rfc3339());
    match db.update::<serde_json::Value>("incidents", &id, data).await {
        Ok(Some(item)) => HttpResponse::Ok().json(item),
        Ok(None) => HttpResponse::NotFound()
            .json(serde_json::json!({ "error": format!("Incident {id} not found") })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e })),
    }
}

/// DELETE /api/v1/monitoring/incidents/{id}
pub async fn delete_incident(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.delete("incidents", &id).await {
        Ok(()) => HttpResponse::NoContent().finish(),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e })),
    }
}

use actix_web::{web, HttpResponse};
use cloud_common::Database;

/// GET /api/v1/monitoring/sla
pub async fn list_sla_targets(db: web::Data<Database>) -> HttpResponse {
    match db.list::<serde_json::Value>("sla_targets").await {
        Ok(items) => {
            let total = items.len();
            HttpResponse::Ok().json(serde_json::json!({ "items": items, "total": total }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e })),
    }
}

/// POST /api/v1/monitoring/sla
pub async fn create_sla_target(
    db: web::Data<Database>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let mut data = body.into_inner();
    data["id"] = serde_json::json!(uuid::Uuid::new_v4().to_string());
    data["created_at"] = serde_json::json!(chrono::Utc::now().to_rfc3339());
    match db.create::<serde_json::Value>("sla_targets", data).await {
        Ok(Some(item)) => HttpResponse::Created().json(item),
        _ => HttpResponse::InternalServerError()
            .json(serde_json::json!({ "error": "Create failed" })),
    }
}

/// PUT /api/v1/monitoring/sla/{id}
pub async fn update_sla_target(
    db: web::Data<Database>,
    path: web::Path<String>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = path.into_inner();
    let mut data = body.into_inner();
    data["updated_at"] = serde_json::json!(chrono::Utc::now().to_rfc3339());
    match db.update::<serde_json::Value>("sla_targets", &id, data).await {
        Ok(Some(item)) => HttpResponse::Ok().json(item),
        Ok(None) => HttpResponse::NotFound()
            .json(serde_json::json!({ "error": format!("SLA target {id} not found") })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e })),
    }
}

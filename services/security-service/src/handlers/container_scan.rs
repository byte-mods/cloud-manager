use actix_web::{web, HttpResponse};
use cloud_common::Database;

/// GET /api/v1/security/container-scans
pub async fn list_scans(db: web::Data<Database>) -> HttpResponse {
    match db.list::<serde_json::Value>("security_scans").await {
        Ok(items) => {
            let total = items.len();
            HttpResponse::Ok().json(serde_json::json!({ "items": items, "total": total }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e })),
    }
}

/// POST /api/v1/security/container-scans
pub async fn create_scan(
    db: web::Data<Database>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let mut data = body.into_inner();
    data["id"] = serde_json::json!(uuid::Uuid::new_v4().to_string());
    data["created_at"] = serde_json::json!(chrono::Utc::now().to_rfc3339());
    data["status"] = serde_json::json!("pending");
    data["scanner"] = serde_json::json!(data.get("scanner").and_then(|v| v.as_str()).unwrap_or("trivy"));
    match db.create::<serde_json::Value>("security_scans", data).await {
        Ok(Some(item)) => HttpResponse::Created().json(item),
        _ => HttpResponse::InternalServerError()
            .json(serde_json::json!({ "error": "Create failed" })),
    }
}

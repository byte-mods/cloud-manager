use actix_web::{web, HttpResponse};
use cloud_common::Database;

/// GET /api/v1/cloud/designs
pub async fn list_designs(db: web::Data<Database>) -> HttpResponse {
    let designs: Vec<serde_json::Value> = db.list("infrastructure_designs").await.unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "designs": designs,
        "total": designs.len(),
    }))
}

/// POST /api/v1/cloud/designs
pub async fn create_design(
    db: web::Data<Database>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let mut data = body.into_inner();

    if let Some(obj) = data.as_object_mut() {
        obj.insert("id".into(), serde_json::json!(id));
        obj.insert("created_at".into(), serde_json::json!(now));
        obj.insert("updated_at".into(), serde_json::json!(now));
    }

    match db.create_with_id::<serde_json::Value>("infrastructure_designs", &id, data).await {
        Ok(_) => HttpResponse::Created().json(serde_json::json!({
            "id": id,
            "message": "Design created",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// GET /api/v1/cloud/designs/{id}
pub async fn get_design(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.get::<serde_json::Value>("infrastructure_designs", &id).await {
        Ok(Some(design)) => HttpResponse::Ok().json(design),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Design not found",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// PUT /api/v1/cloud/designs/{id}
pub async fn update_design(
    db: web::Data<Database>,
    path: web::Path<String>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = path.into_inner();
    let mut data = body.into_inner();

    if let Some(obj) = data.as_object_mut() {
        obj.insert("updated_at".into(), serde_json::json!(chrono::Utc::now().to_rfc3339()));
    }

    match db.update::<serde_json::Value>("infrastructure_designs", &id, data).await {
        Ok(Some(_)) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Design updated",
        })),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Design not found",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// DELETE /api/v1/cloud/designs/{id}
pub async fn delete_design(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.delete("infrastructure_designs", &id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Design deleted",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// GET /api/v1/cloud/designs/service-catalog
pub async fn get_service_catalog(db: web::Data<Database>) -> HttpResponse {
    let catalog: Vec<serde_json::Value> = db.list("service_catalog").await.unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "services": catalog,
        "total": catalog.len(),
    }))
}

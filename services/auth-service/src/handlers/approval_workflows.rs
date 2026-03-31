use actix_web::{web, HttpResponse};
use cloud_common::Database;

/// GET /approvals/workflows
pub async fn list_workflows(db: web::Data<Database>) -> HttpResponse {
    match db.list::<serde_json::Value>("approval_workflows").await {
        Ok(items) => HttpResponse::Ok().json(serde_json::json!({
            "workflows": items,
            "total": items.len(),
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// POST /approvals/workflows
pub async fn create_workflow(
    db: web::Data<Database>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let mut data = body.into_inner();

    if let Some(obj) = data.as_object_mut() {
        obj.insert("id".into(), serde_json::json!(id));
        obj.insert("enabled".into(), serde_json::json!(true));
        obj.insert("created_at".into(), serde_json::json!(now));
        obj.insert("updated_at".into(), serde_json::json!(now));
    }

    match db.create_with_id::<serde_json::Value>("approval_workflows", &id, data).await {
        Ok(_) => HttpResponse::Created().json(serde_json::json!({
            "id": id,
            "message": "Approval workflow created",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// PUT /approvals/workflows/{id}
pub async fn update_workflow(
    db: web::Data<Database>,
    path: web::Path<String>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = path.into_inner();
    let mut data = body.into_inner();

    if let Some(obj) = data.as_object_mut() {
        obj.insert("updated_at".into(), serde_json::json!(chrono::Utc::now().to_rfc3339()));
    }

    match db.update::<serde_json::Value>("approval_workflows", &id, data).await {
        Ok(Some(_)) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Workflow updated",
        })),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Workflow not found",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// DELETE /approvals/workflows/{id}
pub async fn delete_workflow(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.delete("approval_workflows", &id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Workflow deleted",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

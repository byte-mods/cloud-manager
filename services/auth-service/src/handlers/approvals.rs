use actix_web::{web, HttpResponse};
use cloud_common::Database;

/// GET /approvals
pub async fn list_approvals(db: web::Data<Database>) -> HttpResponse {
    match db.list::<serde_json::Value>("approval_requests").await {
        Ok(items) => HttpResponse::Ok().json(serde_json::json!({
            "approvals": items,
            "total": items.len(),
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// POST /approvals
pub async fn create_approval(
    db: web::Data<Database>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let mut data = body.into_inner();

    if let Some(obj) = data.as_object_mut() {
        obj.insert("id".into(), serde_json::json!(id));
        obj.insert("status".into(), serde_json::json!("pending"));
        obj.insert("created_at".into(), serde_json::json!(now));
        obj.insert("resolved_at".into(), serde_json::Value::Null);
    }

    match db.create_with_id::<serde_json::Value>("approval_requests", &id, data).await {
        Ok(_) => HttpResponse::Created().json(serde_json::json!({
            "id": id,
            "status": "pending",
            "message": "Approval request created",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// PUT /approvals/{id}/approve
pub async fn approve(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();

    let existing: Result<Option<serde_json::Value>, _> = db.get("approval_requests", &id).await;
    match existing {
        Ok(Some(mut record)) => {
            if let Some(obj) = record.as_object_mut() {
                obj.insert("status".into(), serde_json::json!("approved"));
                obj.insert("resolved_at".into(), serde_json::json!(chrono::Utc::now().to_rfc3339()));
            }
            match db.update::<serde_json::Value>("approval_requests", &id, record).await {
                Ok(_) => HttpResponse::Ok().json(serde_json::json!({
                    "message": "Approval request approved",
                    "status": "approved",
                })),
                Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": e.to_string(),
                })),
            }
        }
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Approval request not found",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// PUT /approvals/{id}/reject
pub async fn reject(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();

    let existing: Result<Option<serde_json::Value>, _> = db.get("approval_requests", &id).await;
    match existing {
        Ok(Some(mut record)) => {
            if let Some(obj) = record.as_object_mut() {
                obj.insert("status".into(), serde_json::json!("rejected"));
                obj.insert("resolved_at".into(), serde_json::json!(chrono::Utc::now().to_rfc3339()));
            }
            match db.update::<serde_json::Value>("approval_requests", &id, record).await {
                Ok(_) => HttpResponse::Ok().json(serde_json::json!({
                    "message": "Approval request rejected",
                    "status": "rejected",
                })),
                Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": e.to_string(),
                })),
            }
        }
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Approval request not found",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

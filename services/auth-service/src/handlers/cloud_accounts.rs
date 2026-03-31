use actix_web::{web, HttpResponse};
use cloud_common::Database;

/// GET /cloud-accounts
pub async fn list_cloud_accounts(db: web::Data<Database>) -> HttpResponse {
    match db.list::<serde_json::Value>("cloud_accounts").await {
        Ok(items) => {
            // Redact sensitive fields before returning
            let safe: Vec<serde_json::Value> = items
                .into_iter()
                .map(|mut v| {
                    if let Some(obj) = v.as_object_mut() {
                        if obj.contains_key("secret_key") {
                            obj.insert("secret_key".into(), serde_json::json!("********"));
                        }
                        if obj.contains_key("credentials") {
                            obj.insert("credentials".into(), serde_json::json!("********"));
                        }
                    }
                    v
                })
                .collect();
            HttpResponse::Ok().json(serde_json::json!({
                "cloud_accounts": safe,
                "total": safe.len(),
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// POST /cloud-accounts
pub async fn create_cloud_account(
    db: web::Data<Database>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let mut data = body.into_inner();

    if let Some(obj) = data.as_object_mut() {
        obj.insert("id".into(), serde_json::json!(id));
        obj.insert("created_at".into(), serde_json::json!(now));
    }

    match db.create_with_id::<serde_json::Value>("cloud_accounts", &id, data).await {
        Ok(_) => HttpResponse::Created().json(serde_json::json!({
            "id": id,
            "message": "Cloud account created",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// DELETE /cloud-accounts/{id}
pub async fn delete_cloud_account(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.delete("cloud_accounts", &id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Cloud account deleted",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

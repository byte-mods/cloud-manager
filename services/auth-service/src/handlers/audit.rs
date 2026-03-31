use actix_web::{web, HttpResponse};
use cloud_common::Database;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct AuditQuery {
    pub limit: Option<u32>,
    pub user: Option<String>,
    pub action: Option<String>,
    pub resource_type: Option<String>,
    pub status: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
}

/// GET /audit-log?limit=50&user=admin&action=create&resource_type=ec2&status=success&from=2026-03-01&to=2026-03-31
pub async fn list_audit_log(
    db: web::Data<Database>,
    query: web::Query<AuditQuery>,
) -> HttpResponse {
    let limit = query.limit.unwrap_or(100);
    let mut conditions = Vec::new();

    if let Some(ref user) = query.user {
        conditions.push(format!("(user_id = '{user}' OR user_email CONTAINS '{user}')"));
    }
    if let Some(ref action) = query.action {
        conditions.push(format!("action = '{action}'"));
    }
    if let Some(ref rt) = query.resource_type {
        conditions.push(format!("resource_type = '{rt}'"));
    }
    if let Some(ref status) = query.status {
        conditions.push(format!("status = '{status}'"));
    }
    if let Some(ref from) = query.from {
        conditions.push(format!("created_at >= '{from}'"));
    }
    if let Some(ref to) = query.to {
        conditions.push(format!("created_at <= '{to}'"));
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT * FROM audit_log {where_clause} ORDER BY created_at DESC LIMIT {limit}"
    );

    match db.inner().query(&sql).await {
        Ok(mut response) => {
            let entries: Vec<serde_json::Value> = response.take(0).unwrap_or_default();
            HttpResponse::Ok().json(serde_json::json!({
                "audit_log": entries,
                "total": entries.len(),
                "limit": limit,
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// GET /audit-log/{id}
pub async fn get_audit_entry(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.get::<serde_json::Value>("audit_log", &id).await {
        Ok(Some(entry)) => HttpResponse::Ok().json(entry),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Audit entry not found",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// POST /audit-log
pub async fn create_audit_entry(
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

    match db.create_with_id::<serde_json::Value>("audit_log", &id, data).await {
        Ok(_) => HttpResponse::Created().json(serde_json::json!({
            "id": id,
            "message": "Audit entry created",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

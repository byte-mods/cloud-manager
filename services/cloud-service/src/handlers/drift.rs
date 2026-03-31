use actix_web::{web, HttpResponse};
use cloud_common::Database;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct DriftQuery {
    pub status: Option<String>,
    pub provider: Option<String>,
}

/// GET /api/v1/cloud/drift/resources
pub async fn list_drift_resources(
    db: web::Data<Database>,
    query: web::Query<DriftQuery>,
) -> HttpResponse {
    let resources: Vec<serde_json::Value> = if query.status.is_some() || query.provider.is_some() {
        let mut conditions = Vec::new();
        if let Some(ref s) = query.status {
            conditions.push(format!("drift_status = '{s}'"));
        }
        if let Some(ref p) = query.provider {
            conditions.push(format!("provider = '{p}'"));
        }
        let where_clause = conditions.join(" AND ");
        db.list_filtered("drift_detections", &where_clause)
            .await
            .unwrap_or_default()
    } else {
        db.list("drift_detections").await.unwrap_or_default()
    };

    HttpResponse::Ok().json(serde_json::json!({
        "resources": resources,
        "total": resources.len(),
    }))
}

/// GET /api/v1/cloud/drift/resources/{id}
pub async fn get_drift_resource(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.get::<serde_json::Value>("drift_detections", &id).await {
        Ok(Some(resource)) => HttpResponse::Ok().json(resource),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Drift resource not found",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// POST /api/v1/cloud/drift/scan
pub async fn trigger_drift_scan(
    db: web::Data<Database>,
) -> HttpResponse {
    // Mark all existing resources as scanning
    let resources: Vec<serde_json::Value> = db.list("drift_detections").await.unwrap_or_default();
    let scan_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    for resource in &resources {
        if let Some(id) = resource.get("id").and_then(|v| v.as_str()) {
            let mut updated = resource.clone();
            if let Some(obj) = updated.as_object_mut() {
                obj.insert("last_scanned".into(), serde_json::json!(now));
                obj.insert("scan_id".into(), serde_json::json!(scan_id));
            }
            let _ = db.update::<serde_json::Value>("drift_detections", id, updated).await;
        }
    }

    HttpResponse::Ok().json(serde_json::json!({
        "scan_id": scan_id,
        "status": "completed",
        "resources_scanned": resources.len(),
        "started_at": now,
    }))
}

/// POST /api/v1/cloud/drift/resources/{id}/accept
pub async fn accept_drift(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.get::<serde_json::Value>("drift_detections", &id).await {
        Ok(Some(mut resource)) => {
            if let Some(obj) = resource.as_object_mut() {
                obj.insert("drift_status".into(), serde_json::json!("IN_SYNC"));
                obj.insert("accepted_at".into(), serde_json::json!(chrono::Utc::now().to_rfc3339()));
                // Copy actual to designed (accept the drift)
                if let Some(actual) = obj.get("actual_config").cloned() {
                    obj.insert("designed_config".into(), actual);
                }
            }
            let _ = db.update::<serde_json::Value>("drift_detections", &id, resource).await;
            HttpResponse::Ok().json(serde_json::json!({ "message": "Drift accepted" }))
        }
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Resource not found",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// POST /api/v1/cloud/drift/resources/{id}/remediate
pub async fn remediate_drift(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.get::<serde_json::Value>("drift_detections", &id).await {
        Ok(Some(mut resource)) => {
            if let Some(obj) = resource.as_object_mut() {
                obj.insert("drift_status".into(), serde_json::json!("IN_SYNC"));
                obj.insert("remediated_at".into(), serde_json::json!(chrono::Utc::now().to_rfc3339()));
                // Copy designed to actual (remediate to designed state)
                if let Some(designed) = obj.get("designed_config").cloned() {
                    obj.insert("actual_config".into(), designed);
                }
            }
            let _ = db.update::<serde_json::Value>("drift_detections", &id, resource).await;
            HttpResponse::Ok().json(serde_json::json!({ "message": "Drift remediated" }))
        }
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Resource not found",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

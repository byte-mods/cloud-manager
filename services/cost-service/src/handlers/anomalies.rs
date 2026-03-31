use actix_web::{web, HttpResponse};
use cloud_common::Database;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct AnomalyQuery {
    pub status: Option<String>,
    pub severity: Option<String>,
    pub provider: Option<String>,
}

/// GET /api/v1/cost/anomalies
pub async fn list_anomalies(
    db: web::Data<Database>,
    query: web::Query<AnomalyQuery>,
) -> HttpResponse {
    let anomalies: Vec<serde_json::Value> = if query.status.is_some() || query.severity.is_some() || query.provider.is_some() {
        let mut conditions = Vec::new();
        if let Some(ref s) = query.status {
            conditions.push(format!("status = '{s}'"));
        }
        if let Some(ref sev) = query.severity {
            conditions.push(format!("severity = '{sev}'"));
        }
        if let Some(ref p) = query.provider {
            conditions.push(format!("provider = '{p}'"));
        }
        db.list_filtered("cost_anomalies", &conditions.join(" AND "))
            .await
            .unwrap_or_default()
    } else {
        db.list("cost_anomalies").await.unwrap_or_default()
    };

    HttpResponse::Ok().json(serde_json::json!({
        "anomalies": anomalies,
        "total": anomalies.len(),
    }))
}

/// GET /api/v1/cost/anomalies/{id}
pub async fn get_anomaly(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.get::<serde_json::Value>("cost_anomalies", &id).await {
        Ok(Some(anomaly)) => HttpResponse::Ok().json(anomaly),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({ "error": "Anomaly not found" })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e.to_string() })),
    }
}

/// POST /api/v1/cost/anomalies
pub async fn create_anomaly(
    db: web::Data<Database>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let mut data = body.into_inner();
    if let Some(obj) = data.as_object_mut() {
        obj.insert("id".into(), serde_json::json!(id));
        obj.insert("status".into(), serde_json::json!("active"));
        obj.insert("detected_at".into(), serde_json::json!(now));
    }

    match db.create_with_id::<serde_json::Value>("cost_anomalies", &id, data).await {
        Ok(_) => HttpResponse::Created().json(serde_json::json!({ "id": id })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e.to_string() })),
    }
}

/// PUT /api/v1/cost/anomalies/{id}/dismiss
pub async fn dismiss_anomaly(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.get::<serde_json::Value>("cost_anomalies", &id).await {
        Ok(Some(mut anomaly)) => {
            if let Some(obj) = anomaly.as_object_mut() {
                obj.insert("status".into(), serde_json::json!("dismissed"));
                obj.insert("dismissed_at".into(), serde_json::json!(chrono::Utc::now().to_rfc3339()));
            }
            let _ = db.update::<serde_json::Value>("cost_anomalies", &id, anomaly).await;
            HttpResponse::Ok().json(serde_json::json!({ "message": "Anomaly dismissed" }))
        }
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({ "error": "Anomaly not found" })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e.to_string() })),
    }
}

/// PUT /api/v1/cost/anomalies/{id}/investigate
pub async fn investigate_anomaly(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.get::<serde_json::Value>("cost_anomalies", &id).await {
        Ok(Some(mut anomaly)) => {
            if let Some(obj) = anomaly.as_object_mut() {
                obj.insert("status".into(), serde_json::json!("investigating"));
                obj.insert("investigating_since".into(), serde_json::json!(chrono::Utc::now().to_rfc3339()));
            }
            let _ = db.update::<serde_json::Value>("cost_anomalies", &id, anomaly).await;
            HttpResponse::Ok().json(serde_json::json!({ "message": "Anomaly marked as investigating" }))
        }
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({ "error": "Anomaly not found" })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e.to_string() })),
    }
}

/// PUT /api/v1/cost/anomalies/{id}/resolve
pub async fn resolve_anomaly(
    db: web::Data<Database>,
    path: web::Path<String>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.get::<serde_json::Value>("cost_anomalies", &id).await {
        Ok(Some(mut anomaly)) => {
            if let Some(obj) = anomaly.as_object_mut() {
                obj.insert("status".into(), serde_json::json!("resolved"));
                obj.insert("resolved_at".into(), serde_json::json!(chrono::Utc::now().to_rfc3339()));
                if let Some(root_cause) = body.get("root_cause") {
                    obj.insert("root_cause".into(), root_cause.clone());
                }
            }
            let _ = db.update::<serde_json::Value>("cost_anomalies", &id, anomaly).await;
            HttpResponse::Ok().json(serde_json::json!({ "message": "Anomaly resolved" }))
        }
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({ "error": "Anomaly not found" })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e.to_string() })),
    }
}

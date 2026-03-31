use actix_web::{web, HttpResponse};
use uuid::Uuid;

use crate::models::monitoring::{TraceDetail, TraceSummary};

pub async fn list_traces(db: web::Data<cloud_common::Database>) -> HttpResponse {
    let traces: Vec<TraceDetail> = db.list("traces").await.unwrap_or_default();

    let summaries: Vec<TraceSummary> = traces
        .iter()
        .map(|t| TraceSummary {
            id: t.id,
            name: t.name.clone(),
            service: t.service.clone(),
            duration_ms: t.duration_ms,
            spans: t.spans.len() as u32,
            status: t.status.clone(),
            started_at: t.started_at,
        })
        .collect();

    HttpResponse::Ok().json(serde_json::json!({ "traces": summaries }))
}

pub async fn get_trace(
    db: web::Data<cloud_common::Database>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let trace_id = path.into_inner();

    let trace: Option<TraceDetail> = db
        .get("traces", &trace_id.to_string())
        .await
        .unwrap_or(None);

    match trace {
        Some(t) => HttpResponse::Ok().json(t),
        None => HttpResponse::NotFound().json(serde_json::json!({
            "error": "not_found",
            "message": format!("Trace '{}' not found", trace_id),
        })),
    }
}

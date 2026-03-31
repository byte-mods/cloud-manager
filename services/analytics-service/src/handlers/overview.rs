use std::sync::Arc;

use actix_web::{web, HttpResponse, ResponseError};

use cloud_common::Database;

use crate::models::analytics::{AnalyticsOverview, Report, Visualization};
use crate::traits::QueryEngineProvider;

pub async fn get_overview(
    provider: web::Data<Arc<dyn QueryEngineProvider>>,
    db: web::Data<Database>,
) -> HttpResponse {
    // Query engines come from the trait provider (real or mock)
    let engines = match provider.list_query_engines().await {
        Ok(e) => e,
        Err(e) => return e.error_response(),
    };

    // Visualizations and reports from SurrealDB
    let vis: Vec<Visualization> = db.list("visualizations").await.unwrap_or_default();
    let reports: Vec<Report> = db.list("reports").await.unwrap_or_default();

    let active = engines.iter().filter(|e| e.status == "healthy").count() as u32;
    let total_queries: f64 = engines.iter().map(|e| e.queries_per_day).sum();
    let avg_time = if !engines.is_empty() {
        engines.iter().map(|e| e.avg_query_time_ms).sum::<u64>() / engines.len() as u64
    } else {
        0
    };

    HttpResponse::Ok().json(AnalyticsOverview {
        total_queries_today: total_queries as u64,
        active_engines: active,
        saved_visualizations: vis.len() as u32,
        scheduled_reports: reports.len() as u32,
        total_data_scanned_gb: 2_450.8,
        avg_query_time_ms: avg_time,
    })
}

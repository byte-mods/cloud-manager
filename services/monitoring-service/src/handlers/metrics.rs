use std::sync::Arc;

use actix_web::{web, HttpResponse};
use chrono::{Duration, Utc};

use crate::models::monitoring::{MetricDetail, MetricSummary};
use crate::providers::{self, MonitoringContext};

pub async fn list_metrics(
    ctx: web::Data<Arc<MonitoringContext>>,
    db: web::Data<cloud_common::Database>,
) -> HttpResponse {
    // Try real provider first
    if let Some(provider) = providers::get_metrics_provider(&ctx) {
        match provider.list_metrics(None).await {
            Ok(metrics) => {
                let summaries: Vec<MetricSummary> = metrics
                    .iter()
                    .map(|m| {
                        let last_val = m.data_points.last().map(|p| p.value).unwrap_or(0.0);
                        MetricSummary {
                            name: m.name.clone(),
                            display_name: m.display_name.clone(),
                            current_value: last_val,
                            unit: m.unit.clone(),
                            trend: "stable".to_string(),
                            change_pct: 0.0,
                        }
                    })
                    .collect();
                return HttpResponse::Ok().json(serde_json::json!({ "metrics": summaries }));
            }
            Err(e) => {
                tracing::warn!("Real metrics provider failed, falling back to DB: {e}");
            }
        }
    }

    // Fallback to SurrealDB
    let metrics: Vec<MetricDetail> = db.list("metrics").await.unwrap_or_default();

    let summaries: Vec<MetricSummary> = metrics
        .iter()
        .map(|m| {
            let last_val = m.data_points.last().map(|p| p.value).unwrap_or(0.0);
            let prev_val = m
                .data_points
                .get(m.data_points.len().saturating_sub(13))
                .map(|p| p.value)
                .unwrap_or(last_val);
            let change = if prev_val > 0.0 {
                ((last_val - prev_val) / prev_val * 100.0 * 100.0).round() / 100.0
            } else {
                0.0
            };
            let trend = if change > 1.0 {
                "up"
            } else if change < -1.0 {
                "down"
            } else {
                "stable"
            };

            MetricSummary {
                name: m.name.clone(),
                display_name: m.display_name.clone(),
                current_value: last_val,
                unit: m.unit.clone(),
                trend: trend.to_string(),
                change_pct: change,
            }
        })
        .collect();

    HttpResponse::Ok().json(serde_json::json!({ "metrics": summaries }))
}

pub async fn get_metric(
    ctx: web::Data<Arc<MonitoringContext>>,
    db: web::Data<cloud_common::Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let name = path.into_inner();

    // Try real provider first
    if let Some(provider) = providers::get_metrics_provider(&ctx) {
        let end = Utc::now();
        let start = end - Duration::hours(24);
        match provider.get_metric_data(&name, start, end, 300).await {
            Ok(data_points) => {
                if !data_points.is_empty() {
                    let values: Vec<f64> = data_points.iter().map(|p| p.value).collect();
                    let min = values.iter().cloned().fold(f64::INFINITY, f64::min);
                    let max = values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
                    let avg = values.iter().sum::<f64>() / values.len() as f64;

                    let detail = MetricDetail {
                        name: name.clone(),
                        display_name: name.clone(),
                        unit: "None".to_string(),
                        data_points,
                        min: (min * 100.0).round() / 100.0,
                        max: (max * 100.0).round() / 100.0,
                        avg: (avg * 100.0).round() / 100.0,
                    };
                    return HttpResponse::Ok().json(detail);
                }
            }
            Err(e) => {
                tracing::warn!("Real metrics provider failed, falling back to DB: {e}");
            }
        }
    }

    // Fallback to SurrealDB
    let metric: Option<MetricDetail> = db.get("metrics", &name).await.unwrap_or(None);

    match metric {
        Some(m) => HttpResponse::Ok().json(m),
        None => HttpResponse::NotFound().json(serde_json::json!({
            "error": "not_found",
            "message": format!("Metric '{}' not found", name),
        })),
    }
}

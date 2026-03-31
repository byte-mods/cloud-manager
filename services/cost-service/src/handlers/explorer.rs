use actix_web::{web, HttpResponse};
use std::sync::Arc;

use crate::error::CostError;
use crate::models::cost::CostExplorerQuery;
use crate::providers::CostProvider;

/// GET /api/v1/cost/explorer
///
/// Cost explorer with flexible grouping and filtering.
pub async fn explore_costs(
    query: web::Query<CostExplorerQuery>,
    providers: web::Data<Vec<Arc<dyn CostProvider>>>,
) -> Result<HttpResponse, CostError> {
    let end = query
        .end_date
        .unwrap_or_else(|| chrono::Utc::now().date_naive());
    let start = query
        .start_date
        .unwrap_or_else(|| end - chrono::Duration::days(30));

    let mut results = Vec::new();

    for provider in providers.iter() {
        // Filter by provider if specified.
        if let Some(ref filter_provider) = query.provider {
            if provider.name() != filter_provider.as_str() {
                continue;
            }
        }

        let daily_costs = provider.get_daily_costs(start, end).await?;
        let services = provider.get_cost_by_service().await?;

        let group_by = query.group_by.as_deref().unwrap_or("date");

        match group_by {
            "service" => {
                // Filter by service if specified.
                let filtered: Vec<_> = if let Some(ref svc) = query.service {
                    services
                        .into_iter()
                        .filter(|s| s.service.to_lowercase().contains(&svc.to_lowercase()))
                        .collect()
                } else {
                    services
                };
                results.push(serde_json::json!({
                    "provider": provider.name(),
                    "group_by": "service",
                    "data": filtered,
                }));
            }
            _ => {
                // Default: group by date.
                results.push(serde_json::json!({
                    "provider": provider.name(),
                    "group_by": "date",
                    "start_date": start,
                    "end_date": end,
                    "data": daily_costs,
                }));
            }
        }
    }

    Ok(HttpResponse::Ok().json(results))
}

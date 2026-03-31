use actix_web::{web, HttpResponse};
use std::sync::Arc;

use crate::error::CostError;
use crate::providers::CostProvider;

/// GET /api/v1/cost/waste
///
/// Detects unused and wasted resources across all cloud providers.
pub async fn detect_waste(
    providers: web::Data<Vec<Arc<dyn CostProvider>>>,
) -> Result<HttpResponse, CostError> {
    let mut all_waste = Vec::new();
    let mut total_monthly_waste = 0.0;

    for provider in providers.iter() {
        let wasted = provider.get_wasted_resources().await?;
        for resource in &wasted {
            total_monthly_waste += resource.monthly_cost;
        }
        all_waste.extend(wasted);
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "total_monthly_waste": total_monthly_waste,
        "resource_count": all_waste.len(),
        "resources": all_waste,
    })))
}

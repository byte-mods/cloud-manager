use actix_web::{web, HttpResponse};
use std::sync::Arc;

use crate::error::CostError;
use crate::models::cost::{CostForecast, DailyCost};
use crate::providers::CostProvider;

/// GET /api/v1/cost/forecast
///
/// Returns historical cost data and projected future costs using linear regression
/// on the last 30 days of actual provider data, with widening confidence intervals.
pub async fn get_forecast(
    providers: web::Data<Vec<Arc<dyn CostProvider>>>,
) -> Result<HttpResponse, CostError> {
    let today = chrono::Utc::now().date_naive();
    let history_start = today - chrono::Duration::days(30);

    // Collect combined daily costs across all providers for the last 30 days.
    let mut combined: Vec<DailyCost> = Vec::new();

    for provider in providers.iter() {
        let daily = provider.get_daily_costs(history_start, today).await?;
        if combined.is_empty() {
            combined = daily;
        } else {
            for (i, dc) in daily.into_iter().enumerate() {
                if i < combined.len() {
                    combined[i].cost += dc.cost;
                } else {
                    combined.push(dc);
                }
            }
        }
    }

    let historical = combined.clone();

    // Perform simple linear regression: cost = slope * x + intercept
    // where x is the day index (0..n-1).
    let n = historical.len() as f64;
    if n < 2.0 {
        return Err(CostError::Internal("Not enough historical data for forecast".into()));
    }

    let mut sum_x = 0.0;
    let mut sum_y = 0.0;
    let mut sum_xy = 0.0;
    let mut sum_x2 = 0.0;

    for (i, dc) in historical.iter().enumerate() {
        let x = i as f64;
        let y = dc.cost;
        sum_x += x;
        sum_y += y;
        sum_xy += x * y;
        sum_x2 += x * x;
    }

    let slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x);
    let intercept = (sum_y - slope * sum_x) / n;

    // Calculate residual standard deviation for confidence intervals.
    let mut residual_sum = 0.0;
    for (i, dc) in historical.iter().enumerate() {
        let predicted = slope * i as f64 + intercept;
        let diff = dc.cost - predicted;
        residual_sum += diff * diff;
    }
    let residual_std = (residual_sum / (n - 2.0)).sqrt();

    // Project 30 days forward from today.
    let base_x = historical.len() as f64; // next day index after historical
    let mut projected = Vec::new();
    let mut confidence_lower = Vec::new();
    let mut confidence_upper = Vec::new();

    for i in 0..30 {
        let x = base_x + i as f64;
        let date = today + chrono::Duration::days(i + 1);
        let predicted_cost = (slope * x + intercept).max(0.0);

        // Confidence interval widens as we project further out.
        // Use ~1.96 * std * sqrt(1 + 1/n + ...) simplified to scale linearly.
        let margin = 1.96 * residual_std * (1.0 + (i as f64 / 30.0));

        projected.push(DailyCost {
            date,
            cost: (predicted_cost * 100.0).round() / 100.0,
        });
        confidence_lower.push(DailyCost {
            date,
            cost: ((predicted_cost - margin).max(0.0) * 100.0).round() / 100.0,
        });
        confidence_upper.push(DailyCost {
            date,
            cost: ((predicted_cost + margin) * 100.0).round() / 100.0,
        });
    }

    let forecast = CostForecast {
        historical,
        projected,
        confidence_lower,
        confidence_upper,
    };

    Ok(HttpResponse::Ok().json(forecast))
}

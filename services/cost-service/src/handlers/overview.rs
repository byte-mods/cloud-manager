use actix_web::{web, HttpResponse};
use chrono::{Datelike, NaiveDate};
use std::collections::HashMap;
use std::sync::Arc;

use crate::error::CostError;
use crate::models::cost::CostOverview;
use crate::providers::CostProvider;

/// GET /api/v1/cost/overview
///
/// Returns an aggregated cost overview across all cloud providers.
pub async fn get_overview(
    providers: web::Data<Vec<Arc<dyn CostProvider>>>,
) -> Result<HttpResponse, CostError> {
    let mut total_cost = 0.0;
    let mut cost_by_provider = HashMap::new();
    let mut cost_by_service = Vec::new();

    for provider in providers.iter() {
        let month_cost = provider.get_current_month_cost().await?;
        total_cost += month_cost;
        cost_by_provider.insert(provider.name().to_string(), month_cost);

        let services = provider.get_cost_by_service().await?;
        cost_by_service.extend(services);
    }

    // Recalculate percentages based on total.
    for svc in &mut cost_by_service {
        svc.percentage = if total_cost > 0.0 {
            ((svc.cost / total_cost) * 1000.0).round() / 10.0
        } else {
            0.0
        };
    }
    cost_by_service.sort_by(|a, b| b.cost.partial_cmp(&a.cost).unwrap_or(std::cmp::Ordering::Equal));

    // Generate trend data for the last 30 days.
    let today = chrono::Utc::now().date_naive();
    let end = today;
    let start = end - chrono::Duration::days(30);
    let mut trend = Vec::new();

    for provider in providers.iter() {
        let daily = provider.get_daily_costs(start, end).await?;
        if trend.is_empty() {
            trend = daily;
        } else {
            for (i, dc) in daily.into_iter().enumerate() {
                if i < trend.len() {
                    trend[i].cost += dc.cost;
                } else {
                    trend.push(dc);
                }
            }
        }
    }

    // Calculate month-over-month change dynamically.
    // Compare current month's daily average to previous month's daily average.
    let month_over_month_change = calculate_mom_change(&providers, today).await.unwrap_or(0.0);

    let overview = CostOverview {
        total_cost,
        cost_by_provider,
        cost_by_service,
        trend,
        month_over_month_change,
    };

    Ok(HttpResponse::Ok().json(overview))
}

/// Calculates month-over-month percentage change by comparing the daily average
/// cost of the current month so far to the full previous month.
async fn calculate_mom_change(
    providers: &[Arc<dyn CostProvider>],
    today: NaiveDate,
) -> Result<f64, CostError> {
    let current_month_start = NaiveDate::from_ymd_opt(today.year(), today.month(), 1).unwrap();

    // Previous month boundaries
    let prev_month_end = current_month_start - chrono::Duration::days(1);
    let prev_month_start =
        NaiveDate::from_ymd_opt(prev_month_end.year(), prev_month_end.month(), 1).unwrap();

    let mut current_total = 0.0;
    let mut prev_total = 0.0;

    for provider in providers.iter() {
        let current_days = provider.get_daily_costs(current_month_start, today).await?;
        current_total += current_days.iter().map(|d| d.cost).sum::<f64>();

        let prev_days = provider.get_daily_costs(prev_month_start, prev_month_end).await?;
        prev_total += prev_days.iter().map(|d| d.cost).sum::<f64>();
    }

    let current_days_count = (today - current_month_start).num_days().max(1) as f64 + 1.0;
    let prev_days_count = (prev_month_end - prev_month_start).num_days().max(1) as f64 + 1.0;

    let current_daily_avg = current_total / current_days_count;
    let prev_daily_avg = prev_total / prev_days_count;

    if prev_daily_avg > 0.0 {
        let change = ((current_daily_avg - prev_daily_avg) / prev_daily_avg) * 100.0;
        Ok((change * 10.0).round() / 10.0)
    } else {
        Ok(0.0)
    }
}

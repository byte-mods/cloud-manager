use async_trait::async_trait;
use chrono::{Datelike, NaiveDate, Utc};
use std::sync::Arc;
use uuid::Uuid;

use aws_sdk_costexplorer::types::{
    DateInterval, Granularity, GroupDefinition, GroupDefinitionType,
};

use super::CostProvider;
use crate::error::CostError;
use crate::models::cost::{DailyCost, ServiceCost, WastedResource};

/// Real AWS Cost Explorer provider that calls the AWS Cost Explorer API.
pub struct AwsCostSdkProvider {
    client: aws_sdk_costexplorer::Client,
    region: String,
}

impl AwsCostSdkProvider {
    pub fn new(credentials: &Arc<cloud_common::CredentialManager>, region: &str) -> Result<Self, CostError> {
        let config = credentials.aws_config().map_err(|e| {
            CostError::ProviderError(format!("AWS credentials not available: {e}"))
        })?;
        let client = aws_sdk_costexplorer::Client::new(config);
        Ok(Self {
            client,
            region: region.to_string(),
        })
    }

    /// Helper: call GetCostAndUsage with optional GROUP BY dimension.
    async fn get_cost_and_usage(
        &self,
        start: &str,
        end: &str,
        granularity: Granularity,
        group_by_key: Option<&str>,
    ) -> Result<aws_sdk_costexplorer::operation::get_cost_and_usage::GetCostAndUsageOutput, CostError>
    {
        let time_period = DateInterval::builder()
            .start(start)
            .end(end)
            .build()
            .map_err(|e| CostError::ProviderError(format!("Invalid date interval: {e}")))?;

        let mut req = self
            .client
            .get_cost_and_usage()
            .time_period(time_period)
            .granularity(granularity)
            .metrics("UnblendedCost");

        if let Some(key) = group_by_key {
            let group_def = GroupDefinition::builder()
                .r#type(GroupDefinitionType::Dimension)
                .key(key)
                .build();
            req = req.group_by(group_def);
        }

        req.send().await.map_err(|e| {
            CostError::ProviderError(format!("AWS Cost Explorer API error: {e}"))
        })
    }

    /// Format a NaiveDate as YYYY-MM-DD for the Cost Explorer API.
    fn fmt_date(date: NaiveDate) -> String {
        date.format("%Y-%m-%d").to_string()
    }
}

#[async_trait]
impl CostProvider for AwsCostSdkProvider {
    fn name(&self) -> &str {
        "aws"
    }

    async fn get_current_month_cost(&self) -> Result<f64, CostError> {
        let today = Utc::now().date_naive();
        let first_of_month = NaiveDate::from_ymd_opt(today.year(), today.month(), 1).unwrap();
        // Cost Explorer end date is exclusive; use tomorrow so today is included.
        let end = today + chrono::Duration::days(1);

        let output = self
            .get_cost_and_usage(
                &Self::fmt_date(first_of_month),
                &Self::fmt_date(end),
                Granularity::Monthly,
                None,
            )
            .await?;

        let mut total = 0.0;
        for result in output.results_by_time() {
            if let Some(metrics) = result.total() {
                if let Some(metric) = metrics.get("UnblendedCost") {
                    if let Some(amount) = metric.amount() {
                        total += amount.parse::<f64>().unwrap_or(0.0);
                    }
                }
            }
        }
        Ok((total * 100.0).round() / 100.0)
    }

    async fn get_cost_by_service(&self) -> Result<Vec<ServiceCost>, CostError> {
        let today = Utc::now().date_naive();
        let first_of_month = NaiveDate::from_ymd_opt(today.year(), today.month(), 1).unwrap();
        let end = today + chrono::Duration::days(1);

        let output = self
            .get_cost_and_usage(
                &Self::fmt_date(first_of_month),
                &Self::fmt_date(end),
                Granularity::Monthly,
                Some("SERVICE"),
            )
            .await?;

        let mut services: Vec<ServiceCost> = Vec::new();

        for result in output.results_by_time() {
            for group in result.groups() {
                let service_name = group.keys().first().cloned().unwrap_or_default();
                let cost = group
                    .metrics()
                    .and_then(|m| m.get("UnblendedCost"))
                    .and_then(|v| v.amount())
                    .and_then(|a| a.parse::<f64>().ok())
                    .unwrap_or(0.0);

                if cost > 0.01 {
                    services.push(ServiceCost {
                        service: service_name.to_string(),
                        provider: "aws".to_string(),
                        cost: (cost * 100.0).round() / 100.0,
                        percentage: 0.0,
                    });
                }
            }
        }

        // Calculate percentages.
        let total: f64 = services.iter().map(|s| s.cost).sum();
        for svc in &mut services {
            svc.percentage = if total > 0.0 {
                ((svc.cost / total) * 1000.0).round() / 10.0
            } else {
                0.0
            };
        }

        // Sort descending by cost.
        services.sort_by(|a, b| b.cost.partial_cmp(&a.cost).unwrap_or(std::cmp::Ordering::Equal));
        Ok(services)
    }

    async fn get_daily_costs(
        &self,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<Vec<DailyCost>, CostError> {
        // Cost Explorer end is exclusive, add one day.
        let exclusive_end = end + chrono::Duration::days(1);

        let output = self
            .get_cost_and_usage(
                &Self::fmt_date(start),
                &Self::fmt_date(exclusive_end),
                Granularity::Daily,
                None,
            )
            .await?;

        let mut costs = Vec::new();
        for result in output.results_by_time() {
            // Parse the start date from the time period.
            let date_str = result
                .time_period()
                .map(|tp| tp.start().to_owned())
                .unwrap_or_default();
            let date = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
                .unwrap_or(start);

            let cost = result
                .total()
                .and_then(|m| m.get("UnblendedCost"))
                .and_then(|v| v.amount())
                .and_then(|a| a.parse::<f64>().ok())
                .unwrap_or(0.0);

            costs.push(DailyCost {
                date,
                cost: (cost * 100.0).round() / 100.0,
            });
        }
        Ok(costs)
    }

    async fn get_wasted_resources(&self) -> Result<Vec<WastedResource>, CostError> {
        // The Cost Explorer API does not directly expose wasted resources.
        // We look for services with very low spend as a heuristic and flag them.
        // A production system would integrate with AWS Trusted Advisor or Compute Optimizer.
        tracing::info!("Wasted-resource detection via real AWS APIs is limited; returning heuristic results");

        let services = self.get_cost_by_service().await?;
        let mut wasted = Vec::new();

        for svc in &services {
            // Flag services with very small spend that might be forgotten resources.
            if svc.cost > 0.0 && svc.cost < 5.0 {
                wasted.push(WastedResource {
                    id: Uuid::new_v4(),
                    resource_id: format!("aws-service-{}", svc.service.to_lowercase().replace(' ', "-")),
                    resource_type: svc.service.clone(),
                    provider: "aws".to_string(),
                    region: self.region.clone(),
                    monthly_cost: svc.cost,
                    reason: format!(
                        "Service '{}' has very low spend (${:.2}/month) — may be a forgotten resource",
                        svc.service, svc.cost
                    ),
                    last_used: None,
                });
            }
        }

        Ok(wasted)
    }
}

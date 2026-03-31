use async_trait::async_trait;
use chrono::{Datelike, NaiveDate, Utc};
use std::sync::Arc;
use uuid::Uuid;

use super::CostProvider;
use crate::error::CostError;
use crate::models::cost::{DailyCost, ServiceCost, WastedResource};

/// Real Azure Cost Management provider that calls the Azure Cost Management Query API.
///
/// Uses the REST endpoint:
/// `POST https://management.azure.com/subscriptions/{subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`
pub struct AzureCostSdkProvider {
    subscription_id: String,
    credentials: Arc<cloud_common::CredentialManager>,
    http: reqwest::Client,
}

impl AzureCostSdkProvider {
    pub fn new(
        credentials: Arc<cloud_common::CredentialManager>,
        subscription_id: &str,
    ) -> Result<Self, CostError> {
        // Verify Azure credentials are available.
        credentials.azure_credential().map_err(|e| {
            CostError::ProviderError(format!("Azure credentials not available: {e}"))
        })?;

        Ok(Self {
            subscription_id: subscription_id.to_string(),
            credentials,
            http: reqwest::Client::new(),
        })
    }

    /// Obtain a bearer token for the Azure Management scope.
    async fn bearer_token(&self) -> Result<String, CostError> {
        let credential = self.credentials.azure_credential().map_err(|e| {
            CostError::ProviderError(format!("Azure credential error: {e}"))
        })?;

        use azure_core::credentials::TokenCredential;
        let token_response = credential
            .get_token(&["https://management.azure.com/.default"])
            .await
            .map_err(|e| CostError::ProviderError(format!("Azure token error: {e}")))?;

        Ok(token_response.token.secret().to_string())
    }

    /// Build the Azure Cost Management query URL.
    fn query_url(&self) -> String {
        format!(
            "https://management.azure.com/subscriptions/{}/providers/Microsoft.CostManagement/query?api-version=2023-11-01",
            self.subscription_id
        )
    }

    /// Execute a cost management query and return the raw JSON response.
    async fn execute_query(
        &self,
        body: serde_json::Value,
    ) -> Result<serde_json::Value, CostError> {
        let token = self.bearer_token().await?;

        let resp = self
            .http
            .post(&self.query_url())
            .bearer_auth(&token)
            .json(&body)
            .send()
            .await
            .map_err(|e| CostError::ProviderError(format!("Azure API request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(CostError::ProviderError(format!(
                "Azure Cost Management API returned {status}: {body}"
            )));
        }

        resp.json::<serde_json::Value>()
            .await
            .map_err(|e| CostError::ProviderError(format!("Azure response parse error: {e}")))
    }

    /// Build a cost query body with the given time period and optional grouping.
    fn build_query(
        start: &str,
        end: &str,
        granularity: &str,
        group_by: Option<(&str, &str)>,
    ) -> serde_json::Value {
        let mut body = serde_json::json!({
            "type": "ActualCost",
            "timeframe": "Custom",
            "timePeriod": {
                "from": start,
                "to": end,
            },
            "dataset": {
                "granularity": granularity,
                "aggregation": {
                    "totalCost": {
                        "name": "Cost",
                        "function": "Sum"
                    }
                }
            }
        });

        if let Some((dim_type, dim_name)) = group_by {
            body["dataset"]["grouping"] = serde_json::json!([{
                "type": dim_type,
                "name": dim_name,
            }]);
        }

        body
    }

    /// Parse rows from Azure Cost Management query response.
    /// Response shape: { "properties": { "columns": [...], "rows": [[...], ...] } }
    fn parse_rows(value: &serde_json::Value) -> Vec<Vec<serde_json::Value>> {
        value
            .get("properties")
            .and_then(|p| p.get("rows"))
            .and_then(|r| r.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|row| row.as_array().cloned())
                    .collect()
            })
            .unwrap_or_default()
    }

    fn fmt_date(date: NaiveDate) -> String {
        date.format("%Y-%m-%d").to_string()
    }
}

#[async_trait]
impl CostProvider for AzureCostSdkProvider {
    fn name(&self) -> &str {
        "azure"
    }

    async fn get_current_month_cost(&self) -> Result<f64, CostError> {
        let today = Utc::now().date_naive();
        let first_of_month = NaiveDate::from_ymd_opt(today.year(), today.month(), 1).unwrap();

        let body = Self::build_query(
            &Self::fmt_date(first_of_month),
            &Self::fmt_date(today),
            "None",
            None,
        );
        let result = self.execute_query(body).await?;

        let mut total = 0.0;
        for row in Self::parse_rows(&result) {
            // First column is typically the cost value.
            if let Some(cost_val) = row.first() {
                total += cost_val.as_f64().unwrap_or(0.0);
            }
        }
        Ok((total * 100.0).round() / 100.0)
    }

    async fn get_cost_by_service(&self) -> Result<Vec<ServiceCost>, CostError> {
        let today = Utc::now().date_naive();
        let first_of_month = NaiveDate::from_ymd_opt(today.year(), today.month(), 1).unwrap();

        let body = Self::build_query(
            &Self::fmt_date(first_of_month),
            &Self::fmt_date(today),
            "None",
            Some(("Dimension", "ServiceName")),
        );
        let result = self.execute_query(body).await?;

        let mut services: Vec<ServiceCost> = Vec::new();

        for row in Self::parse_rows(&result) {
            // Expected row format: [cost, service_name, currency]
            let cost = row.first().and_then(|v| v.as_f64()).unwrap_or(0.0);
            let service_name = row
                .get(1)
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string();

            if cost > 0.01 {
                services.push(ServiceCost {
                    service: service_name,
                    provider: "azure".to_string(),
                    cost: (cost * 100.0).round() / 100.0,
                    percentage: 0.0,
                });
            }
        }

        let total: f64 = services.iter().map(|s| s.cost).sum();
        for svc in &mut services {
            svc.percentage = if total > 0.0 {
                ((svc.cost / total) * 1000.0).round() / 10.0
            } else {
                0.0
            };
        }

        services.sort_by(|a, b| b.cost.partial_cmp(&a.cost).unwrap_or(std::cmp::Ordering::Equal));
        Ok(services)
    }

    async fn get_daily_costs(
        &self,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<Vec<DailyCost>, CostError> {
        let body = Self::build_query(
            &Self::fmt_date(start),
            &Self::fmt_date(end),
            "Daily",
            None,
        );
        let result = self.execute_query(body).await?;

        let mut costs = Vec::new();
        for row in Self::parse_rows(&result) {
            // Expected row format for daily granularity: [cost, date_int, currency]
            let cost = row.first().and_then(|v| v.as_f64()).unwrap_or(0.0);
            // Azure returns dates as YYYYMMDD integers in daily granularity.
            let date = row
                .get(1)
                .and_then(|v| {
                    // May be integer (20260315) or string.
                    let s = if let Some(n) = v.as_i64() {
                        n.to_string()
                    } else {
                        v.as_str().unwrap_or_default().to_string()
                    };
                    NaiveDate::parse_from_str(&s, "%Y%m%d")
                        .or_else(|_| NaiveDate::parse_from_str(&s, "%Y-%m-%d"))
                        .ok()
                })
                .unwrap_or(start);

            costs.push(DailyCost {
                date,
                cost: (cost * 100.0).round() / 100.0,
            });
        }
        Ok(costs)
    }

    async fn get_wasted_resources(&self) -> Result<Vec<WastedResource>, CostError> {
        // Azure Advisor provides waste recommendations, but that is a separate API.
        // Here we use a heuristic based on low-spend services.
        tracing::info!("Wasted-resource detection via real Azure APIs is limited; returning heuristic results");

        let services = self.get_cost_by_service().await?;
        let mut wasted = Vec::new();

        for svc in &services {
            if svc.cost > 0.0 && svc.cost < 5.0 {
                wasted.push(WastedResource {
                    id: Uuid::new_v4(),
                    resource_id: format!("azure-{}", svc.service.to_lowercase().replace(' ', "-")),
                    resource_type: svc.service.clone(),
                    provider: "azure".to_string(),
                    region: "global".to_string(),
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

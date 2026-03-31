pub mod aws_cost;
pub mod aws_cost_sdk;
pub mod azure_cost;
pub mod azure_cost_sdk;
pub mod gcp_cost;
pub mod gcp_cost_sdk;

use std::sync::Arc;

use async_trait::async_trait;
use chrono::NaiveDate;

use crate::error::CostError;
use crate::models::cost::{DailyCost, ServiceCost, WastedResource};

/// Trait for cloud cost provider integrations.
#[async_trait]
pub trait CostProvider: Send + Sync {
    /// Returns the provider name (e.g., "aws", "gcp", "azure").
    fn name(&self) -> &str;

    /// Fetches the total cost for the current month.
    async fn get_current_month_cost(&self) -> Result<f64, CostError>;

    /// Fetches cost broken down by service.
    async fn get_cost_by_service(&self) -> Result<Vec<ServiceCost>, CostError>;

    /// Fetches daily cost data for a date range.
    async fn get_daily_costs(
        &self,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<Vec<DailyCost>, CostError>;

    /// Detects unused or wasted resources.
    async fn get_wasted_resources(&self) -> Result<Vec<WastedResource>, CostError>;
}

/// Build the list of cost providers based on feature flags and available credentials.
///
/// When `CLOUD_USE_MOCK_DATA=true` (the default), returns mock providers with
/// deterministic seeded data. When `false`, returns real SDK providers backed
/// by the `CredentialManager`.
pub fn build_providers(
    flags: &cloud_common::FeatureFlags,
    credentials: Option<&Arc<cloud_common::CredentialManager>>,
    aws_region: &str,
    gcp_project_id: &str,
    azure_subscription_id: &str,
) -> Vec<Arc<dyn CostProvider>> {
    if flags.use_real_sdk() {
        tracing::info!("Building real SDK cost providers");
        build_real_providers(credentials, aws_region, gcp_project_id, azure_subscription_id)
    } else {
        tracing::info!("Building mock cost providers");
        build_mock_providers(aws_region, gcp_project_id, azure_subscription_id)
    }
}

fn build_mock_providers(
    aws_region: &str,
    gcp_project_id: &str,
    azure_subscription_id: &str,
) -> Vec<Arc<dyn CostProvider>> {
    vec![
        Arc::new(aws_cost::AwsCostProvider::new(aws_region)) as Arc<dyn CostProvider>,
        Arc::new(gcp_cost::GcpCostProvider::new(gcp_project_id)) as Arc<dyn CostProvider>,
        Arc::new(azure_cost::AzureCostProvider::new(azure_subscription_id)) as Arc<dyn CostProvider>,
    ]
}

fn build_real_providers(
    credentials: Option<&Arc<cloud_common::CredentialManager>>,
    aws_region: &str,
    gcp_project_id: &str,
    azure_subscription_id: &str,
) -> Vec<Arc<dyn CostProvider>> {
    let mut providers: Vec<Arc<dyn CostProvider>> = Vec::new();

    let creds = match credentials {
        Some(c) => c,
        None => {
            tracing::error!("Real SDK mode requested but no credentials provided; falling back to mock providers");
            return build_mock_providers(aws_region, gcp_project_id, azure_subscription_id);
        }
    };

    // AWS
    match aws_cost_sdk::AwsCostSdkProvider::new(creds, aws_region) {
        Ok(provider) => {
            tracing::info!("AWS Cost Explorer SDK provider initialized");
            providers.push(Arc::new(provider));
        }
        Err(e) => {
            tracing::warn!("AWS Cost Explorer SDK provider unavailable, using mock: {e}");
            providers.push(Arc::new(aws_cost::AwsCostProvider::new(aws_region)));
        }
    }

    // GCP
    match gcp_cost_sdk::GcpCostSdkProvider::new(Arc::clone(creds), gcp_project_id) {
        Ok(provider) => {
            tracing::info!("GCP Cloud Billing SDK provider initialized");
            providers.push(Arc::new(provider));
        }
        Err(e) => {
            tracing::warn!("GCP Cloud Billing SDK provider unavailable, using mock: {e}");
            providers.push(Arc::new(gcp_cost::GcpCostProvider::new(gcp_project_id)));
        }
    }

    // Azure
    match azure_cost_sdk::AzureCostSdkProvider::new(Arc::clone(creds), azure_subscription_id) {
        Ok(provider) => {
            tracing::info!("Azure Cost Management SDK provider initialized");
            providers.push(Arc::new(provider));
        }
        Err(e) => {
            tracing::warn!("Azure Cost Management SDK provider unavailable, using mock: {e}");
            providers.push(Arc::new(azure_cost::AzureCostProvider::new(azure_subscription_id)));
        }
    }

    providers
}

pub mod aws_monitoring;
pub mod azure_monitoring;
pub mod gcp_monitoring;

pub use aws_monitoring::AwsMonitoringProvider;
pub use azure_monitoring::AzureMonitoringProvider;
pub use gcp_monitoring::GcpMonitoringProvider;

use std::sync::Arc;

use cloud_common::{CredentialManager, FeatureFlags};

use crate::traits::{AlertsProvider, LogsProvider, MetricsProvider};

/// Shared context for monitoring providers, following the cloud-service pattern.
pub struct MonitoringContext {
    pub credentials: Option<Arc<CredentialManager>>,
    pub flags: FeatureFlags,
}

/// Get a metrics provider. Uses real AWS CloudWatch when CLOUD_USE_MOCK_DATA=false.
pub fn get_metrics_provider(ctx: &MonitoringContext) -> Option<Box<dyn MetricsProvider>> {
    if ctx.flags.use_real_sdk() {
        if let Some(creds) = &ctx.credentials {
            let region = std::env::var("AWS_DEFAULT_REGION")
                .unwrap_or_else(|_| "us-east-1".to_owned());
            return Some(Box::new(AwsMonitoringProvider::new(
                creds.clone(),
                region,
            )));
        }
    }
    None
}

/// Get a logs provider. Uses real AWS CloudWatch Logs when CLOUD_USE_MOCK_DATA=false.
pub fn get_logs_provider(ctx: &MonitoringContext) -> Option<Box<dyn LogsProvider>> {
    if ctx.flags.use_real_sdk() {
        if let Some(creds) = &ctx.credentials {
            let region = std::env::var("AWS_DEFAULT_REGION")
                .unwrap_or_else(|_| "us-east-1".to_owned());
            return Some(Box::new(AwsMonitoringProvider::new(
                creds.clone(),
                region,
            )));
        }
    }
    None
}

/// Get an alerts provider. Uses real AWS CloudWatch Alarms when CLOUD_USE_MOCK_DATA=false.
pub fn get_alerts_provider(ctx: &MonitoringContext) -> Option<Box<dyn AlertsProvider>> {
    if ctx.flags.use_real_sdk() {
        if let Some(creds) = &ctx.credentials {
            let region = std::env::var("AWS_DEFAULT_REGION")
                .unwrap_or_else(|_| "us-east-1".to_owned());
            return Some(Box::new(AwsMonitoringProvider::new(
                creds.clone(),
                region,
            )));
        }
    }
    None
}

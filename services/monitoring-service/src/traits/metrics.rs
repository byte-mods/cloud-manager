use async_trait::async_trait;
use chrono::{DateTime, Utc};

use crate::error::MonitoringError;
use crate::models::monitoring::{MetricDataPoint, MetricDetail};

pub type Result<T> = std::result::Result<T, MonitoringError>;

#[async_trait]
pub trait MetricsProvider: Send + Sync {
    /// List available metrics, optionally filtered by namespace.
    async fn list_metrics(&self, namespace: Option<&str>) -> Result<Vec<MetricDetail>>;

    /// Get time-series data for a specific metric.
    async fn get_metric_data(
        &self,
        name: &str,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
        period_seconds: u32,
    ) -> Result<Vec<MetricDataPoint>>;
}

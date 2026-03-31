use async_trait::async_trait;

use crate::error::MonitoringError;
use crate::models::monitoring::Alert;

pub type Result<T> = std::result::Result<T, MonitoringError>;

#[async_trait]
pub trait AlertsProvider: Send + Sync {
    /// List all active alarms/alerts.
    async fn list_alerts(&self) -> Result<Vec<Alert>>;

    /// Get details for a specific alert by name.
    async fn get_alert(&self, name: &str) -> Result<Alert>;
}

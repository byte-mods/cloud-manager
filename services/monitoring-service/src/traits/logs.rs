use async_trait::async_trait;

use crate::error::MonitoringError;
use crate::models::monitoring::LogEntry;

pub type Result<T> = std::result::Result<T, MonitoringError>;

#[async_trait]
pub trait LogsProvider: Send + Sync {
    /// Query log entries with optional filters.
    async fn query_logs(
        &self,
        log_group: Option<&str>,
        filter_pattern: Option<&str>,
        limit: usize,
    ) -> Result<Vec<LogEntry>>;

    /// List available log groups.
    async fn list_log_groups(&self) -> Result<Vec<String>>;
}

use async_trait::async_trait;

use crate::error::CloudError;
use crate::models::{FlowLogResponse, TrafficSummary};

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait TrafficProvider: Send + Sync {
    /// Fetch VPC Flow Logs from CloudWatch Logs Insights (or equivalent).
    async fn get_flow_logs(
        &self,
        region: &str,
        log_group: Option<&str>,
        start_time: Option<i64>,
        end_time: Option<i64>,
    ) -> Result<FlowLogResponse>;

    /// Return an aggregated traffic summary across all VPCs.
    async fn get_traffic_summary(&self, region: &str) -> Result<TrafficSummary>;
}

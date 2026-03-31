use async_trait::async_trait;

use crate::error::CloudError;
use crate::models::CloudResource;

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait WorkflowProvider: Send + Sync {
    /// List all state machines / workflows.
    async fn list_state_machines(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get a specific state machine by ARN.
    async fn get_state_machine(&self, region: &str, arn: &str) -> Result<CloudResource>;

    /// Start an execution of a state machine.
    async fn start_execution(&self, region: &str, arn: &str, input: serde_json::Value) -> Result<CloudResource>;

    /// List executions for a state machine.
    async fn list_executions(&self, region: &str, arn: &str) -> Result<Vec<CloudResource>>;
}

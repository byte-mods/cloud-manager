use async_trait::async_trait;
use crate::error::CloudError;
use crate::models::CloudResource;

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait MessagingProvider: Send + Sync {
    /// List all message queues (SQS, Cloud Tasks, Azure Queue).
    async fn list_queues(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get a specific queue by ID/name.
    async fn get_queue(&self, region: &str, id: &str) -> Result<CloudResource>;

    /// Create a new message queue.
    async fn create_queue(&self, region: &str, name: &str, fifo: bool) -> Result<CloudResource>;

    /// Delete a message queue.
    async fn delete_queue(&self, region: &str, id: &str) -> Result<()>;

    /// List all topics (SNS, Pub/Sub, Azure Service Bus).
    async fn list_topics(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Create a new topic.
    async fn create_topic(&self, region: &str, name: &str) -> Result<CloudResource>;

    /// Delete a topic.
    async fn delete_topic(&self, region: &str, id: &str) -> Result<()>;
}

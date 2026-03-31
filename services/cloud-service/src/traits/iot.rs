use async_trait::async_trait;

use crate::error::CloudError;
use crate::models::CloudResource;

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait IoTProvider: Send + Sync {
    /// List all IoT things in a region.
    async fn list_things(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get a specific IoT thing by name.
    async fn get_thing(&self, region: &str, name: &str) -> Result<CloudResource>;

    /// Create a new IoT thing.
    async fn create_thing(
        &self,
        region: &str,
        name: &str,
        attributes: serde_json::Value,
    ) -> Result<CloudResource>;

    /// Delete an IoT thing.
    async fn delete_thing(&self, region: &str, name: &str) -> Result<()>;

    /// List all IoT thing groups in a region.
    async fn list_thing_groups(&self, region: &str) -> Result<Vec<CloudResource>>;
}

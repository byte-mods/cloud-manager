use async_trait::async_trait;

use crate::error::CloudError;
use crate::models::{CloudResource, CreateInstanceRequest};

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait ComputeProvider: Send + Sync {
    /// List all compute instances in a given region.
    async fn list_instances(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get a specific compute instance by ID.
    async fn get_instance(&self, region: &str, id: &str) -> Result<CloudResource>;

    /// Create a new compute instance.
    async fn create_instance(
        &self,
        region: &str,
        config: CreateInstanceRequest,
    ) -> Result<CloudResource>;

    /// Delete a compute instance.
    async fn delete_instance(&self, region: &str, id: &str) -> Result<()>;

    /// Start a stopped compute instance.
    async fn start_instance(&self, region: &str, id: &str) -> Result<()>;

    /// Stop a running compute instance.
    async fn stop_instance(&self, region: &str, id: &str) -> Result<()>;

    /// Reboot a compute instance.
    async fn reboot_instance(&self, region: &str, id: &str) -> Result<()>;
}

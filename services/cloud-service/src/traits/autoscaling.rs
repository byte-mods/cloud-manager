use async_trait::async_trait;
use crate::error::CloudError;
use crate::models::CloudResource;

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait AutoScalingProvider: Send + Sync {
    /// List all auto-scaling groups (ASG, MIG, VMSS).
    async fn list_groups(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get a specific auto-scaling group.
    async fn get_group(&self, region: &str, id: &str) -> Result<CloudResource>;

    /// Create a new auto-scaling group.
    async fn create_group(
        &self,
        region: &str,
        name: &str,
        min_size: u32,
        max_size: u32,
        desired: u32,
    ) -> Result<CloudResource>;

    /// Delete an auto-scaling group.
    async fn delete_group(&self, region: &str, id: &str) -> Result<()>;

    /// Update the desired capacity.
    async fn set_desired_capacity(&self, region: &str, id: &str, desired: u32) -> Result<()>;
}

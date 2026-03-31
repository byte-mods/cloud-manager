use async_trait::async_trait;

use crate::error::CloudError;
use crate::models::CloudResource;

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait VolumeProvider: Send + Sync {
    /// List all volumes.
    async fn list_volumes(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Create a new volume.
    async fn create_volume(&self, region: &str, size_gb: i32, volume_type: &str, az: &str) -> Result<CloudResource>;

    /// Attach a volume to an instance.
    async fn attach_volume(&self, region: &str, volume_id: &str, instance_id: &str, device: &str) -> Result<()>;

    /// Detach a volume from an instance.
    async fn detach_volume(&self, region: &str, volume_id: &str) -> Result<()>;

    /// Delete a volume.
    async fn delete_volume(&self, region: &str, id: &str) -> Result<()>;

    /// Create a snapshot of a volume.
    async fn create_volume_snapshot(&self, region: &str, volume_id: &str, name: &str) -> Result<CloudResource>;
}

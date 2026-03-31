use async_trait::async_trait;
use crate::error::CloudError;
use crate::models::CloudResource;

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait KmsProvider: Send + Sync {
    /// List all encryption keys (KMS, Cloud KMS, Azure Key Vault).
    async fn list_keys(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get a specific key.
    async fn get_key(&self, region: &str, id: &str) -> Result<CloudResource>;

    /// Create a new encryption key.
    async fn create_key(&self, region: &str, name: &str, key_type: &str) -> Result<CloudResource>;

    /// Schedule key deletion.
    async fn schedule_key_deletion(&self, region: &str, id: &str) -> Result<()>;

    /// Enable/disable a key.
    async fn set_key_enabled(&self, region: &str, id: &str, enabled: bool) -> Result<()>;
}

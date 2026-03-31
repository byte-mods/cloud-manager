use async_trait::async_trait;

use crate::error::CloudError;
use crate::models::CloudResource;

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait MlProvider: Send + Sync {
    /// List all ML models in a region.
    async fn list_models(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// List all ML endpoints in a region.
    async fn list_endpoints(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// List all ML training jobs in a region.
    async fn list_training_jobs(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Create a new ML endpoint.
    async fn create_endpoint(
        &self,
        region: &str,
        name: &str,
        model_name: &str,
    ) -> Result<CloudResource>;

    /// Delete an ML endpoint.
    async fn delete_endpoint(&self, region: &str, name: &str) -> Result<()>;
}

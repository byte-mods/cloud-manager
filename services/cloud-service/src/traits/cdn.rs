use async_trait::async_trait;

use crate::error::CloudError;
use crate::models::{CloudResource, CreateDistributionRequest};

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait CdnProvider: Send + Sync {
    /// List all CDN distributions in a region.
    async fn list_distributions(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get a specific CDN distribution by ID.
    async fn get_distribution(&self, region: &str, id: &str) -> Result<CloudResource>;

    /// Create a new CDN distribution.
    async fn create_distribution(&self, region: &str, config: CreateDistributionRequest) -> Result<CloudResource>;

    /// Delete a CDN distribution.
    async fn delete_distribution(&self, region: &str, id: &str) -> Result<()>;

    /// Invalidate cached paths in a distribution.
    async fn invalidate_cache(&self, region: &str, distribution_id: &str, paths: Vec<String>) -> Result<()>;
}

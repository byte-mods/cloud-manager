use async_trait::async_trait;

use crate::error::CloudError;
use crate::models::CloudResource;

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait CacheDbProvider: Send + Sync {
    /// List all cache clusters in a region.
    async fn list_clusters(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get a specific cache cluster by ID.
    async fn get_cluster(&self, region: &str, id: &str) -> Result<CloudResource>;

    /// Create a new cache cluster.
    async fn create_cluster(
        &self,
        region: &str,
        name: &str,
        engine: &str,
        node_type: &str,
    ) -> Result<CloudResource>;

    /// Delete a cache cluster.
    async fn delete_cluster(&self, region: &str, id: &str) -> Result<()>;
}

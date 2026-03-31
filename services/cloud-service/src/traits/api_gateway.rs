use async_trait::async_trait;

use crate::error::CloudError;
use crate::models::CloudResource;

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait ApiGatewayProvider: Send + Sync {
    /// List all APIs in a region.
    async fn list_apis(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get a specific API by ID.
    async fn get_api(&self, region: &str, id: &str) -> Result<CloudResource>;

    /// Create a new API.
    async fn create_api(&self, region: &str, name: &str, protocol: &str) -> Result<CloudResource>;

    /// Delete an API.
    async fn delete_api(&self, region: &str, id: &str) -> Result<()>;

    /// List routes for an API.
    async fn list_routes(&self, region: &str, api_id: &str) -> Result<Vec<CloudResource>>;

    /// Create a route for an API.
    async fn create_route(&self, region: &str, api_id: &str, method: &str, path: &str) -> Result<CloudResource>;

    /// List stages for an API.
    async fn list_stages(&self, region: &str, api_id: &str) -> Result<Vec<CloudResource>>;

    /// Create a stage for an API.
    async fn create_stage(&self, region: &str, api_id: &str, name: &str) -> Result<CloudResource>;
}

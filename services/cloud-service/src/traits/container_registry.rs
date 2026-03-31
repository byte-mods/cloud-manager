use async_trait::async_trait;
use crate::error::CloudError;
use crate::models::CloudResource;

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait ContainerRegistryProvider: Send + Sync {
    /// List all container registries (ECR, Artifact Registry, ACR).
    async fn list_registries(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get a specific registry.
    async fn get_registry(&self, region: &str, id: &str) -> Result<CloudResource>;

    /// Create a new container registry/repository.
    async fn create_registry(&self, region: &str, name: &str) -> Result<CloudResource>;

    /// Delete a container registry.
    async fn delete_registry(&self, region: &str, id: &str) -> Result<()>;

    /// List images in a registry.
    async fn list_images(&self, region: &str, registry: &str) -> Result<Vec<CloudResource>>;

    /// Get image scan results for a specific image tag in a registry.
    async fn get_image_scan_results(&self, region: &str, registry: &str, image_tag: &str) -> Result<serde_json::Value>;

    /// Start an image scan for a specific image tag in a registry.
    async fn start_image_scan(&self, region: &str, registry: &str, image_tag: &str) -> Result<()>;
}

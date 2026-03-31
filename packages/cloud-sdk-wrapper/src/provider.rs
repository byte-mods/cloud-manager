use async_trait::async_trait;
use crate::error::CloudError;
use crate::types::{CloudResource, ResourceList, ListOptions};

#[async_trait]
pub trait CloudProvider: Send + Sync {
    fn name(&self) -> &str;

    // Compute
    async fn list_instances(&self, opts: &ListOptions) -> Result<ResourceList, CloudError>;
    async fn get_instance(&self, id: &str, region: &str) -> Result<CloudResource, CloudError>;
    async fn start_instance(&self, id: &str, region: &str) -> Result<(), CloudError>;
    async fn stop_instance(&self, id: &str, region: &str) -> Result<(), CloudError>;

    // Storage
    async fn list_buckets(&self, opts: &ListOptions) -> Result<ResourceList, CloudError>;
    async fn list_volumes(&self, opts: &ListOptions) -> Result<ResourceList, CloudError>;

    // Networking
    async fn list_vpcs(&self, opts: &ListOptions) -> Result<ResourceList, CloudError>;
    async fn list_subnets(&self, vpc_id: &str, region: &str) -> Result<ResourceList, CloudError>;

    // Database
    async fn list_databases(&self, opts: &ListOptions) -> Result<ResourceList, CloudError>;
}

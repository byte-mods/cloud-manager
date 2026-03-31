use async_trait::async_trait;
use crate::error::CloudError;
use crate::provider::CloudProvider;
use crate::types::{CloudResource, ResourceList, ListOptions};

pub struct AzureProvider {
    subscription_id: String,
}

impl AzureProvider {
    pub fn new(subscription_id: &str) -> Self {
        Self { subscription_id: subscription_id.to_string() }
    }
}

#[async_trait]
impl CloudProvider for AzureProvider {
    fn name(&self) -> &str { "azure" }
    async fn list_instances(&self, _opts: &ListOptions) -> Result<ResourceList, CloudError> { Ok(ResourceList { resources: vec![], total: 0, next_token: None }) }
    async fn get_instance(&self, _id: &str, _region: &str) -> Result<CloudResource, CloudError> { Err(CloudError::NotFound("Not found".into())) }
    async fn start_instance(&self, _id: &str, _region: &str) -> Result<(), CloudError> { Ok(()) }
    async fn stop_instance(&self, _id: &str, _region: &str) -> Result<(), CloudError> { Ok(()) }
    async fn list_buckets(&self, _opts: &ListOptions) -> Result<ResourceList, CloudError> { Ok(ResourceList { resources: vec![], total: 0, next_token: None }) }
    async fn list_volumes(&self, _opts: &ListOptions) -> Result<ResourceList, CloudError> { Ok(ResourceList { resources: vec![], total: 0, next_token: None }) }
    async fn list_vpcs(&self, _opts: &ListOptions) -> Result<ResourceList, CloudError> { Ok(ResourceList { resources: vec![], total: 0, next_token: None }) }
    async fn list_subnets(&self, _vpc_id: &str, _region: &str) -> Result<ResourceList, CloudError> { Ok(ResourceList { resources: vec![], total: 0, next_token: None }) }
    async fn list_databases(&self, _opts: &ListOptions) -> Result<ResourceList, CloudError> { Ok(ResourceList { resources: vec![], total: 0, next_token: None }) }
}

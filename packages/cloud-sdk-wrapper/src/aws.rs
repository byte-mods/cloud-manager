use async_trait::async_trait;
use crate::error::CloudError;
use crate::provider::CloudProvider;
use crate::types::{CloudResource, ResourceList, ListOptions};

pub struct AwsProvider {
    region: String,
}

impl AwsProvider {
    pub fn new(region: &str) -> Self {
        Self { region: region.to_string() }
    }
}

#[async_trait]
impl CloudProvider for AwsProvider {
    fn name(&self) -> &str { "aws" }

    async fn list_instances(&self, _opts: &ListOptions) -> Result<ResourceList, CloudError> {
        // Delegates to aws-sdk-ec2 in real implementation
        Ok(ResourceList { resources: vec![], total: 0, next_token: None })
    }

    async fn get_instance(&self, _id: &str, _region: &str) -> Result<CloudResource, CloudError> {
        Err(CloudError::NotFound("Instance not found".into()))
    }

    async fn start_instance(&self, _id: &str, _region: &str) -> Result<(), CloudError> { Ok(()) }
    async fn stop_instance(&self, _id: &str, _region: &str) -> Result<(), CloudError> { Ok(()) }

    async fn list_buckets(&self, _opts: &ListOptions) -> Result<ResourceList, CloudError> {
        Ok(ResourceList { resources: vec![], total: 0, next_token: None })
    }

    async fn list_volumes(&self, _opts: &ListOptions) -> Result<ResourceList, CloudError> {
        Ok(ResourceList { resources: vec![], total: 0, next_token: None })
    }

    async fn list_vpcs(&self, _opts: &ListOptions) -> Result<ResourceList, CloudError> {
        Ok(ResourceList { resources: vec![], total: 0, next_token: None })
    }

    async fn list_subnets(&self, _vpc_id: &str, _region: &str) -> Result<ResourceList, CloudError> {
        Ok(ResourceList { resources: vec![], total: 0, next_token: None })
    }

    async fn list_databases(&self, _opts: &ListOptions) -> Result<ResourceList, CloudError> {
        Ok(ResourceList { resources: vec![], total: 0, next_token: None })
    }
}

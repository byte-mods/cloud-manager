use async_trait::async_trait;
use chrono::Utc;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::error::CloudError;
use crate::models::*;
use crate::providers::store::InMemoryStore;
use crate::traits::compute::Result;
use crate::traits::{ApiGatewayProvider, AutoScalingProvider, CacheDbProvider, CdnProvider, ComputeProvider, ContainerRegistryProvider, DatabaseProvider, DnsProvider, IamProvider, IoTProvider, KmsProvider, KubernetesProvider, MessagingProvider, MlProvider, NetworkingProvider, NoSqlProvider, ServerlessProvider, StorageProvider, TrafficProvider, VolumeProvider, WafProvider, WorkflowProvider};

/// AWS cloud provider backed by InMemoryStore.
pub struct AwsProvider {
    pub provider: CloudProvider,
    pub store: Arc<InMemoryStore>,
}

impl AwsProvider {
    pub fn new(provider: CloudProvider, store: Arc<InMemoryStore>) -> Self {
        Self { provider, store }
    }

    fn make_resource(
        &self,
        resource_type: ResourceType,
        name: &str,
        region: &str,
        status: ResourceStatus,
        metadata: serde_json::Value,
        tags: HashMap<String, String>,
    ) -> CloudResource {
        let now = Utc::now();
        CloudResource {
            id: Uuid::new_v4(),
            cloud_id: None,
            provider: self.provider,
            resource_type,
            name: name.to_string(),
            region: region.to_string(),
            status,
            metadata,
            tags,
            created_at: now,
            updated_at: now,
        }
    }
}

#[async_trait]
impl ComputeProvider for AwsProvider {
    async fn list_instances(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing EC2 instances");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Instance)))
    }

    async fn get_instance(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, id = id, "Getting EC2 instance");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::Instance)
            .ok_or_else(|| CloudError::NotFound(format!("AWS EC2 instance {} not found in {}", id, region)))
    }

    async fn create_instance(
        &self,
        region: &str,
        config: CreateInstanceRequest,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = config.name.as_str(), "Creating EC2 instance");
        let resource = self.make_resource(
            ResourceType::Instance,
            &config.name,
            region,
            ResourceStatus::Running,
            serde_json::json!({
                "instance_type": config.instance_type,
                "image_id": config.image_id,
                "subnet_id": config.subnet_id,
                "security_group_ids": config.security_group_ids,
                "key_pair": config.key_pair,
                "user_data": config.user_data,
            }),
            config.tags,
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_instance(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Terminating EC2 instance");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("AWS EC2 instance {} not found", id)))
        }
    }

    async fn start_instance(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Starting EC2 instance");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.update_status(uuid, ResourceStatus::Running) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("AWS EC2 instance {} not found", id)))
        }
    }

    async fn stop_instance(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Stopping EC2 instance");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.update_status(uuid, ResourceStatus::Stopped) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("AWS EC2 instance {} not found", id)))
        }
    }

    async fn reboot_instance(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Rebooting EC2 instance");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.update_status(uuid, ResourceStatus::Running) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("AWS EC2 instance {} not found", id)))
        }
    }
}

#[async_trait]
impl StorageProvider for AwsProvider {
    async fn list_buckets(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing S3 buckets");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Bucket)))
    }

    async fn get_bucket(&self, region: &str, name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = name, "Getting S3 bucket");
        // Try UUID first, then name
        if let Ok(uuid) = Uuid::parse_str(name) {
            if let Some(r) = self.store.get(uuid).filter(|r| r.provider == self.provider && r.resource_type == ResourceType::Bucket) {
                return Ok(r);
            }
        }
        self.store
            .get_by_name(name, self.provider, ResourceType::Bucket)
            .ok_or_else(|| CloudError::NotFound(format!("AWS S3 bucket {} not found", name)))
    }

    async fn create_bucket(
        &self,
        region: &str,
        config: CreateBucketRequest,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = config.name.as_str(), "Creating S3 bucket");
        let resource = self.make_resource(
            ResourceType::Bucket,
            &config.name,
            region,
            ResourceStatus::Available,
            serde_json::json!({
                "versioning": config.versioning,
                "encryption": if config.encryption { "AES256" } else { "none" },
                "public_access": config.public_access,
                "storage_class": "STANDARD",
                "object_count": 0,
                "total_size_bytes": 0,
            }),
            config.tags,
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_bucket(&self, region: &str, name: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, name = name, "Deleting S3 bucket");
        // Try UUID first, then name
        if let Ok(uuid) = Uuid::parse_str(name) {
            if self.store.delete(uuid) {
                return Ok(());
            }
        }
        if let Some(r) = self.store.get_by_name(name, self.provider, ResourceType::Bucket) {
            self.store.delete(r.id);
            return Ok(());
        }
        Err(CloudError::NotFound(format!("AWS S3 bucket {} not found", name)))
    }

    async fn list_objects(
        &self,
        region: &str,
        bucket: &str,
        prefix: Option<&str>,
    ) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, bucket = bucket, prefix = ?prefix, "Listing S3 objects");
        // Return sample objects for known buckets
        let now = Utc::now();
        let prefix_str = prefix.unwrap_or("");
        let sample_objects = vec![
            CloudResource {
                id: Uuid::new_v4(),
                cloud_id: None,
                provider: self.provider,
                resource_type: ResourceType::Bucket,
                name: format!("{}index.html", prefix_str),
                region: region.to_string(),
                status: ResourceStatus::Available,
                metadata: serde_json::json!({"bucket": bucket, "content_type": "text/html", "size_bytes": 4096, "storage_class": "STANDARD"}),
                tags: HashMap::new(),
                created_at: now,
                updated_at: now,
            },
            CloudResource {
                id: Uuid::new_v4(),
                cloud_id: None,
                provider: self.provider,
                resource_type: ResourceType::Bucket,
                name: format!("{}data/config.json", prefix_str),
                region: region.to_string(),
                status: ResourceStatus::Available,
                metadata: serde_json::json!({"bucket": bucket, "content_type": "application/json", "size_bytes": 1024, "storage_class": "STANDARD"}),
                tags: HashMap::new(),
                created_at: now,
                updated_at: now,
            },
            CloudResource {
                id: Uuid::new_v4(),
                cloud_id: None,
                provider: self.provider,
                resource_type: ResourceType::Bucket,
                name: format!("{}images/logo.png", prefix_str),
                region: region.to_string(),
                status: ResourceStatus::Available,
                metadata: serde_json::json!({"bucket": bucket, "content_type": "image/png", "size_bytes": 52428, "storage_class": "STANDARD"}),
                tags: HashMap::new(),
                created_at: now,
                updated_at: now,
            },
        ];
        Ok(sample_objects)
    }

    async fn upload_object(
        &self,
        region: &str,
        bucket: &str,
        request: UploadObjectRequest,
        _data: Vec<u8>,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, bucket = bucket, key = request.key.as_str(), "Uploading S3 object");
        let resource = self.make_resource(
            ResourceType::Bucket,
            &request.key,
            region,
            ResourceStatus::Available,
            serde_json::json!({
                "bucket": bucket,
                "content_type": request.content_type,
                "size_bytes": _data.len(),
                "storage_class": "STANDARD",
            }),
            request.metadata,
        );
        Ok(resource)
    }

    async fn delete_object(
        &self,
        region: &str,
        bucket: &str,
        key: &str,
    ) -> Result<()> {
        tracing::info!(provider = "aws", region = region, bucket = bucket, key = key, "Deleting S3 object");
        Ok(())
    }

    async fn get_bucket_policy(&self, _region: &str, bucket: &str) -> Result<serde_json::Value> {
        Ok(serde_json::json!({
            "Version": "2012-10-17",
            "Statement": [{
                "Sid": "MockPolicy",
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": format!("arn:aws:s3:::{}/*", bucket)
            }]
        }))
    }

    async fn put_bucket_policy(&self, _region: &str, _bucket: &str, _policy: &str) -> Result<()> {
        Ok(())
    }

    async fn delete_bucket_policy(&self, _region: &str, _bucket: &str) -> Result<()> {
        Ok(())
    }

    async fn get_lifecycle_rules(&self, _region: &str, _bucket: &str) -> Result<Vec<serde_json::Value>> {
        Ok(vec![serde_json::json!({
            "id": "mock-rule",
            "status": "Enabled",
            "prefix": "",
            "expiration_days": 90
        })])
    }

    async fn put_lifecycle_rules(&self, _region: &str, _bucket: &str, _rules: Vec<serde_json::Value>) -> Result<()> {
        Ok(())
    }

    async fn get_bucket_encryption(&self, _region: &str, _bucket: &str) -> Result<serde_json::Value> {
        Ok(serde_json::json!({
            "rules": [{ "sse_algorithm": "AES256" }]
        }))
    }

    async fn put_bucket_encryption(&self, _region: &str, _bucket: &str, _enabled: bool) -> Result<()> {
        Ok(())
    }

    async fn get_cors_rules(&self, _region: &str, _bucket: &str) -> Result<serde_json::Value> {
        Ok(serde_json::json!({"cors_rules": []}))
    }

    async fn put_cors_rules(&self, _region: &str, _bucket: &str, _rules: serde_json::Value) -> Result<()> {
        Ok(())
    }
}

#[async_trait]
impl NetworkingProvider for AwsProvider {
    async fn list_vpcs(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing VPCs");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Vpc)))
    }

    async fn get_vpc(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, id = id, "Getting VPC");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::Vpc)
            .ok_or_else(|| CloudError::NotFound(format!("AWS VPC {} not found in {}", id, region)))
    }

    async fn create_vpc(
        &self,
        region: &str,
        config: CreateVpcRequest,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = config.name.as_str(), "Creating VPC");
        let resource = self.make_resource(
            ResourceType::Vpc,
            &config.name,
            region,
            ResourceStatus::Available,
            serde_json::json!({
                "cidr_block": config.cidr_block,
                "enable_dns": config.enable_dns,
                "is_default": false,
            }),
            config.tags,
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_vpc(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Deleting VPC");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("AWS VPC {} not found", id)))
        }
    }

    async fn list_subnets(&self, region: &str, vpc_id: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, vpc_id = vpc_id, "Listing subnets");
        Ok(self.store.list_subnets_for_vpc(self.provider, region, vpc_id))
    }

    async fn create_subnet(
        &self,
        region: &str,
        config: CreateSubnetRequest,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = config.name.as_str(), "Creating subnet");
        let resource = self.make_resource(
            ResourceType::Subnet,
            &config.name,
            region,
            ResourceStatus::Available,
            serde_json::json!({
                "cidr_block": config.cidr_block,
                "vpc_id": config.vpc_id,
                "availability_zone": config.availability_zone,
                "is_public": config.is_public,
            }),
            config.tags,
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_subnet(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Deleting subnet");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("AWS subnet {} not found", id)))
        }
    }

    async fn list_load_balancers(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing load balancers");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::LoadBalancer)))
    }

    async fn get_load_balancer(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, id = id, "Getting load balancer");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::LoadBalancer)
            .ok_or_else(|| CloudError::NotFound(format!("AWS load balancer {} not found in {}", id, region)))
    }

    async fn delete_load_balancer(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Deleting load balancer");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("AWS load balancer {} not found", id)))
        }
    }

    async fn list_security_groups(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing security groups");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::SecurityGroup)))
    }

    // --- Elastic IPs ---

    async fn list_elastic_ips(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing elastic IPs");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::ElasticIp)))
    }

    async fn allocate_elastic_ip(&self, region: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, "Allocating elastic IP");
        let resource = self.make_resource(
            ResourceType::ElasticIp,
            "eip-mock",
            region,
            ResourceStatus::Available,
            serde_json::json!({"allocation_id": format!("eipalloc-{}", Uuid::new_v4().simple()), "public_ip": "203.0.113.1", "domain": "vpc"}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn associate_elastic_ip(&self, region: &str, eip_id: &str, instance_id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, eip_id = eip_id, instance_id = instance_id, "Associating elastic IP");
        Ok(())
    }

    async fn disassociate_elastic_ip(&self, region: &str, association_id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, association_id = association_id, "Disassociating elastic IP");
        Ok(())
    }

    async fn release_elastic_ip(&self, region: &str, allocation_id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, allocation_id = allocation_id, "Releasing elastic IP");
        Ok(())
    }

    // --- NAT Gateway ---

    async fn list_nat_gateways(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing NAT gateways");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::NatGateway)))
    }

    async fn create_nat_gateway(&self, region: &str, subnet_id: &str, eip_allocation_id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, subnet_id = subnet_id, "Creating NAT gateway");
        let resource = self.make_resource(
            ResourceType::NatGateway,
            "nat-mock",
            region,
            ResourceStatus::Available,
            serde_json::json!({"subnet_id": subnet_id, "eip_allocation_id": eip_allocation_id}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_nat_gateway(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Deleting NAT gateway");
        let uuid = Uuid::parse_str(id).map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store.delete(uuid);
        Ok(())
    }

    // --- Internet Gateway ---

    async fn list_internet_gateways(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing internet gateways");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::InternetGateway)))
    }

    async fn create_internet_gateway(&self, region: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, "Creating internet gateway");
        let resource = self.make_resource(
            ResourceType::InternetGateway,
            "igw-mock",
            region,
            ResourceStatus::Available,
            serde_json::json!({"attachments": []}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn attach_internet_gateway(&self, region: &str, igw_id: &str, vpc_id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, igw_id = igw_id, vpc_id = vpc_id, "Attaching internet gateway");
        Ok(())
    }

    async fn detach_internet_gateway(&self, region: &str, igw_id: &str, vpc_id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, igw_id = igw_id, vpc_id = vpc_id, "Detaching internet gateway");
        Ok(())
    }

    async fn delete_internet_gateway(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Deleting internet gateway");
        let uuid = Uuid::parse_str(id).map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store.delete(uuid);
        Ok(())
    }

    // --- Route Tables ---

    async fn list_route_tables(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing route tables");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::RouteTable)))
    }

    async fn create_route_table(&self, region: &str, vpc_id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, vpc_id = vpc_id, "Creating route table");
        let resource = self.make_resource(
            ResourceType::RouteTable,
            "rtb-mock",
            region,
            ResourceStatus::Available,
            serde_json::json!({"vpc_id": vpc_id, "routes": [], "associations": []}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn add_route(&self, region: &str, route_table_id: &str, destination_cidr: &str, target_id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, route_table_id = route_table_id, destination_cidr = destination_cidr, target_id = target_id, "Adding route");
        Ok(())
    }

    async fn delete_route(&self, region: &str, route_table_id: &str, destination_cidr: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, route_table_id = route_table_id, destination_cidr = destination_cidr, "Deleting route");
        Ok(())
    }

    async fn associate_route_table(&self, region: &str, route_table_id: &str, subnet_id: &str) -> Result<String> {
        tracing::info!(provider = "aws", region = region, route_table_id = route_table_id, subnet_id = subnet_id, "Associating route table");
        Ok(format!("rtbassoc-mock-{}", Uuid::new_v4().simple()))
    }

    async fn delete_route_table(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Deleting route table");
        let uuid = Uuid::parse_str(id).map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store.delete(uuid);
        Ok(())
    }

    // --- Security Group CRUD ---

    async fn create_security_group(&self, region: &str, name: &str, description: &str, vpc_id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = name, "Creating security group");
        let resource = self.make_resource(
            ResourceType::SecurityGroup,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({"description": description, "vpc_id": vpc_id, "inbound_rules": [], "outbound_rules_count": 0}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn add_security_group_rule(&self, region: &str, sg_id: &str, rule: SecurityGroupRule) -> Result<()> {
        tracing::info!(provider = "aws", region = region, sg_id = sg_id, direction = rule.direction.as_str(), "Adding security group rule");
        Ok(())
    }

    async fn remove_security_group_rule(&self, region: &str, sg_id: &str, rule: SecurityGroupRule) -> Result<()> {
        tracing::info!(provider = "aws", region = region, sg_id = sg_id, direction = rule.direction.as_str(), "Removing security group rule");
        Ok(())
    }

    async fn delete_security_group(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Deleting security group");
        let uuid = Uuid::parse_str(id).map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store.delete(uuid);
        Ok(())
    }

    // --- VPC Peering ---

    async fn list_vpc_peering_connections(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing VPC peering connections");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::VpcPeering)))
    }

    async fn create_vpc_peering(&self, region: &str, vpc_id: &str, peer_vpc_id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, vpc_id = vpc_id, peer_vpc_id = peer_vpc_id, "Creating VPC peering connection");
        let resource = self.make_resource(
            ResourceType::VpcPeering,
            "pcx-mock",
            region,
            ResourceStatus::Pending,
            serde_json::json!({"requester_vpc_id": vpc_id, "accepter_vpc_id": peer_vpc_id}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn accept_vpc_peering(&self, region: &str, peering_id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, peering_id = peering_id, "Accepting VPC peering connection");
        Ok(())
    }

    async fn delete_vpc_peering(&self, region: &str, peering_id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, peering_id = peering_id, "Deleting VPC peering connection");
        let uuid = Uuid::parse_str(peering_id).map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", peering_id)))?;
        self.store.delete(uuid);
        Ok(())
    }
}

#[async_trait]
impl DatabaseProvider for AwsProvider {
    async fn list_databases(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing RDS instances");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Database)))
    }

    async fn get_database(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, id = id, "Getting RDS instance");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::Database)
            .ok_or_else(|| CloudError::NotFound(format!("AWS RDS instance {} not found in {}", id, region)))
    }

    async fn create_database(
        &self,
        region: &str,
        config: CreateDatabaseRequest,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = config.name.as_str(), "Creating RDS instance");
        let resource = self.make_resource(
            ResourceType::Database,
            &config.name,
            region,
            ResourceStatus::Running,
            serde_json::json!({
                "engine": config.engine,
                "engine_version": config.engine_version,
                "instance_class": config.instance_class,
                "storage_gb": config.storage_gb,
                "multi_az": config.multi_az,
                "endpoint": format!("{}.abc123.{}.rds.amazonaws.com", config.name, region),
            }),
            config.tags,
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_database(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Deleting RDS instance");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("AWS RDS instance {} not found", id)))
        }
    }

    async fn restart_database(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Restarting RDS instance");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.update_status(uuid, ResourceStatus::Running) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("AWS RDS instance {} not found", id)))
        }
    }

    async fn create_snapshot(
        &self,
        region: &str,
        db_id: &str,
        snapshot_name: &str,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, db_id = db_id, snapshot_name = snapshot_name, "Creating RDS snapshot");
        let resource = self.make_resource(
            ResourceType::Snapshot,
            snapshot_name,
            region,
            ResourceStatus::Available,
            serde_json::json!({
                "source_db_id": db_id,
                "snapshot_type": "manual",
            }),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn create_read_replica(&self, region: &str, source_db_id: &str, replica_name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, source_db_id = source_db_id, replica_name = replica_name, "Creating RDS read replica (mock)");
        let resource = self.make_resource(ResourceType::Database, replica_name, region, ResourceStatus::Creating,
            serde_json::json!({"source_db_id": source_db_id, "role": "read_replica"}), HashMap::new());
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn list_parameter_groups(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing RDS parameter groups (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::ParameterGroup)))
    }

    async fn get_parameter_group(&self, _region: &str, name: &str) -> Result<serde_json::Value> {
        Ok(serde_json::json!({"name": name, "family": "mysql8.0", "description": "Mock parameter group"}))
    }

    async fn restore_to_point_in_time(&self, region: &str, source_db_id: &str, target_name: &str, restore_time: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, "Restoring RDS to point in time (mock)");
        let resource = self.make_resource(ResourceType::Database, target_name, region, ResourceStatus::Creating,
            serde_json::json!({"source_db_id": source_db_id, "restore_time": restore_time, "restore_type": "point_in_time"}), HashMap::new());
        self.store.insert(resource.clone());
        Ok(resource)
    }
}

// ---------------------------------------------------------------------------
// Kubernetes (EKS) — mock implementation
// ---------------------------------------------------------------------------

#[async_trait]
impl KubernetesProvider for AwsProvider {
    async fn list_clusters(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing EKS clusters (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::EksCluster)))
    }

    async fn get_cluster(&self, region: &str, name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = name, "Getting EKS cluster (mock)");
        self.store
            .list(self.provider, Some(region), Some(ResourceType::EksCluster))
            .into_iter()
            .find(|r| r.name == name)
            .ok_or_else(|| CloudError::NotFound(format!("EKS cluster {} not found in {}", name, region)))
    }

    async fn create_cluster(&self, region: &str, config: CreateClusterRequest) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = config.name.as_str(), "Creating EKS cluster (mock)");
        let resource = self.make_resource(
            ResourceType::EksCluster,
            &config.name,
            region,
            ResourceStatus::Creating,
            serde_json::json!({
                "version": config.version.unwrap_or_else(|| "1.29".to_string()),
                "role_arn": config.role_arn,
                "subnet_ids": config.subnet_ids,
                "security_group_ids": config.security_group_ids,
                "platform": "eks",
            }),
            config.tags,
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_cluster(&self, region: &str, name: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, name = name, "Deleting EKS cluster (mock)");
        let cluster = KubernetesProvider::get_cluster(self, region, name).await?;
        self.store.delete(cluster.id);
        Ok(())
    }

    async fn list_node_groups(&self, region: &str, cluster_name: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, cluster = cluster_name, "Listing EKS node groups (mock)");
        Ok(self
            .store
            .list(self.provider, Some(region), Some(ResourceType::EksNodeGroup))
            .into_iter()
            .filter(|r| {
                r.metadata
                    .get("cluster_name")
                    .and_then(|v| v.as_str())
                    .map(|v| v == cluster_name)
                    .unwrap_or(false)
            })
            .collect())
    }

    async fn create_node_group(
        &self,
        region: &str,
        cluster_name: &str,
        config: CreateNodeGroupRequest,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, cluster = cluster_name, name = config.name.as_str(), "Creating EKS node group (mock)");
        let resource = self.make_resource(
            ResourceType::EksNodeGroup,
            &config.name,
            region,
            ResourceStatus::Creating,
            serde_json::json!({
                "cluster_name": cluster_name,
                "node_role_arn": config.node_role_arn,
                "subnet_ids": config.subnet_ids,
                "instance_types": config.instance_types,
                "desired_size": config.desired_size,
                "min_size": config.min_size,
                "max_size": config.max_size,
                "disk_size": config.disk_size,
                "labels": config.labels,
            }),
            config.tags,
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_node_group(
        &self,
        region: &str,
        cluster_name: &str,
        node_group_name: &str,
    ) -> Result<()> {
        tracing::info!(provider = "aws", region = region, cluster = cluster_name, ng = node_group_name, "Deleting EKS node group (mock)");
        let groups = self.list_node_groups(region, cluster_name).await?;
        if let Some(ng) = groups.into_iter().find(|r| r.name == node_group_name) {
            self.store.delete(ng.id);
            Ok(())
        } else {
            Err(CloudError::NotFound(format!(
                "Node group {} not found in cluster {}",
                node_group_name, cluster_name
            )))
        }
    }

    async fn scale_node_group(
        &self,
        region: &str,
        cluster_name: &str,
        node_group_name: &str,
        desired: i32,
    ) -> Result<()> {
        tracing::info!(
            provider = "aws", region = region, cluster = cluster_name,
            ng = node_group_name, desired = desired,
            "Scaling EKS node group (mock)"
        );
        // In the mock we just log; real impl would call update_nodegroup_config
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Traffic / Flow Logs — mock implementation
// ---------------------------------------------------------------------------

#[async_trait]
impl TrafficProvider for AwsProvider {
    async fn get_flow_logs(
        &self,
        region: &str,
        _log_group: Option<&str>,
        _start_time: Option<i64>,
        _end_time: Option<i64>,
    ) -> Result<FlowLogResponse> {
        tracing::info!(provider = "aws", region = region, "Fetching VPC flow logs (mock)");
        let now = Utc::now().to_rfc3339();
        Ok(FlowLogResponse {
            entries: vec![
                FlowLogEntry { src_addr: "10.0.1.15".into(), dst_addr: "10.0.2.45".into(), total_bytes: 524_288, total_packets: 412, timestamp: now.clone() },
                FlowLogEntry { src_addr: "10.0.2.45".into(), dst_addr: "10.0.1.15".into(), total_bytes: 1_048_576, total_packets: 823, timestamp: now.clone() },
                FlowLogEntry { src_addr: "10.0.1.22".into(), dst_addr: "52.94.236.248".into(), total_bytes: 262_144, total_packets: 206, timestamp: now.clone() },
                FlowLogEntry { src_addr: "10.0.3.10".into(), dst_addr: "10.0.1.15".into(), total_bytes: 786_432, total_packets: 617, timestamp: now },
            ],
            query_id: Some("mock-query-001".into()),
        })
    }

    async fn get_traffic_summary(&self, region: &str) -> Result<TrafficSummary> {
        tracing::info!(provider = "aws", region = region, "Building traffic summary (mock)");
        let now = Utc::now().to_rfc3339();
        Ok(TrafficSummary {
            total_bytes_in: 12_582_912,
            total_bytes_out: 8_388_608,
            total_requests: 14_200,
            total_errors: 37,
            top_talkers: vec![
                TopTalker { ip: "10.0.1.15".into(), bytes: 4_194_304, packets: 3_290, direction: "inbound".into() },
                TopTalker { ip: "10.0.2.45".into(), bytes: 3_145_728, packets: 2_470, direction: "outbound".into() },
                TopTalker { ip: "10.0.3.10".into(), bytes: 2_097_152, packets: 1_647, direction: "inbound".into() },
            ],
            per_service: vec![
                ServiceTraffic { service_id: "web-server-1".into(), service_name: "EC2 web-server-1".into(), bytes_in: 4_194_304, bytes_out: 2_097_152, requests: 5_200, errors: 12 },
                ServiceTraffic { service_id: "api-server-1".into(), service_name: "EC2 api-server-1".into(), bytes_in: 3_145_728, bytes_out: 3_145_728, requests: 4_800, errors: 8 },
                ServiceTraffic { service_id: "rds-postgres".into(), service_name: "RDS PostgreSQL".into(), bytes_in: 2_621_440, bytes_out: 1_048_576, requests: 2_100, errors: 5 },
                ServiceTraffic { service_id: "elasticache-redis".into(), service_name: "ElastiCache Redis".into(), bytes_in: 2_621_440, bytes_out: 2_097_152, requests: 2_100, errors: 12 },
            ],
            timestamp: now,
        })
    }
}

// ---------------------------------------------------------------------------
// API Gateway — mock implementation
// ---------------------------------------------------------------------------

#[async_trait]
impl ApiGatewayProvider for AwsProvider {
    async fn list_apis(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing API Gateway APIs (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::ApiGateway)))
    }

    async fn get_api(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, id = id, "Getting API Gateway API (mock)");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::ApiGateway)
            .ok_or_else(|| CloudError::NotFound(format!("API Gateway {} not found in {}", id, region)))
    }

    async fn create_api(&self, region: &str, name: &str, protocol: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = name, protocol = protocol, "Creating API Gateway API (mock)");
        let resource = self.make_resource(
            ResourceType::ApiGateway,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({
                "protocol_type": protocol,
                "endpoint": format!("https://{}.execute-api.{}.amazonaws.com", Uuid::new_v4().to_string().split('-').next().unwrap_or("api"), region),
            }),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_api(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Deleting API Gateway API (mock)");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("API Gateway {} not found", id)))
        }
    }

    async fn list_routes(&self, region: &str, api_id: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, api_id = api_id, "Listing API Gateway routes (mock)");
        Ok(self
            .store
            .list(self.provider, Some(region), Some(ResourceType::ApiRoute))
            .into_iter()
            .filter(|r| {
                r.metadata
                    .get("api_id")
                    .and_then(|v| v.as_str())
                    .map(|v| v == api_id)
                    .unwrap_or(false)
            })
            .collect())
    }

    async fn create_route(&self, region: &str, api_id: &str, method: &str, path: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, api_id = api_id, method = method, path = path, "Creating API Gateway route (mock)");
        let route_key = format!("{} {}", method, path);
        let resource = self.make_resource(
            ResourceType::ApiRoute,
            &route_key,
            region,
            ResourceStatus::Available,
            serde_json::json!({
                "api_id": api_id,
                "method": method,
                "path": path,
                "route_key": route_key,
            }),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn list_stages(&self, region: &str, api_id: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, api_id = api_id, "Listing API Gateway stages (mock)");
        Ok(self
            .store
            .list(self.provider, Some(region), Some(ResourceType::ApiStage))
            .into_iter()
            .filter(|r| {
                r.metadata
                    .get("api_id")
                    .and_then(|v| v.as_str())
                    .map(|v| v == api_id)
                    .unwrap_or(false)
            })
            .collect())
    }

    async fn create_stage(&self, region: &str, api_id: &str, name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, api_id = api_id, name = name, "Creating API Gateway stage (mock)");
        let resource = self.make_resource(
            ResourceType::ApiStage,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({
                "api_id": api_id,
                "stage_name": name,
                "auto_deploy": false,
            }),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }
}

// ---------------------------------------------------------------------------
// CDN / CloudFront — mock implementation
// ---------------------------------------------------------------------------

#[async_trait]
impl CdnProvider for AwsProvider {
    async fn list_distributions(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing CloudFront distributions (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::CdnDistribution)))
    }

    async fn get_distribution(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, id = id, "Getting CloudFront distribution (mock)");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::CdnDistribution)
            .ok_or_else(|| CloudError::NotFound(format!("CloudFront distribution {} not found in {}", id, region)))
    }

    async fn create_distribution(&self, region: &str, config: CreateDistributionRequest) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, origin = config.origin_domain.as_str(), "Creating CloudFront distribution (mock)");
        let dist_id = format!("E{}", &Uuid::new_v4().to_string().replace('-', "")[..13].to_uppercase());
        let resource = self.make_resource(
            ResourceType::CdnDistribution,
            &dist_id,
            region,
            if config.enabled { ResourceStatus::Available } else { ResourceStatus::Stopped },
            serde_json::json!({
                "origin_domain": config.origin_domain,
                "enabled": config.enabled,
                "default_root_object": config.default_root_object,
                "price_class": config.price_class.unwrap_or_else(|| "PriceClass_All".to_string()),
                "comment": config.comment.unwrap_or_default(),
                "domain_name": format!("{}.cloudfront.net", dist_id.to_lowercase()),
            }),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_distribution(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Deleting CloudFront distribution (mock)");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("CloudFront distribution {} not found", id)))
        }
    }

    async fn invalidate_cache(&self, region: &str, distribution_id: &str, paths: Vec<String>) -> Result<()> {
        tracing::info!(
            provider = "aws", region = region, distribution_id = distribution_id,
            paths = ?paths, "Invalidating CloudFront cache (mock)"
        );
        Ok(())
    }
}

#[async_trait]
impl ServerlessProvider for AwsProvider {
    async fn list_functions(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing Lambda functions (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Function)))
    }

    async fn get_function(&self, region: &str, name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = name, "Getting Lambda function (mock)");
        if let Ok(uuid) = Uuid::parse_str(name) {
            if let Some(r) = self.store.get(uuid).filter(|r| r.provider == self.provider && r.resource_type == ResourceType::Function) {
                return Ok(r);
            }
        }
        self.store
            .get_by_name(name, self.provider, ResourceType::Function)
            .ok_or_else(|| CloudError::NotFound(format!("Lambda function {} not found", name)))
    }

    async fn create_function(&self, region: &str, config: CreateFunctionRequest) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = config.name.as_str(), "Creating Lambda function (mock)");
        let resource = self.make_resource(
            ResourceType::Function,
            &config.name,
            region,
            ResourceStatus::Available,
            serde_json::json!({
                "runtime": config.runtime,
                "handler": config.handler,
                "role_arn": config.role_arn,
                "memory_mb": config.memory_mb,
                "timeout_seconds": config.timeout_seconds,
                "environment": config.environment,
            }),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn update_function_code(&self, _region: &str, name: &str, _zip_bytes: Vec<u8>) -> Result<CloudResource> {
        self.store
            .get_by_name(name, self.provider, ResourceType::Function)
            .ok_or_else(|| CloudError::NotFound(format!("Lambda function {} not found", name)))
    }

    async fn delete_function(&self, _region: &str, name: &str) -> Result<()> {
        if let Some(r) = self.store.get_by_name(name, self.provider, ResourceType::Function) {
            self.store.delete(r.id);
        }
        Ok(())
    }

    async fn invoke_function(&self, _region: &str, name: &str, payload: serde_json::Value) -> Result<serde_json::Value> {
        tracing::info!(provider = "aws", name = name, "Invoking Lambda function (mock)");
        Ok(serde_json::json!({
            "status_code": 200,
            "function_error": null,
            "payload": { "echo": payload },
        }))
    }

    async fn list_function_versions(&self, _region: &str, name: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", name = name, "Listing Lambda function versions (mock)");
        Ok(vec![])
    }
}

#[async_trait]
impl NoSqlProvider for AwsProvider {
    async fn list_tables(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing DynamoDB tables (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::NoSqlTable)))
    }

    async fn get_table(&self, region: &str, name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = name, "Getting DynamoDB table (mock)");
        self.store
            .get_by_name(name, self.provider, ResourceType::NoSqlTable)
            .ok_or_else(|| CloudError::NotFound(format!("DynamoDB table {} not found in {}", name, region)))
    }

    async fn create_table(
        &self,
        region: &str,
        name: &str,
        key_schema: serde_json::Value,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = name, "Creating DynamoDB table (mock)");
        let resource = self.make_resource(
            ResourceType::NoSqlTable,
            name,
            region,
            ResourceStatus::Creating,
            serde_json::json!({
                "key_schema": key_schema,
                "table_status": "CREATING",
                "billing_mode": "PAY_PER_REQUEST",
            }),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_table(&self, region: &str, name: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, name = name, "Deleting DynamoDB table (mock)");
        if let Some(r) = self.store.get_by_name(name, self.provider, ResourceType::NoSqlTable) {
            self.store.delete(r.id);
        }
        Ok(())
    }

    async fn describe_table(&self, region: &str, name: &str) -> Result<serde_json::Value> {
        tracing::info!(provider = "aws", region = region, name = name, "Describing DynamoDB table (mock)");
        let table = self.get_table(region, name).await?;
        Ok(serde_json::json!({
            "table_name": table.name,
            "table_status": "ACTIVE",
            "key_schema": table.metadata.get("key_schema"),
            "item_count": 0,
            "table_size_bytes": 0,
        }))
    }
}

#[async_trait]
impl CacheDbProvider for AwsProvider {
    async fn list_clusters(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing ElastiCache clusters (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::CacheCluster)))
    }

    async fn get_cluster(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, id = id, "Getting ElastiCache cluster (mock)");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::CacheCluster)
            .ok_or_else(|| CloudError::NotFound(format!("ElastiCache cluster {} not found in {}", id, region)))
    }

    async fn create_cluster(
        &self,
        region: &str,
        name: &str,
        engine: &str,
        node_type: &str,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = name, "Creating ElastiCache cluster (mock)");
        let resource = self.make_resource(
            ResourceType::CacheCluster,
            name,
            region,
            ResourceStatus::Creating,
            serde_json::json!({
                "engine": engine,
                "node_type": node_type,
                "num_cache_nodes": 1,
                "cache_cluster_status": "creating",
            }),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_cluster(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Deleting ElastiCache cluster (mock)");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store.delete(uuid);
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// IoT Provider (mock)
// ---------------------------------------------------------------------------

#[async_trait]
impl IoTProvider for AwsProvider {
    async fn list_things(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing IoT things (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::IoTThing)))
    }

    async fn get_thing(&self, region: &str, name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = name, "Getting IoT thing (mock)");
        self.store
            .get_by_name(name, self.provider, ResourceType::IoTThing)
            .ok_or_else(|| CloudError::NotFound(format!("IoT thing {} not found", name)))
    }

    async fn create_thing(&self, region: &str, name: &str, attributes: serde_json::Value) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = name, "Creating IoT thing (mock)");
        let resource = self.make_resource(
            ResourceType::IoTThing,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({ "attributes": attributes, "thing_type": "default" }),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_thing(&self, region: &str, name: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, name = name, "Deleting IoT thing (mock)");
        let thing = self.store
            .get_by_name(name, self.provider, ResourceType::IoTThing)
            .ok_or_else(|| CloudError::NotFound(format!("IoT thing {} not found", name)))?;
        self.store.delete(thing.id);
        Ok(())
    }

    async fn list_thing_groups(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing IoT thing groups (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::IoTThingGroup)))
    }
}

// ---------------------------------------------------------------------------
// ML / SageMaker Provider (mock)
// ---------------------------------------------------------------------------

#[async_trait]
impl MlProvider for AwsProvider {
    async fn list_models(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing SageMaker models (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::MlModel)))
    }

    async fn list_endpoints(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing SageMaker endpoints (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::MlEndpoint)))
    }

    async fn list_training_jobs(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing SageMaker training jobs (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::MlTrainingJob)))
    }

    async fn create_endpoint(&self, region: &str, name: &str, model_name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = name, "Creating SageMaker endpoint (mock)");
        let resource = self.make_resource(
            ResourceType::MlEndpoint,
            name,
            region,
            ResourceStatus::Creating,
            serde_json::json!({ "model_name": model_name, "instance_type": "ml.m5.large", "initial_instance_count": 1 }),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_endpoint(&self, region: &str, name: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, name = name, "Deleting SageMaker endpoint (mock)");
        let ep = self.store
            .get_by_name(name, self.provider, ResourceType::MlEndpoint)
            .ok_or_else(|| CloudError::NotFound(format!("SageMaker endpoint {} not found", name)))?;
        self.store.delete(ep.id);
        Ok(())
    }
}

#[async_trait]
impl ContainerRegistryProvider for AwsProvider {
    async fn list_registries(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing ECR repositories (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::ContainerRegistry)))
    }

    async fn get_registry(&self, region: &str, id: &str) -> Result<CloudResource> {
        let uuid = Uuid::parse_str(id).map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store.get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::ContainerRegistry)
            .ok_or_else(|| CloudError::NotFound(format!("ECR repository {} not found in {}", id, region)))
    }

    async fn create_registry(&self, region: &str, name: &str) -> Result<CloudResource> {
        let resource = self.make_resource(ResourceType::ContainerRegistry, name, region, ResourceStatus::Available,
            serde_json::json!({"repository_uri": format!("123456789.dkr.ecr.{}.amazonaws.com/{}", region, name)}), HashMap::new());
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_registry(&self, _region: &str, id: &str) -> Result<()> {
        let uuid = Uuid::parse_str(id).map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store.delete(uuid);
        Ok(())
    }

    async fn list_images(&self, _region: &str, _registry: &str) -> Result<Vec<CloudResource>> {
        Ok(vec![])
    }

    async fn get_image_scan_results(&self, _region: &str, registry: &str, image_tag: &str) -> Result<serde_json::Value> {
        Ok(serde_json::json!({"repository": registry, "image_tag": image_tag, "scan_status": "COMPLETE", "severity_counts": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}}))
    }

    async fn start_image_scan(&self, _region: &str, _registry: &str, _image_tag: &str) -> Result<()> {
        Ok(())
    }
}

#[async_trait]
impl WorkflowProvider for AwsProvider {
    async fn list_state_machines(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing Step Functions state machines (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::StateMachine)))
    }

    async fn get_state_machine(&self, region: &str, arn: &str) -> Result<CloudResource> {
        if let Ok(uuid) = Uuid::parse_str(arn) {
            if let Some(r) = self.store.get(uuid).filter(|r| r.provider == self.provider && r.resource_type == ResourceType::StateMachine) {
                return Ok(r);
            }
        }
        Err(CloudError::NotFound(format!("State machine {} not found in {}", arn, region)))
    }

    async fn start_execution(&self, region: &str, arn: &str, input: serde_json::Value) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, arn = arn, "Starting Step Functions execution (mock)");
        let resource = self.make_resource(ResourceType::WorkflowExecution, &format!("exec-{}", Uuid::new_v4()), region, ResourceStatus::Running,
            serde_json::json!({"state_machine_arn": arn, "input": input}), HashMap::new());
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn list_executions(&self, region: &str, _arn: &str) -> Result<Vec<CloudResource>> {
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::WorkflowExecution)))
    }
}

#[async_trait]
impl IamProvider for AwsProvider {
    async fn list_users(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing IAM users (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::IamUser)))
    }

    async fn create_user(&self, region: &str, username: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, username = username, "Creating IAM user (mock)");
        let resource = self.make_resource(
            ResourceType::IamUser,
            username,
            region,
            ResourceStatus::Available,
            serde_json::json!({"username": username, "path": "/"}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_user(&self, region: &str, username: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, username = username, "Deleting IAM user (mock)");
        if let Some(r) = self.store.get_by_name(username, self.provider, ResourceType::IamUser) {
            if self.store.delete(r.id) {
                return Ok(());
            }
        }
        Err(CloudError::NotFound(format!("IAM user {} not found", username)))
    }

    async fn list_roles(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing IAM roles (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::IamRole)))
    }

    async fn create_role(&self, region: &str, name: &str, trust_policy: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = name, "Creating IAM role (mock)");
        let resource = self.make_resource(
            ResourceType::IamRole,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({"role_name": name, "trust_policy": trust_policy}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_role(&self, region: &str, name: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, name = name, "Deleting IAM role (mock)");
        if let Some(r) = self.store.get_by_name(name, self.provider, ResourceType::IamRole) {
            if self.store.delete(r.id) {
                return Ok(());
            }
        }
        Err(CloudError::NotFound(format!("IAM role {} not found", name)))
    }

    async fn list_policies(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing IAM policies (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::IamPolicy)))
    }

    async fn attach_policy(&self, region: &str, target: &str, policy_arn: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, target = target, policy_arn = policy_arn, "Attaching IAM policy (mock)");
        Ok(())
    }

    async fn detach_policy(&self, region: &str, target: &str, policy_arn: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, target = target, policy_arn = policy_arn, "Detaching IAM policy (mock)");
        Ok(())
    }
}

#[async_trait]
impl DnsProvider for AwsProvider {
    async fn list_hosted_zones(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing Route 53 hosted zones (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::DnsZone)))
    }

    async fn list_records(&self, region: &str, _zone_id: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing DNS records (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::DnsRecord)))
    }

    async fn create_record(&self, region: &str, zone_id: &str, record: DnsRecordInput) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, zone_id = zone_id, "Creating DNS record (mock)");
        let resource = self.make_resource(
            ResourceType::DnsRecord,
            &record.name,
            region,
            ResourceStatus::Available,
            serde_json::json!({"zone_id": zone_id, "record_type": record.record_type, "values": record.values, "ttl": record.ttl}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_record(&self, region: &str, zone_id: &str, record: DnsRecordInput) -> Result<()> {
        tracing::info!(provider = "aws", region = region, zone_id = zone_id, name = record.name.as_str(), "Deleting DNS record (mock)");
        if let Some(r) = self.store.get_by_name(&record.name, self.provider, ResourceType::DnsRecord) {
            if self.store.delete(r.id) {
                return Ok(());
            }
        }
        Err(CloudError::NotFound(format!("DNS record {} not found in zone {}", record.name, zone_id)))
    }
}

#[async_trait]
impl WafProvider for AwsProvider {
    async fn list_web_acls(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing WAF web ACLs (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::WafRule)))
    }

    async fn get_web_acl(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, id = id, "Getting WAF web ACL (mock)");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::WafRule)
            .ok_or_else(|| CloudError::NotFound(format!("WAF web ACL {} not found in {}", id, region)))
    }

    async fn list_rules(&self, region: &str, _acl_id: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing WAF rules (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::WafRule)))
    }

    async fn create_web_acl(&self, region: &str, name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = name, "Creating WAF web ACL (mock)");
        let resource = self.make_resource(
            ResourceType::WafRule,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({"scope": "REGIONAL", "default_action": "allow"}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_web_acl(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Deleting WAF web ACL (mock)");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("WAF web ACL {} not found", id)))
        }
    }
}

#[async_trait]
impl MessagingProvider for AwsProvider {
    async fn list_queues(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing SQS queues (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Queue)))
    }

    async fn get_queue(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, id = id, "Getting SQS queue (mock)");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::Queue)
            .ok_or_else(|| CloudError::NotFound(format!("SQS queue {} not found in {}", id, region)))
    }

    async fn create_queue(&self, region: &str, name: &str, fifo: bool) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = name, fifo = fifo, "Creating SQS queue (mock)");
        let queue_name = if fifo { format!("{}.fifo", name) } else { name.to_string() };
        let resource = self.make_resource(
            ResourceType::Queue,
            &queue_name,
            region,
            ResourceStatus::Available,
            serde_json::json!({"fifo": fifo, "visibility_timeout": 30, "message_retention": 345600}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_queue(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Deleting SQS queue (mock)");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("SQS queue {} not found", id)))
        }
    }

    async fn list_topics(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing SNS topics (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Topic)))
    }

    async fn create_topic(&self, region: &str, name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = name, "Creating SNS topic (mock)");
        let resource = self.make_resource(
            ResourceType::Topic,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({"display_name": name, "subscriptions_confirmed": 0}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_topic(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Deleting SNS topic (mock)");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("SNS topic {} not found", id)))
        }
    }
}

#[async_trait]
impl KmsProvider for AwsProvider {
    async fn list_keys(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing KMS keys (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::KmsKey)))
    }

    async fn get_key(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, id = id, "Getting KMS key (mock)");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::KmsKey)
            .ok_or_else(|| CloudError::NotFound(format!("KMS key {} not found in {}", id, region)))
    }

    async fn create_key(&self, region: &str, name: &str, key_type: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = name, key_type = key_type, "Creating KMS key (mock)");
        let resource = self.make_resource(
            ResourceType::KmsKey,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({"key_type": key_type, "key_state": "Enabled", "key_usage": "ENCRYPT_DECRYPT"}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn schedule_key_deletion(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Scheduling KMS key deletion (mock)");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("KMS key {} not found", id)))
        }
    }

    async fn set_key_enabled(&self, region: &str, id: &str, enabled: bool) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, enabled = enabled, "Setting KMS key enabled state (mock)");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        let status = if enabled { ResourceStatus::Available } else { ResourceStatus::Stopped };
        if self.store.update_status(uuid, status) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("KMS key {} not found", id)))
        }
    }
}

#[async_trait]
impl AutoScalingProvider for AwsProvider {
    async fn list_groups(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing Auto Scaling groups (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::AutoScalingGroup)))
    }

    async fn get_group(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, id = id, "Getting Auto Scaling group (mock)");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::AutoScalingGroup)
            .ok_or_else(|| CloudError::NotFound(format!("Auto Scaling group {} not found in {}", id, region)))
    }

    async fn create_group(
        &self,
        region: &str,
        name: &str,
        min_size: u32,
        max_size: u32,
        desired: u32,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, name = name, "Creating Auto Scaling group (mock)");
        let resource = self.make_resource(
            ResourceType::AutoScalingGroup,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({"min_size": min_size, "max_size": max_size, "desired_capacity": desired}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_group(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Deleting Auto Scaling group (mock)");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("Auto Scaling group {} not found", id)))
        }
    }

    async fn set_desired_capacity(&self, region: &str, id: &str, _desired: u32) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Setting Auto Scaling desired capacity (mock)");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.get(uuid).is_some() {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("Auto Scaling group {} not found", id)))
        }
    }
}

#[async_trait]
impl VolumeProvider for AwsProvider {
    async fn list_volumes(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "aws", region = region, "Listing EBS volumes (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Volume)))
    }

    async fn create_volume(&self, region: &str, size_gb: i32, volume_type: &str, az: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, size_gb = size_gb, "Creating EBS volume (mock)");
        let resource = self.make_resource(
            ResourceType::Volume,
            &format!("vol-{}", Uuid::new_v4().to_string().split('-').next().unwrap_or("mock")),
            region,
            ResourceStatus::Available,
            serde_json::json!({"size_gb": size_gb, "volume_type": volume_type, "availability_zone": az, "state": "available"}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn attach_volume(&self, region: &str, volume_id: &str, instance_id: &str, device: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, volume_id = volume_id, instance_id = instance_id, device = device, "Attaching EBS volume (mock)");
        let uuid = Uuid::parse_str(volume_id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", volume_id)))?;
        if self.store.get(uuid).is_some() {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("EBS volume {} not found", volume_id)))
        }
    }

    async fn detach_volume(&self, region: &str, volume_id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, volume_id = volume_id, "Detaching EBS volume (mock)");
        let uuid = Uuid::parse_str(volume_id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", volume_id)))?;
        if self.store.get(uuid).is_some() {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("EBS volume {} not found", volume_id)))
        }
    }

    async fn delete_volume(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "aws", region = region, id = id, "Deleting EBS volume (mock)");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("EBS volume {} not found", id)))
        }
    }

    async fn create_volume_snapshot(&self, region: &str, volume_id: &str, name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "aws", region = region, volume_id = volume_id, name = name, "Creating EBS snapshot (mock)");
        let resource = self.make_resource(
            ResourceType::Snapshot,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({"volume_id": volume_id, "state": "completed"}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }
}

use async_trait::async_trait;
use chrono::Utc;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::error::CloudError;
use crate::models::*;
use crate::providers::store::InMemoryStore;
use crate::traits::compute::Result;
use crate::traits::{ApiGatewayProvider, CacheDbProvider, CdnProvider, ComputeProvider, ContainerRegistryProvider, DatabaseProvider, IoTProvider, KubernetesProvider, MlProvider, NetworkingProvider, NoSqlProvider, ServerlessProvider, StorageProvider, TrafficProvider, WorkflowProvider};

/// Azure cloud provider backed by InMemoryStore.
pub struct AzureProvider {
    pub provider: CloudProvider,
    pub store: Arc<InMemoryStore>,
}

impl AzureProvider {
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
impl ComputeProvider for AzureProvider {
    async fn list_instances(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "azure", region = region, "Listing Azure VMs");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Instance)))
    }

    async fn get_instance(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "azure", region = region, id = id, "Getting Azure VM");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::Instance)
            .ok_or_else(|| CloudError::NotFound(format!("Azure VM {} not found in {}", id, region)))
    }

    async fn create_instance(
        &self,
        region: &str,
        config: CreateInstanceRequest,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "azure", region = region, name = config.name.as_str(), "Creating Azure VM");
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
        tracing::info!(provider = "azure", region = region, id = id, "Deleting Azure VM");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("Azure VM {} not found", id)))
        }
    }

    async fn start_instance(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "azure", region = region, id = id, "Starting Azure VM");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.update_status(uuid, ResourceStatus::Running) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("Azure VM {} not found", id)))
        }
    }

    async fn stop_instance(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "azure", region = region, id = id, "Stopping Azure VM");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.update_status(uuid, ResourceStatus::Stopped) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("Azure VM {} not found", id)))
        }
    }

    async fn reboot_instance(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "azure", region = region, id = id, "Rebooting Azure VM");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.update_status(uuid, ResourceStatus::Running) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("Azure VM {} not found", id)))
        }
    }
}

#[async_trait]
impl StorageProvider for AzureProvider {
    async fn list_buckets(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "azure", region = region, "Listing storage accounts");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Bucket)))
    }

    async fn get_bucket(&self, region: &str, name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "azure", region = region, name = name, "Getting storage account");
        if let Ok(uuid) = Uuid::parse_str(name) {
            if let Some(r) = self.store.get(uuid).filter(|r| r.provider == self.provider && r.resource_type == ResourceType::Bucket) {
                return Ok(r);
            }
        }
        self.store
            .get_by_name(name, self.provider, ResourceType::Bucket)
            .ok_or_else(|| CloudError::NotFound(format!("Azure storage account {} not found", name)))
    }

    async fn create_bucket(
        &self,
        region: &str,
        config: CreateBucketRequest,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "azure", region = region, name = config.name.as_str(), "Creating storage account");
        let resource = self.make_resource(
            ResourceType::Bucket,
            &config.name,
            region,
            ResourceStatus::Available,
            serde_json::json!({
                "versioning": config.versioning,
                "encryption": "Microsoft.Storage",
                "public_access": config.public_access,
                "account_kind": "StorageV2",
                "replication": "LRS",
                "access_tier": "Hot",
                "object_count": 0,
                "total_size_bytes": 0,
            }),
            config.tags,
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_bucket(&self, region: &str, name: &str) -> Result<()> {
        tracing::info!(provider = "azure", region = region, name = name, "Deleting storage account");
        if let Ok(uuid) = Uuid::parse_str(name) {
            if self.store.delete(uuid) {
                return Ok(());
            }
        }
        if let Some(r) = self.store.get_by_name(name, self.provider, ResourceType::Bucket) {
            self.store.delete(r.id);
            return Ok(());
        }
        Err(CloudError::NotFound(format!("Azure storage account {} not found", name)))
    }

    async fn list_objects(
        &self,
        region: &str,
        bucket: &str,
        prefix: Option<&str>,
    ) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "azure", region = region, bucket = bucket, prefix = ?prefix, "Listing blobs");
        let now = Utc::now();
        let prefix_str = prefix.unwrap_or("");
        let sample_objects = vec![
            CloudResource {
                id: Uuid::new_v4(),
                cloud_id: None,
                provider: self.provider,
                resource_type: ResourceType::Bucket,
                name: format!("{}reports/monthly.xlsx", prefix_str),
                region: region.to_string(),
                status: ResourceStatus::Available,
                metadata: serde_json::json!({"bucket": bucket, "content_type": "application/vnd.ms-excel", "size_bytes": 65536, "access_tier": "Hot"}),
                tags: HashMap::new(),
                created_at: now,
                updated_at: now,
            },
            CloudResource {
                id: Uuid::new_v4(),
                cloud_id: None,
                provider: self.provider,
                resource_type: ResourceType::Bucket,
                name: format!("{}backups/db-snapshot.bak", prefix_str),
                region: region.to_string(),
                status: ResourceStatus::Available,
                metadata: serde_json::json!({"bucket": bucket, "content_type": "application/octet-stream", "size_bytes": 1073741824_u64, "access_tier": "Cool"}),
                tags: HashMap::new(),
                created_at: now,
                updated_at: now,
            },
            CloudResource {
                id: Uuid::new_v4(),
                cloud_id: None,
                provider: self.provider,
                resource_type: ResourceType::Bucket,
                name: format!("{}logs/app.log", prefix_str),
                region: region.to_string(),
                status: ResourceStatus::Available,
                metadata: serde_json::json!({"bucket": bucket, "content_type": "text/plain", "size_bytes": 2097152, "access_tier": "Hot"}),
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
        tracing::info!(provider = "azure", region = region, bucket = bucket, key = request.key.as_str(), "Uploading blob");
        let resource = self.make_resource(
            ResourceType::Bucket,
            &request.key,
            region,
            ResourceStatus::Available,
            serde_json::json!({
                "bucket": bucket,
                "content_type": request.content_type,
                "size_bytes": _data.len(),
                "access_tier": "Hot",
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
        tracing::info!(provider = "azure", region = region, bucket = bucket, key = key, "Deleting blob");
        Ok(())
    }

    async fn get_bucket_policy(&self, _region: &str, _bucket: &str) -> Result<serde_json::Value> {
        Ok(serde_json::json!({"access_policies": []}))
    }

    async fn put_bucket_policy(&self, _region: &str, _bucket: &str, _policy: &str) -> Result<()> {
        Ok(())
    }

    async fn delete_bucket_policy(&self, _region: &str, _bucket: &str) -> Result<()> {
        Ok(())
    }

    async fn get_lifecycle_rules(&self, _region: &str, _bucket: &str) -> Result<Vec<serde_json::Value>> {
        Ok(vec![])
    }

    async fn put_lifecycle_rules(&self, _region: &str, _bucket: &str, _rules: Vec<serde_json::Value>) -> Result<()> {
        Ok(())
    }

    async fn get_bucket_encryption(&self, _region: &str, _bucket: &str) -> Result<serde_json::Value> {
        Ok(serde_json::json!({"encryption": "Microsoft.Storage"}))
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
impl NetworkingProvider for AzureProvider {
    async fn list_vpcs(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "azure", region = region, "Listing VNets");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Vpc)))
    }

    async fn get_vpc(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "azure", region = region, id = id, "Getting VNet");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::Vpc)
            .ok_or_else(|| CloudError::NotFound(format!("Azure VNet {} not found in {}", id, region)))
    }

    async fn create_vpc(
        &self,
        region: &str,
        config: CreateVpcRequest,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "azure", region = region, name = config.name.as_str(), "Creating VNet");
        let resource = self.make_resource(
            ResourceType::Vpc,
            &config.name,
            region,
            ResourceStatus::Available,
            serde_json::json!({
                "cidr_block": config.cidr_block,
                "enable_dns": config.enable_dns,
                "resource_group": "default-rg",
                "address_space": [config.cidr_block],
            }),
            config.tags,
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_vpc(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "azure", region = region, id = id, "Deleting VNet");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("Azure VNet {} not found", id)))
        }
    }

    async fn list_subnets(&self, region: &str, vpc_id: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "azure", region = region, vpc_id = vpc_id, "Listing subnets");
        Ok(self.store.list_subnets_for_vpc(self.provider, region, vpc_id))
    }

    async fn create_subnet(
        &self,
        region: &str,
        config: CreateSubnetRequest,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "azure", region = region, name = config.name.as_str(), "Creating subnet");
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
        tracing::info!(provider = "azure", region = region, id = id, "Deleting subnet");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("Azure subnet {} not found", id)))
        }
    }

    async fn list_load_balancers(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "azure", region = region, "Listing load balancers");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::LoadBalancer)))
    }

    async fn get_load_balancer(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "azure", region = region, id = id, "Getting load balancer");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::LoadBalancer)
            .ok_or_else(|| CloudError::NotFound(format!("Azure load balancer {} not found in {}", id, region)))
    }

    async fn delete_load_balancer(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "azure", region = region, id = id, "Deleting load balancer");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("Azure load balancer {} not found", id)))
        }
    }

    async fn list_security_groups(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "azure", region = region, "Listing NSGs");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::SecurityGroup)))
    }

    async fn list_elastic_ips(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "azure", region = region, "Listing public IPs (stub)");
        Ok(Vec::new())
    }

    async fn allocate_elastic_ip(&self, region: &str) -> Result<CloudResource> {
        let resource = self.make_resource(ResourceType::ElasticIp, "azure-pip-mock", region, ResourceStatus::Available, serde_json::json!({}), HashMap::new());
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn associate_elastic_ip(&self, _region: &str, _eip_id: &str, _instance_id: &str) -> Result<()> { Ok(()) }
    async fn disassociate_elastic_ip(&self, _region: &str, _association_id: &str) -> Result<()> { Ok(()) }
    async fn release_elastic_ip(&self, _region: &str, _allocation_id: &str) -> Result<()> { Ok(()) }

    async fn list_nat_gateways(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(Vec::new()) }

    async fn create_nat_gateway(&self, region: &str, subnet_id: &str, _eip_allocation_id: &str) -> Result<CloudResource> {
        let resource = self.make_resource(ResourceType::NatGateway, "azure-nat-mock", region, ResourceStatus::Available, serde_json::json!({"subnet_id": subnet_id}), HashMap::new());
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_nat_gateway(&self, _region: &str, _id: &str) -> Result<()> { Ok(()) }

    async fn list_internet_gateways(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(Vec::new()) }

    async fn create_internet_gateway(&self, region: &str) -> Result<CloudResource> {
        let resource = self.make_resource(ResourceType::InternetGateway, "azure-igw-mock", region, ResourceStatus::Available, serde_json::json!({}), HashMap::new());
        Ok(resource)
    }

    async fn attach_internet_gateway(&self, _region: &str, _igw_id: &str, _vpc_id: &str) -> Result<()> { Ok(()) }
    async fn detach_internet_gateway(&self, _region: &str, _igw_id: &str, _vpc_id: &str) -> Result<()> { Ok(()) }
    async fn delete_internet_gateway(&self, _region: &str, _id: &str) -> Result<()> { Ok(()) }

    async fn list_route_tables(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(Vec::new()) }

    async fn create_route_table(&self, region: &str, vpc_id: &str) -> Result<CloudResource> {
        let resource = self.make_resource(ResourceType::RouteTable, "azure-rt-mock", region, ResourceStatus::Available, serde_json::json!({"vpc_id": vpc_id}), HashMap::new());
        Ok(resource)
    }

    async fn add_route(&self, _region: &str, _route_table_id: &str, _destination_cidr: &str, _target_id: &str) -> Result<()> { Ok(()) }
    async fn delete_route(&self, _region: &str, _route_table_id: &str, _destination_cidr: &str) -> Result<()> { Ok(()) }
    async fn associate_route_table(&self, _region: &str, _route_table_id: &str, _subnet_id: &str) -> Result<String> { Ok("mock-assoc".to_string()) }
    async fn delete_route_table(&self, _region: &str, _id: &str) -> Result<()> { Ok(()) }

    async fn create_security_group(&self, region: &str, name: &str, description: &str, vpc_id: &str) -> Result<CloudResource> {
        let resource = self.make_resource(ResourceType::SecurityGroup, name, region, ResourceStatus::Available, serde_json::json!({"description": description, "vpc_id": vpc_id}), HashMap::new());
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn add_security_group_rule(&self, _region: &str, _sg_id: &str, _rule: SecurityGroupRule) -> Result<()> { Ok(()) }
    async fn remove_security_group_rule(&self, _region: &str, _sg_id: &str, _rule: SecurityGroupRule) -> Result<()> { Ok(()) }
    async fn delete_security_group(&self, _region: &str, _id: &str) -> Result<()> { Ok(()) }

    async fn list_vpc_peering_connections(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(Vec::new()) }

    async fn create_vpc_peering(&self, region: &str, vpc_id: &str, peer_vpc_id: &str) -> Result<CloudResource> {
        let resource = self.make_resource(ResourceType::VpcPeering, "azure-pcx-mock", region, ResourceStatus::Pending, serde_json::json!({"requester_vpc_id": vpc_id, "accepter_vpc_id": peer_vpc_id}), HashMap::new());
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn accept_vpc_peering(&self, _region: &str, _peering_id: &str) -> Result<()> { Ok(()) }
    async fn delete_vpc_peering(&self, _region: &str, _peering_id: &str) -> Result<()> { Ok(()) }
}

#[async_trait]
impl DatabaseProvider for AzureProvider {
    async fn list_databases(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "azure", region = region, "Listing Azure SQL databases");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Database)))
    }

    async fn get_database(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "azure", region = region, id = id, "Getting Azure SQL database");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::Database)
            .ok_or_else(|| CloudError::NotFound(format!("Azure SQL database {} not found in {}", id, region)))
    }

    async fn create_database(
        &self,
        region: &str,
        config: CreateDatabaseRequest,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "azure", region = region, name = config.name.as_str(), "Creating Azure SQL database");
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
                "endpoint": format!("{}.database.windows.net", config.name),
                "resource_group": "default-rg",
            }),
            config.tags,
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_database(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "azure", region = region, id = id, "Deleting Azure SQL database");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("Azure SQL database {} not found", id)))
        }
    }

    async fn restart_database(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "azure", region = region, id = id, "Restarting Azure SQL database");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.update_status(uuid, ResourceStatus::Running) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("Azure SQL database {} not found", id)))
        }
    }

    async fn create_snapshot(
        &self,
        region: &str,
        db_id: &str,
        snapshot_name: &str,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "azure", region = region, db_id = db_id, snapshot_name = snapshot_name, "Creating Azure SQL backup");
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
        let resource = self.make_resource(ResourceType::Database, replica_name, region, ResourceStatus::Creating,
            serde_json::json!({"source_db_id": source_db_id, "role": "read_replica"}), HashMap::new());
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn list_parameter_groups(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(vec![]) }

    async fn get_parameter_group(&self, _region: &str, name: &str) -> Result<serde_json::Value> {
        Ok(serde_json::json!({"name": name, "description": "Azure SQL server configuration (stub)"}))
    }

    async fn restore_to_point_in_time(&self, region: &str, source_db_id: &str, target_name: &str, restore_time: &str) -> Result<CloudResource> {
        let resource = self.make_resource(ResourceType::Database, target_name, region, ResourceStatus::Creating,
            serde_json::json!({"source_db_id": source_db_id, "restore_time": restore_time}), HashMap::new());
        self.store.insert(resource.clone());
        Ok(resource)
    }
}

// ---------------------------------------------------------------------------
// Kubernetes (AKS) — stub implementation
// ---------------------------------------------------------------------------

#[async_trait]
impl KubernetesProvider for AzureProvider {
    async fn list_clusters(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "azure", region = region, "Listing AKS clusters (stub)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::EksCluster)))
    }

    async fn get_cluster(&self, region: &str, name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "azure", region = region, name = name, "Getting AKS cluster (stub)");
        self.store
            .list(self.provider, Some(region), Some(ResourceType::EksCluster))
            .into_iter()
            .find(|r| r.name == name)
            .ok_or_else(|| CloudError::NotFound(format!("AKS cluster {} not found in {}", name, region)))
    }

    async fn create_cluster(&self, region: &str, config: CreateClusterRequest) -> Result<CloudResource> {
        tracing::info!(provider = "azure", region = region, name = config.name.as_str(), "Creating AKS cluster (stub)");
        let resource = self.make_resource(
            ResourceType::EksCluster,
            &config.name,
            region,
            ResourceStatus::Creating,
            serde_json::json!({ "version": config.version, "platform": "aks" }),
            config.tags,
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_cluster(&self, region: &str, name: &str) -> Result<()> {
        tracing::info!(provider = "azure", region = region, name = name, "Deleting AKS cluster (stub)");
        let cluster = KubernetesProvider::get_cluster(self, region, name).await?;
        self.store.delete(cluster.id);
        Ok(())
    }

    async fn list_node_groups(&self, region: &str, cluster_name: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "azure", region = region, cluster = cluster_name, "Listing AKS node pools (stub)");
        Ok(self
            .store
            .list(self.provider, Some(region), Some(ResourceType::EksNodeGroup))
            .into_iter()
            .filter(|r| r.metadata.get("cluster_name").and_then(|v| v.as_str()) == Some(cluster_name))
            .collect())
    }

    async fn create_node_group(&self, region: &str, cluster_name: &str, config: CreateNodeGroupRequest) -> Result<CloudResource> {
        tracing::info!(provider = "azure", region = region, cluster = cluster_name, name = config.name.as_str(), "Creating AKS node pool (stub)");
        let resource = self.make_resource(
            ResourceType::EksNodeGroup,
            &config.name,
            region,
            ResourceStatus::Creating,
            serde_json::json!({ "cluster_name": cluster_name, "desired_size": config.desired_size }),
            config.tags,
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_node_group(&self, region: &str, cluster_name: &str, node_group_name: &str) -> Result<()> {
        tracing::info!(provider = "azure", region = region, cluster = cluster_name, ng = node_group_name, "Deleting AKS node pool (stub)");
        let groups = self.list_node_groups(region, cluster_name).await?;
        if let Some(ng) = groups.into_iter().find(|r| r.name == node_group_name) {
            self.store.delete(ng.id);
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("Node pool {} not found", node_group_name)))
        }
    }

    async fn scale_node_group(&self, region: &str, cluster_name: &str, node_group_name: &str, desired: i32) -> Result<()> {
        tracing::info!(provider = "azure", region = region, cluster = cluster_name, ng = node_group_name, desired = desired, "Scaling AKS node pool (stub)");
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Traffic — stub implementation
// ---------------------------------------------------------------------------

#[async_trait]
impl TrafficProvider for AzureProvider {
    async fn get_flow_logs(&self, region: &str, _log_group: Option<&str>, _start_time: Option<i64>, _end_time: Option<i64>) -> Result<FlowLogResponse> {
        tracing::info!(provider = "azure", region = region, "Fetching NSG flow logs (stub)");
        Ok(FlowLogResponse { entries: vec![], query_id: None })
    }

    async fn get_traffic_summary(&self, region: &str) -> Result<TrafficSummary> {
        tracing::info!(provider = "azure", region = region, "Building traffic summary (stub)");
        Ok(TrafficSummary {
            total_bytes_in: 0,
            total_bytes_out: 0,
            total_requests: 0,
            total_errors: 0,
            top_talkers: vec![],
            per_service: vec![],
            timestamp: Utc::now().to_rfc3339(),
        })
    }
}

// ---------------------------------------------------------------------------
// API Gateway — stub implementation (Azure API Management)
// ---------------------------------------------------------------------------

#[async_trait]
impl ApiGatewayProvider for AzureProvider {
    async fn list_apis(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "azure", region = region, "Listing Azure API Management APIs (stub)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::ApiGateway)))
    }

    async fn get_api(&self, region: &str, id: &str) -> Result<CloudResource> {
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::ApiGateway)
            .ok_or_else(|| CloudError::NotFound(format!("Azure APIM API {} not found in {}", id, region)))
    }

    async fn create_api(&self, region: &str, name: &str, protocol: &str) -> Result<CloudResource> {
        let resource = self.make_resource(
            ResourceType::ApiGateway,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({"protocol_type": protocol, "platform": "azure_apim"}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_api(&self, region: &str, id: &str) -> Result<()> {
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) { Ok(()) }
        else { Err(CloudError::NotFound(format!("Azure APIM API {} not found in {}", id, region))) }
    }

    async fn list_routes(&self, region: &str, api_id: &str) -> Result<Vec<CloudResource>> {
        let _ = (region, api_id);
        Ok(vec![])
    }

    async fn create_route(&self, region: &str, api_id: &str, method: &str, path: &str) -> Result<CloudResource> {
        let route_key = format!("{} {}", method, path);
        let resource = self.make_resource(
            ResourceType::ApiRoute, &route_key, region, ResourceStatus::Available,
            serde_json::json!({"api_id": api_id, "method": method, "path": path}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn list_stages(&self, region: &str, api_id: &str) -> Result<Vec<CloudResource>> {
        let _ = (region, api_id);
        Ok(vec![])
    }

    async fn create_stage(&self, region: &str, api_id: &str, name: &str) -> Result<CloudResource> {
        let resource = self.make_resource(
            ResourceType::ApiStage, name, region, ResourceStatus::Available,
            serde_json::json!({"api_id": api_id, "stage_name": name}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }
}

// ---------------------------------------------------------------------------
// CDN — stub implementation (Azure CDN)
// ---------------------------------------------------------------------------

#[async_trait]
impl CdnProvider for AzureProvider {
    async fn list_distributions(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "azure", region = region, "Listing Azure CDN distributions (stub)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::CdnDistribution)))
    }

    async fn get_distribution(&self, region: &str, id: &str) -> Result<CloudResource> {
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::CdnDistribution)
            .ok_or_else(|| CloudError::NotFound(format!("Azure CDN distribution {} not found in {}", id, region)))
    }

    async fn create_distribution(&self, region: &str, config: CreateDistributionRequest) -> Result<CloudResource> {
        let resource = self.make_resource(
            ResourceType::CdnDistribution,
            &config.origin_domain,
            region,
            if config.enabled { ResourceStatus::Available } else { ResourceStatus::Stopped },
            serde_json::json!({
                "origin_domain": config.origin_domain,
                "enabled": config.enabled,
                "platform": "azure_cdn",
            }),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_distribution(&self, region: &str, id: &str) -> Result<()> {
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) { Ok(()) }
        else { Err(CloudError::NotFound(format!("Azure CDN distribution {} not found in {}", id, region))) }
    }

    async fn invalidate_cache(&self, region: &str, distribution_id: &str, paths: Vec<String>) -> Result<()> {
        tracing::info!(provider = "azure", region = region, distribution_id = distribution_id, paths = ?paths, "Invalidating Azure CDN cache (stub)");
        Ok(())
    }
}

#[async_trait]
impl ServerlessProvider for AzureProvider {
    async fn list_functions(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "azure", region = region, "Listing Azure Functions (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Function)))
    }

    async fn get_function(&self, _region: &str, name: &str) -> Result<CloudResource> {
        if let Ok(uuid) = Uuid::parse_str(name) {
            if let Some(r) = self.store.get(uuid).filter(|r| r.provider == self.provider && r.resource_type == ResourceType::Function) {
                return Ok(r);
            }
        }
        self.store
            .get_by_name(name, self.provider, ResourceType::Function)
            .ok_or_else(|| CloudError::NotFound(format!("Azure Function {} not found", name)))
    }

    async fn create_function(&self, region: &str, config: CreateFunctionRequest) -> Result<CloudResource> {
        let resource = self.make_resource(
            ResourceType::Function, &config.name, region, ResourceStatus::Available,
            serde_json::json!({"runtime": config.runtime, "handler": config.handler}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn update_function_code(&self, _region: &str, name: &str, _zip_bytes: Vec<u8>) -> Result<CloudResource> {
        self.store
            .get_by_name(name, self.provider, ResourceType::Function)
            .ok_or_else(|| CloudError::NotFound(format!("Azure Function {} not found", name)))
    }

    async fn delete_function(&self, _region: &str, name: &str) -> Result<()> {
        if let Some(r) = self.store.get_by_name(name, self.provider, ResourceType::Function) {
            self.store.delete(r.id);
        }
        Ok(())
    }

    async fn invoke_function(&self, _region: &str, _name: &str, payload: serde_json::Value) -> Result<serde_json::Value> {
        Ok(serde_json::json!({"status_code": 200, "payload": {"echo": payload}}))
    }

    async fn list_function_versions(&self, _region: &str, _name: &str) -> Result<Vec<CloudResource>> {
        Ok(vec![])
    }
}

#[async_trait]
impl NoSqlProvider for AzureProvider {
    async fn list_tables(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "azure", region = region, "Listing CosmosDB containers (mock/stub)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::NoSqlTable)))
    }

    async fn get_table(&self, region: &str, name: &str) -> Result<CloudResource> {
        self.store
            .get_by_name(name, self.provider, ResourceType::NoSqlTable)
            .ok_or_else(|| CloudError::NotFound(format!("CosmosDB container {} not found in {}", name, region)))
    }

    async fn create_table(
        &self,
        region: &str,
        name: &str,
        key_schema: serde_json::Value,
    ) -> Result<CloudResource> {
        let resource = self.make_resource(
            ResourceType::NoSqlTable,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({ "key_schema": key_schema, "type": "cosmosdb" }),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_table(&self, _region: &str, name: &str) -> Result<()> {
        if let Some(r) = self.store.get_by_name(name, self.provider, ResourceType::NoSqlTable) {
            self.store.delete(r.id);
        }
        Ok(())
    }

    async fn describe_table(&self, region: &str, name: &str) -> Result<serde_json::Value> {
        let table = self.get_table(region, name).await?;
        Ok(serde_json::json!({ "container_id": table.name, "status": "Online" }))
    }
}

#[async_trait]
impl CacheDbProvider for AzureProvider {
    async fn list_clusters(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "azure", region = region, "Listing Azure Cache for Redis instances (mock/stub)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::CacheCluster)))
    }

    async fn get_cluster(&self, region: &str, id: &str) -> Result<CloudResource> {
        let uuid = uuid::Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::CacheCluster)
            .ok_or_else(|| CloudError::NotFound(format!("Azure Cache instance {} not found in {}", id, region)))
    }

    async fn create_cluster(
        &self,
        region: &str,
        name: &str,
        engine: &str,
        node_type: &str,
    ) -> Result<CloudResource> {
        let resource = self.make_resource(
            ResourceType::CacheCluster,
            name,
            region,
            ResourceStatus::Creating,
            serde_json::json!({ "engine": engine, "sku": node_type }),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_cluster(&self, _region: &str, id: &str) -> Result<()> {
        let uuid = uuid::Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store.delete(uuid);
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// IoT Provider (mock)
// ---------------------------------------------------------------------------

#[async_trait]
impl IoTProvider for AzureProvider {
    async fn list_things(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "azure", region = region, "Listing IoT things (mock)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::IoTThing)))
    }

    async fn get_thing(&self, region: &str, name: &str) -> Result<CloudResource> {
        self.store
            .get_by_name(name, self.provider, ResourceType::IoTThing)
            .ok_or_else(|| CloudError::NotFound(format!("IoT thing {} not found", name)))
    }

    async fn create_thing(&self, region: &str, name: &str, attributes: serde_json::Value) -> Result<CloudResource> {
        let resource = self.make_resource(
            ResourceType::IoTThing, name, region, ResourceStatus::Available,
            serde_json::json!({ "attributes": attributes }), HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_thing(&self, _region: &str, name: &str) -> Result<()> {
        let thing = self.store.get_by_name(name, self.provider, ResourceType::IoTThing)
            .ok_or_else(|| CloudError::NotFound(format!("IoT thing {} not found", name)))?;
        self.store.delete(thing.id);
        Ok(())
    }

    async fn list_thing_groups(&self, region: &str) -> Result<Vec<CloudResource>> {
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::IoTThingGroup)))
    }
}

// ---------------------------------------------------------------------------
// ML Provider (mock)
// ---------------------------------------------------------------------------

#[async_trait]
impl MlProvider for AzureProvider {
    async fn list_models(&self, region: &str) -> Result<Vec<CloudResource>> {
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::MlModel)))
    }

    async fn list_endpoints(&self, region: &str) -> Result<Vec<CloudResource>> {
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::MlEndpoint)))
    }

    async fn list_training_jobs(&self, region: &str) -> Result<Vec<CloudResource>> {
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::MlTrainingJob)))
    }

    async fn create_endpoint(&self, region: &str, name: &str, model_name: &str) -> Result<CloudResource> {
        let resource = self.make_resource(
            ResourceType::MlEndpoint, name, region, ResourceStatus::Creating,
            serde_json::json!({ "model_name": model_name }), HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_endpoint(&self, _region: &str, name: &str) -> Result<()> {
        let ep = self.store.get_by_name(name, self.provider, ResourceType::MlEndpoint)
            .ok_or_else(|| CloudError::NotFound(format!("ML endpoint {} not found", name)))?;
        self.store.delete(ep.id);
        Ok(())
    }
}

#[async_trait]
impl ContainerRegistryProvider for AzureProvider {
    async fn list_registries(&self, region: &str) -> Result<Vec<CloudResource>> {
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::ContainerRegistry)))
    }
    async fn get_registry(&self, region: &str, id: &str) -> Result<CloudResource> {
        let uuid = Uuid::parse_str(id).map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store.get(uuid).filter(|r| r.provider == self.provider && r.resource_type == ResourceType::ContainerRegistry)
            .ok_or_else(|| CloudError::NotFound(format!("Azure ACR {} not found in {}", id, region)))
    }
    async fn create_registry(&self, region: &str, name: &str) -> Result<CloudResource> {
        let resource = self.make_resource(ResourceType::ContainerRegistry, name, region, ResourceStatus::Available,
            serde_json::json!({"platform": "acr"}), HashMap::new());
        self.store.insert(resource.clone());
        Ok(resource)
    }
    async fn delete_registry(&self, _region: &str, id: &str) -> Result<()> {
        let uuid = Uuid::parse_str(id).map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store.delete(uuid); Ok(())
    }
    async fn list_images(&self, _region: &str, _registry: &str) -> Result<Vec<CloudResource>> { Ok(vec![]) }
    async fn get_image_scan_results(&self, _region: &str, registry: &str, image_tag: &str) -> Result<serde_json::Value> {
        Ok(serde_json::json!({"repository": registry, "image_tag": image_tag, "scan_status": "NOT_AVAILABLE", "severity_counts": {}}))
    }
    async fn start_image_scan(&self, _region: &str, _registry: &str, _image_tag: &str) -> Result<()> {
        Err(CloudError::ProviderError("Image scanning not yet implemented for Azure".into()))
    }
}

#[async_trait]
impl WorkflowProvider for AzureProvider {
    async fn list_state_machines(&self, region: &str) -> Result<Vec<CloudResource>> {
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::StateMachine)))
    }
    async fn get_state_machine(&self, region: &str, arn: &str) -> Result<CloudResource> {
        Err(CloudError::NotFound(format!("Azure Logic App {} not found in {}", arn, region)))
    }
    async fn start_execution(&self, region: &str, _arn: &str, _input: serde_json::Value) -> Result<CloudResource> {
        Err(CloudError::ProviderError(format!("Azure Logic Apps start_execution not yet implemented in {}", region)))
    }
    async fn list_executions(&self, _region: &str, _arn: &str) -> Result<Vec<CloudResource>> { Ok(vec![]) }
}

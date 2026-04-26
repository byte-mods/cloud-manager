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

/// GCP cloud provider backed by InMemoryStore.
pub struct GcpProvider {
    pub provider: CloudProvider,
    pub store: Arc<InMemoryStore>,
}

impl GcpProvider {
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
impl ComputeProvider for GcpProvider {
    async fn list_instances(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing GCE instances");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Instance)))
    }

    async fn get_instance(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, id = id, "Getting GCE instance");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::Instance)
            .ok_or_else(|| CloudError::NotFound(format!("GCP instance {} not found in {}", id, region)))
    }

    async fn create_instance(
        &self,
        region: &str,
        config: CreateInstanceRequest,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, name = config.name.as_str(), "Creating GCE instance");
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
        tracing::info!(provider = "gcp", region = region, id = id, "Deleting GCE instance");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("GCP instance {} not found", id)))
        }
    }

    async fn start_instance(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, id = id, "Starting GCE instance");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.update_status(uuid, ResourceStatus::Running) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("GCP instance {} not found", id)))
        }
    }

    async fn stop_instance(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, id = id, "Stopping GCE instance");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.update_status(uuid, ResourceStatus::Stopped) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("GCP instance {} not found", id)))
        }
    }

    async fn reboot_instance(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, id = id, "Rebooting GCE instance");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.update_status(uuid, ResourceStatus::Running) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("GCP instance {} not found", id)))
        }
    }
}

#[async_trait]
impl StorageProvider for GcpProvider {
    async fn list_buckets(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing GCS buckets");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Bucket)))
    }

    async fn get_bucket(&self, region: &str, name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, name = name, "Getting GCS bucket");
        if let Ok(uuid) = Uuid::parse_str(name) {
            if let Some(r) = self.store.get(uuid).filter(|r| r.provider == self.provider && r.resource_type == ResourceType::Bucket) {
                return Ok(r);
            }
        }
        self.store
            .get_by_name(name, self.provider, ResourceType::Bucket)
            .ok_or_else(|| CloudError::NotFound(format!("GCP bucket {} not found", name)))
    }

    async fn create_bucket(
        &self,
        region: &str,
        config: CreateBucketRequest,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, name = config.name.as_str(), "Creating GCS bucket");
        let resource = self.make_resource(
            ResourceType::Bucket,
            &config.name,
            region,
            ResourceStatus::Available,
            serde_json::json!({
                "versioning": config.versioning,
                "encryption": if config.encryption { "Customer-managed" } else { "Google-managed" },
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
        tracing::info!(provider = "gcp", region = region, name = name, "Deleting GCS bucket");
        if let Ok(uuid) = Uuid::parse_str(name) {
            if self.store.delete(uuid) {
                return Ok(());
            }
        }
        if let Some(r) = self.store.get_by_name(name, self.provider, ResourceType::Bucket) {
            self.store.delete(r.id);
            return Ok(());
        }
        Err(CloudError::NotFound(format!("GCP bucket {} not found", name)))
    }

    async fn list_objects(
        &self,
        region: &str,
        bucket: &str,
        prefix: Option<&str>,
    ) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, bucket = bucket, prefix = ?prefix, "Listing GCS objects");
        let now = Utc::now();
        let prefix_str = prefix.unwrap_or("");
        let sample_objects = vec![
            CloudResource {
                id: Uuid::new_v4(),
                cloud_id: None,
                provider: self.provider,
                resource_type: ResourceType::Bucket,
                name: format!("{}main.js", prefix_str),
                region: region.to_string(),
                status: ResourceStatus::Available,
                metadata: serde_json::json!({"bucket": bucket, "content_type": "application/javascript", "size_bytes": 32768, "storage_class": "STANDARD"}),
                tags: HashMap::new(),
                created_at: now,
                updated_at: now,
            },
            CloudResource {
                id: Uuid::new_v4(),
                cloud_id: None,
                provider: self.provider,
                resource_type: ResourceType::Bucket,
                name: format!("{}styles.css", prefix_str),
                region: region.to_string(),
                status: ResourceStatus::Available,
                metadata: serde_json::json!({"bucket": bucket, "content_type": "text/css", "size_bytes": 8192, "storage_class": "STANDARD"}),
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
        tracing::info!(provider = "gcp", region = region, bucket = bucket, key = request.key.as_str(), "Uploading GCS object");
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
        tracing::info!(provider = "gcp", region = region, bucket = bucket, key = key, "Deleting GCS object");
        Ok(())
    }

    async fn get_bucket_policy(&self, _region: &str, _bucket: &str) -> Result<serde_json::Value> {
        Ok(serde_json::json!({"bindings": []}))
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
        Ok(serde_json::json!({"default_kms_key": null}))
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
impl NetworkingProvider for GcpProvider {
    async fn list_vpcs(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing VPC networks");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Vpc)))
    }

    async fn get_vpc(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, id = id, "Getting VPC network");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::Vpc)
            .ok_or_else(|| CloudError::NotFound(format!("GCP VPC {} not found in {}", id, region)))
    }

    async fn create_vpc(
        &self,
        region: &str,
        config: CreateVpcRequest,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, name = config.name.as_str(), "Creating VPC network");
        let resource = self.make_resource(
            ResourceType::Vpc,
            &config.name,
            region,
            ResourceStatus::Available,
            serde_json::json!({
                "cidr_block": config.cidr_block,
                "enable_dns": config.enable_dns,
                "auto_create_subnetworks": false,
                "routing_mode": "REGIONAL",
            }),
            config.tags,
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_vpc(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, id = id, "Deleting VPC network");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("GCP VPC {} not found", id)))
        }
    }

    async fn list_subnets(&self, region: &str, vpc_id: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, vpc_id = vpc_id, "Listing subnetworks");
        Ok(self.store.list_subnets_for_vpc(self.provider, region, vpc_id))
    }

    async fn create_subnet(
        &self,
        region: &str,
        config: CreateSubnetRequest,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, name = config.name.as_str(), "Creating subnetwork");
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
                "private_google_access": true,
            }),
            config.tags,
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_subnet(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, id = id, "Deleting subnetwork");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("GCP subnet {} not found", id)))
        }
    }

    async fn list_load_balancers(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing load balancers");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::LoadBalancer)))
    }

    async fn get_load_balancer(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, id = id, "Getting load balancer");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::LoadBalancer)
            .ok_or_else(|| CloudError::NotFound(format!("GCP load balancer {} not found in {}", id, region)))
    }

    async fn delete_load_balancer(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, id = id, "Deleting load balancer");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("GCP load balancer {} not found", id)))
        }
    }

    async fn list_security_groups(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing firewall rules");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::SecurityGroup)))
    }

    async fn list_elastic_ips(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing external IPs (stub)");
        Ok(Vec::new())
    }

    async fn allocate_elastic_ip(&self, region: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, "Allocating external IP (stub)");
        let resource = self.make_resource(ResourceType::ElasticIp, "gcp-eip-mock", region, ResourceStatus::Available, serde_json::json!({}), HashMap::new());
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn associate_elastic_ip(&self, _region: &str, _eip_id: &str, _instance_id: &str) -> Result<()> { Ok(()) }
    async fn disassociate_elastic_ip(&self, _region: &str, _association_id: &str) -> Result<()> { Ok(()) }
    async fn release_elastic_ip(&self, _region: &str, _allocation_id: &str) -> Result<()> { Ok(()) }

    async fn list_nat_gateways(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing Cloud NAT (stub)");
        Ok(Vec::new())
    }

    async fn create_nat_gateway(&self, region: &str, subnet_id: &str, _eip_allocation_id: &str) -> Result<CloudResource> {
        let resource = self.make_resource(ResourceType::NatGateway, "gcp-nat-mock", region, ResourceStatus::Available, serde_json::json!({"subnet_id": subnet_id}), HashMap::new());
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_nat_gateway(&self, _region: &str, _id: &str) -> Result<()> { Ok(()) }

    async fn list_internet_gateways(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(Vec::new()) }

    async fn create_internet_gateway(&self, region: &str) -> Result<CloudResource> {
        let resource = self.make_resource(ResourceType::InternetGateway, "gcp-igw-mock", region, ResourceStatus::Available, serde_json::json!({}), HashMap::new());
        Ok(resource)
    }

    async fn attach_internet_gateway(&self, _region: &str, _igw_id: &str, _vpc_id: &str) -> Result<()> { Ok(()) }
    async fn detach_internet_gateway(&self, _region: &str, _igw_id: &str, _vpc_id: &str) -> Result<()> { Ok(()) }
    async fn delete_internet_gateway(&self, _region: &str, _id: &str) -> Result<()> { Ok(()) }

    async fn list_route_tables(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(Vec::new()) }

    async fn create_route_table(&self, region: &str, vpc_id: &str) -> Result<CloudResource> {
        let resource = self.make_resource(ResourceType::RouteTable, "gcp-rt-mock", region, ResourceStatus::Available, serde_json::json!({"vpc_id": vpc_id}), HashMap::new());
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
        let resource = self.make_resource(ResourceType::VpcPeering, "gcp-pcx-mock", region, ResourceStatus::Pending, serde_json::json!({"requester_vpc_id": vpc_id, "accepter_vpc_id": peer_vpc_id}), HashMap::new());
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn accept_vpc_peering(&self, _region: &str, _peering_id: &str) -> Result<()> { Ok(()) }
    async fn delete_vpc_peering(&self, _region: &str, _peering_id: &str) -> Result<()> { Ok(()) }
}

#[async_trait]
impl DatabaseProvider for GcpProvider {
    async fn list_databases(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing Cloud SQL instances");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Database)))
    }

    async fn get_database(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, id = id, "Getting Cloud SQL instance");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::Database)
            .ok_or_else(|| CloudError::NotFound(format!("GCP Cloud SQL instance {} not found in {}", id, region)))
    }

    async fn create_database(
        &self,
        region: &str,
        config: CreateDatabaseRequest,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, name = config.name.as_str(), "Creating Cloud SQL instance");
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
                "endpoint": format!("{}:{}:{}", config.name, region, config.name),
                "backup_enabled": true,
            }),
            config.tags,
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_database(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, id = id, "Deleting Cloud SQL instance");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("GCP Cloud SQL instance {} not found", id)))
        }
    }

    async fn restart_database(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, id = id, "Restarting Cloud SQL instance");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.update_status(uuid, ResourceStatus::Running) {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("GCP Cloud SQL instance {} not found", id)))
        }
    }

    async fn create_snapshot(
        &self,
        region: &str,
        db_id: &str,
        snapshot_name: &str,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, db_id = db_id, snapshot_name = snapshot_name, "Creating Cloud SQL backup");
        let resource = self.make_resource(
            ResourceType::Snapshot,
            snapshot_name,
            region,
            ResourceStatus::Available,
            serde_json::json!({
                "source_db_id": db_id,
                "snapshot_type": "on-demand",
            }),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn create_read_replica(&self, region: &str, source_db_id: &str, replica_name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, "Creating Cloud SQL read replica (mock)");
        let resource = self.make_resource(ResourceType::Database, replica_name, region, ResourceStatus::Creating,
            serde_json::json!({"source_db_id": source_db_id, "role": "read_replica"}), HashMap::new());
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn list_parameter_groups(&self, _region: &str) -> Result<Vec<CloudResource>> {
        Ok(vec![])
    }

    async fn get_parameter_group(&self, _region: &str, name: &str) -> Result<serde_json::Value> {
        Ok(serde_json::json!({"name": name, "description": "GCP Cloud SQL flags (stub)"}))
    }

    async fn restore_to_point_in_time(&self, region: &str, source_db_id: &str, target_name: &str, restore_time: &str) -> Result<CloudResource> {
        let resource = self.make_resource(ResourceType::Database, target_name, region, ResourceStatus::Creating,
            serde_json::json!({"source_db_id": source_db_id, "restore_time": restore_time}), HashMap::new());
        self.store.insert(resource.clone());
        Ok(resource)
    }
}

// ---------------------------------------------------------------------------
// Kubernetes (GKE) — stub implementation
// ---------------------------------------------------------------------------

#[async_trait]
impl KubernetesProvider for GcpProvider {
    async fn list_clusters(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing GKE clusters (stub)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::EksCluster)))
    }

    async fn get_cluster(&self, region: &str, name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, name = name, "Getting GKE cluster (stub)");
        self.store
            .list(self.provider, Some(region), Some(ResourceType::EksCluster))
            .into_iter()
            .find(|r| r.name == name)
            .ok_or_else(|| CloudError::NotFound(format!("GKE cluster {} not found in {}", name, region)))
    }

    async fn create_cluster(&self, region: &str, config: CreateClusterRequest) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, name = config.name.as_str(), "Creating GKE cluster (stub)");
        let resource = self.make_resource(
            ResourceType::EksCluster,
            &config.name,
            region,
            ResourceStatus::Creating,
            serde_json::json!({ "version": config.version, "platform": "gke" }),
            config.tags,
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_cluster(&self, region: &str, name: &str) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, name = name, "Deleting GKE cluster (stub)");
        let cluster = KubernetesProvider::get_cluster(self, region, name).await?;
        self.store.delete(cluster.id);
        Ok(())
    }

    async fn list_node_groups(&self, region: &str, cluster_name: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, cluster = cluster_name, "Listing GKE node pools (stub)");
        Ok(self
            .store
            .list(self.provider, Some(region), Some(ResourceType::EksNodeGroup))
            .into_iter()
            .filter(|r| r.metadata.get("cluster_name").and_then(|v| v.as_str()) == Some(cluster_name))
            .collect())
    }

    async fn create_node_group(&self, region: &str, cluster_name: &str, config: CreateNodeGroupRequest) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, cluster = cluster_name, name = config.name.as_str(), "Creating GKE node pool (stub)");
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
        tracing::info!(provider = "gcp", region = region, cluster = cluster_name, ng = node_group_name, "Deleting GKE node pool (stub)");
        let groups = self.list_node_groups(region, cluster_name).await?;
        if let Some(ng) = groups.into_iter().find(|r| r.name == node_group_name) {
            self.store.delete(ng.id);
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("Node pool {} not found", node_group_name)))
        }
    }

    async fn scale_node_group(&self, region: &str, cluster_name: &str, node_group_name: &str, desired: i32) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, cluster = cluster_name, ng = node_group_name, desired = desired, "Scaling GKE node pool (stub)");
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Traffic — stub implementation
// ---------------------------------------------------------------------------

#[async_trait]
impl TrafficProvider for GcpProvider {
    async fn get_flow_logs(&self, region: &str, _log_group: Option<&str>, _start_time: Option<i64>, _end_time: Option<i64>) -> Result<FlowLogResponse> {
        tracing::info!(provider = "gcp", region = region, "Fetching VPC flow logs (stub)");
        Ok(FlowLogResponse { entries: vec![], query_id: None })
    }

    async fn get_traffic_summary(&self, region: &str) -> Result<TrafficSummary> {
        tracing::info!(provider = "gcp", region = region, "Building traffic summary (stub)");
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
// API Gateway — stub implementation
// ---------------------------------------------------------------------------

#[async_trait]
impl ApiGatewayProvider for GcpProvider {
    async fn list_apis(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing API Gateway APIs (stub)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::ApiGateway)))
    }

    async fn get_api(&self, region: &str, id: &str) -> Result<CloudResource> {
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::ApiGateway)
            .ok_or_else(|| CloudError::NotFound(format!("GCP API Gateway {} not found in {}", id, region)))
    }

    async fn create_api(&self, region: &str, name: &str, protocol: &str) -> Result<CloudResource> {
        let resource = self.make_resource(
            ResourceType::ApiGateway,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({"protocol_type": protocol, "platform": "gcp_api_gateway"}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_api(&self, region: &str, id: &str) -> Result<()> {
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.delete(uuid) { Ok(()) }
        else { Err(CloudError::NotFound(format!("GCP API Gateway {} not found in {}", id, region))) }
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
// CDN — stub implementation
// ---------------------------------------------------------------------------

#[async_trait]
impl CdnProvider for GcpProvider {
    async fn list_distributions(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing Cloud CDN distributions (stub)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::CdnDistribution)))
    }

    async fn get_distribution(&self, region: &str, id: &str) -> Result<CloudResource> {
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::CdnDistribution)
            .ok_or_else(|| CloudError::NotFound(format!("GCP CDN distribution {} not found in {}", id, region)))
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
                "platform": "cloud_cdn",
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
        else { Err(CloudError::NotFound(format!("GCP CDN distribution {} not found in {}", id, region))) }
    }

    async fn invalidate_cache(&self, region: &str, distribution_id: &str, paths: Vec<String>) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, distribution_id = distribution_id, paths = ?paths, "Invalidating CDN cache (stub)");
        Ok(())
    }
}

#[async_trait]
impl ServerlessProvider for GcpProvider {
    async fn list_functions(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing Cloud Functions (mock)");
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
            .ok_or_else(|| CloudError::NotFound(format!("GCP Cloud Function {} not found", name)))
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
            .ok_or_else(|| CloudError::NotFound(format!("GCP Cloud Function {} not found", name)))
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
impl NoSqlProvider for GcpProvider {
    async fn list_tables(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing Firestore collections (mock/stub)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::NoSqlTable)))
    }

    async fn get_table(&self, region: &str, name: &str) -> Result<CloudResource> {
        self.store
            .get_by_name(name, self.provider, ResourceType::NoSqlTable)
            .ok_or_else(|| CloudError::NotFound(format!("Firestore collection {} not found in {}", name, region)))
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
            serde_json::json!({ "key_schema": key_schema, "type": "firestore" }),
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
        Ok(serde_json::json!({ "collection_id": table.name, "status": "ACTIVE" }))
    }
}

#[async_trait]
impl CacheDbProvider for GcpProvider {
    async fn list_clusters(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing Memorystore instances (mock/stub)");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::CacheCluster)))
    }

    async fn get_cluster(&self, region: &str, id: &str) -> Result<CloudResource> {
        let uuid = uuid::Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::CacheCluster)
            .ok_or_else(|| CloudError::NotFound(format!("Memorystore instance {} not found in {}", id, region)))
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
            serde_json::json!({ "engine": engine, "node_type": node_type }),
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
impl IoTProvider for GcpProvider {
    async fn list_things(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing IoT things (mock)");
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
impl MlProvider for GcpProvider {
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
impl ContainerRegistryProvider for GcpProvider {
    async fn list_registries(&self, region: &str) -> Result<Vec<CloudResource>> {
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::ContainerRegistry)))
    }
    async fn get_registry(&self, region: &str, id: &str) -> Result<CloudResource> {
        let uuid = Uuid::parse_str(id).map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store.get(uuid).filter(|r| r.provider == self.provider && r.resource_type == ResourceType::ContainerRegistry)
            .ok_or_else(|| CloudError::NotFound(format!("GCP Artifact Registry {} not found in {}", id, region)))
    }
    async fn create_registry(&self, region: &str, name: &str) -> Result<CloudResource> {
        let resource = self.make_resource(ResourceType::ContainerRegistry, name, region, ResourceStatus::Available,
            serde_json::json!({"platform": "artifact_registry"}), HashMap::new());
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
        Err(CloudError::ProviderError("Image scanning not yet implemented for GCP".into()))
    }
}

#[async_trait]
impl WorkflowProvider for GcpProvider {
    async fn list_state_machines(&self, region: &str) -> Result<Vec<CloudResource>> {
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::StateMachine)))
    }
    async fn get_state_machine(&self, region: &str, arn: &str) -> Result<CloudResource> {
        Err(CloudError::NotFound(format!("GCP Workflow {} not found in {}", arn, region)))
    }
    async fn start_execution(&self, region: &str, _arn: &str, _input: serde_json::Value) -> Result<CloudResource> {
        Err(CloudError::ProviderError(format!("GCP Workflows start_execution not yet implemented in {}", region)))
    }
    async fn list_executions(&self, _region: &str, _arn: &str) -> Result<Vec<CloudResource>> { Ok(vec![]) }
}

// ---------------------------------------------------------------------------
// IAM Provider
// ---------------------------------------------------------------------------

#[async_trait]
impl IamProvider for GcpProvider {
    async fn list_users(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing IAM users");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::IamUser)))
    }

    async fn create_user(&self, region: &str, username: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, username = username, "Creating IAM user");
        let resource = self.make_resource(
            ResourceType::IamUser,
            username,
            region,
            ResourceStatus::Available,
            serde_json::json!({"username": username, "platform": "gcp_iam"}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_user(&self, region: &str, username: &str) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, username = username, "Deleting IAM user");
        if let Some(r) = self.store.get_by_name(username, self.provider, ResourceType::IamUser) {
            self.store.delete(r.id);
            return Ok(());
        }
        Err(CloudError::NotFound(format!("GCP IAM user {} not found in {}", username, region)))
    }

    async fn list_roles(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing IAM roles");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::IamRole)))
    }

    async fn create_role(&self, region: &str, name: &str, trust_policy: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, name = name, "Creating IAM role");
        let resource = self.make_resource(
            ResourceType::IamRole,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({"trust_policy": trust_policy, "platform": "gcp_iam"}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_role(&self, region: &str, name: &str) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, name = name, "Deleting IAM role");
        if let Some(r) = self.store.get_by_name(name, self.provider, ResourceType::IamRole) {
            self.store.delete(r.id);
            return Ok(());
        }
        Err(CloudError::NotFound(format!("GCP IAM role {} not found in {}", name, region)))
    }

    async fn list_policies(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing IAM policies");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::IamPolicy)))
    }

    async fn attach_policy(&self, region: &str, target: &str, policy_arn: &str) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, target = target, policy = policy_arn, "Attaching IAM policy");
        Ok(())
    }

    async fn detach_policy(&self, region: &str, target: &str, policy_arn: &str) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, target = target, policy = policy_arn, "Detaching IAM policy");
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// DNS Provider
// ---------------------------------------------------------------------------

#[async_trait]
impl DnsProvider for GcpProvider {
    async fn list_hosted_zones(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing Cloud DNS zones");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::DnsZone)))
    }

    async fn list_records(&self, region: &str, zone_id: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, zone_id = zone_id, "Listing DNS records");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::DnsRecord)))
    }

    async fn create_record(&self, region: &str, zone_id: &str, record: DnsRecordInput) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, zone_id = zone_id, name = record.name.as_str(), "Creating DNS record");
        let resource = self.make_resource(
            ResourceType::DnsRecord,
            &record.name,
            region,
            ResourceStatus::Available,
            serde_json::json!({
                "zone_id": zone_id,
                "record_type": record.record_type,
                "ttl": record.ttl,
                "values": record.values,
            }),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_record(&self, region: &str, zone_id: &str, record: DnsRecordInput) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, zone_id = zone_id, name = record.name.as_str(), "Deleting DNS record");
        if let Some(r) = self.store.get_by_name(&record.name, self.provider, ResourceType::DnsRecord) {
            self.store.delete(r.id);
            return Ok(());
        }
        Err(CloudError::NotFound(format!("GCP DNS record {} not found in zone {}", record.name, zone_id)))
    }
}

// ---------------------------------------------------------------------------
// WAF Provider
// ---------------------------------------------------------------------------

#[async_trait]
impl WafProvider for GcpProvider {
    async fn list_web_acls(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing Cloud Armor policies");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::WafRule)))
    }

    async fn get_web_acl(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, id = id, "Getting Cloud Armor policy");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::WafRule)
            .ok_or_else(|| CloudError::NotFound(format!("GCP Cloud Armor policy {} not found in {}", id, region)))
    }

    async fn list_rules(&self, region: &str, acl_id: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, acl_id = acl_id, "Listing Cloud Armor rules");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::WafRule)))
    }

    async fn create_web_acl(&self, region: &str, name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, name = name, "Creating Cloud Armor policy");
        let resource = self.make_resource(
            ResourceType::WafRule,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({"platform": "cloud_armor", "type": "security_policy"}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_web_acl(&self, _region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "gcp", id = id, "Deleting Cloud Armor policy");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store.delete(uuid);
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Messaging Provider
// ---------------------------------------------------------------------------

#[async_trait]
impl MessagingProvider for GcpProvider {
    async fn list_queues(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing Cloud Tasks queues");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Queue)))
    }

    async fn get_queue(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, id = id, "Getting Cloud Tasks queue");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::Queue)
            .ok_or_else(|| CloudError::NotFound(format!("GCP queue {} not found in {}", id, region)))
    }

    async fn create_queue(&self, region: &str, name: &str, fifo: bool) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, name = name, "Creating Cloud Tasks queue");
        let resource = self.make_resource(
            ResourceType::Queue,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({"platform": "cloud_tasks", "fifo": fifo}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_queue(&self, _region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "gcp", id = id, "Deleting Cloud Tasks queue");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store.delete(uuid);
        Ok(())
    }

    async fn list_topics(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing Pub/Sub topics");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Topic)))
    }

    async fn create_topic(&self, region: &str, name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, name = name, "Creating Pub/Sub topic");
        let resource = self.make_resource(
            ResourceType::Topic,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({"platform": "pubsub"}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_topic(&self, _region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "gcp", id = id, "Deleting Pub/Sub topic");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store.delete(uuid);
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// KMS Provider
// ---------------------------------------------------------------------------

#[async_trait]
impl KmsProvider for GcpProvider {
    async fn list_keys(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing Cloud KMS keys");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::KmsKey)))
    }

    async fn get_key(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, id = id, "Getting Cloud KMS key");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::KmsKey)
            .ok_or_else(|| CloudError::NotFound(format!("GCP KMS key {} not found in {}", id, region)))
    }

    async fn create_key(&self, region: &str, name: &str, key_type: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, name = name, "Creating Cloud KMS key");
        let resource = self.make_resource(
            ResourceType::KmsKey,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({"platform": "cloud_kms", "key_type": key_type, "enabled": true}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn schedule_key_deletion(&self, region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, id = id, "Scheduling Cloud KMS key deletion");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store.update_status(uuid, ResourceStatus::Deleting);
        Ok(())
    }

    async fn set_key_enabled(&self, region: &str, id: &str, enabled: bool) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, id = id, enabled = enabled, "Setting Cloud KMS key enabled state");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        let status = if enabled { ResourceStatus::Available } else { ResourceStatus::Stopped };
        self.store.update_status(uuid, status);
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// AutoScaling Provider
// ---------------------------------------------------------------------------

#[async_trait]
impl AutoScalingProvider for GcpProvider {
    async fn list_groups(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing managed instance groups");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::AutoScalingGroup)))
    }

    async fn get_group(&self, region: &str, id: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, id = id, "Getting managed instance group");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store
            .get(uuid)
            .filter(|r| r.provider == self.provider && r.resource_type == ResourceType::AutoScalingGroup)
            .ok_or_else(|| CloudError::NotFound(format!("GCP MIG {} not found in {}", id, region)))
    }

    async fn create_group(
        &self,
        region: &str,
        name: &str,
        min_size: u32,
        max_size: u32,
        desired: u32,
    ) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, name = name, "Creating managed instance group");
        let resource = self.make_resource(
            ResourceType::AutoScalingGroup,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({
                "platform": "managed_instance_group",
                "min_size": min_size,
                "max_size": max_size,
                "desired_capacity": desired,
            }),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn delete_group(&self, _region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "gcp", id = id, "Deleting managed instance group");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store.delete(uuid);
        Ok(())
    }

    async fn set_desired_capacity(&self, region: &str, id: &str, desired: u32) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, id = id, desired = desired, "Setting MIG desired capacity");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        if self.store.get(uuid).is_some() {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("GCP MIG {} not found in {}", id, region)))
        }
    }
}

// ---------------------------------------------------------------------------
// Volume Provider
// ---------------------------------------------------------------------------

#[async_trait]
impl VolumeProvider for GcpProvider {
    async fn list_volumes(&self, region: &str) -> Result<Vec<CloudResource>> {
        tracing::info!(provider = "gcp", region = region, "Listing Persistent Disks");
        Ok(self.store.list(self.provider, Some(region), Some(ResourceType::Volume)))
    }

    async fn create_volume(&self, region: &str, size_gb: i32, volume_type: &str, az: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, size_gb = size_gb, "Creating Persistent Disk");
        let name = format!("pd-{}", &Uuid::new_v4().to_string()[..8]);
        let resource = self.make_resource(
            ResourceType::Volume,
            &name,
            region,
            ResourceStatus::Available,
            serde_json::json!({
                "platform": "persistent_disk",
                "size_gb": size_gb,
                "volume_type": volume_type,
                "availability_zone": az,
            }),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }

    async fn attach_volume(&self, region: &str, volume_id: &str, instance_id: &str, device: &str) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, volume_id = volume_id, instance_id = instance_id, device = device, "Attaching Persistent Disk");
        let uuid = Uuid::parse_str(volume_id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", volume_id)))?;
        if self.store.get(uuid).is_some() {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("GCP volume {} not found in {}", volume_id, region)))
        }
    }

    async fn detach_volume(&self, region: &str, volume_id: &str) -> Result<()> {
        tracing::info!(provider = "gcp", region = region, volume_id = volume_id, "Detaching Persistent Disk");
        let uuid = Uuid::parse_str(volume_id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", volume_id)))?;
        if self.store.get(uuid).is_some() {
            Ok(())
        } else {
            Err(CloudError::NotFound(format!("GCP volume {} not found in {}", volume_id, region)))
        }
    }

    async fn delete_volume(&self, _region: &str, id: &str) -> Result<()> {
        tracing::info!(provider = "gcp", id = id, "Deleting Persistent Disk");
        let uuid = Uuid::parse_str(id)
            .map_err(|_| CloudError::BadRequest(format!("Invalid UUID: {}", id)))?;
        self.store.delete(uuid);
        Ok(())
    }

    async fn create_volume_snapshot(&self, region: &str, volume_id: &str, name: &str) -> Result<CloudResource> {
        tracing::info!(provider = "gcp", region = region, volume_id = volume_id, name = name, "Creating Persistent Disk snapshot");
        let resource = self.make_resource(
            ResourceType::Snapshot,
            name,
            region,
            ResourceStatus::Available,
            serde_json::json!({"platform": "persistent_disk_snapshot", "source_volume_id": volume_id}),
            HashMap::new(),
        );
        self.store.insert(resource.clone());
        Ok(resource)
    }
}

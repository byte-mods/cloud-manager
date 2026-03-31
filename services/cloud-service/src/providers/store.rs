use chrono::Utc;
use std::collections::HashMap;
use std::sync::RwLock;
use uuid::Uuid;

use crate::models::{CloudProvider, CloudResource, ResourceStatus, ResourceType};

/// Thread-safe in-memory store for cloud resources.
pub struct InMemoryStore {
    resources: RwLock<HashMap<Uuid, CloudResource>>,
}

impl InMemoryStore {
    pub fn new() -> Self {
        Self {
            resources: RwLock::new(HashMap::new()),
        }
    }

    /// List resources filtered by provider, optional region, and optional resource type.
    pub fn list(
        &self,
        provider: CloudProvider,
        region: Option<&str>,
        resource_type: Option<ResourceType>,
    ) -> Vec<CloudResource> {
        let store = self.resources.read().unwrap();
        store
            .values()
            .filter(|r| r.provider == provider)
            .filter(|r| region.map_or(true, |reg| r.region == reg))
            .filter(|r| resource_type.map_or(true, |rt| r.resource_type == rt))
            .cloned()
            .collect()
    }

    /// Get a single resource by ID.
    pub fn get(&self, id: Uuid) -> Option<CloudResource> {
        let store = self.resources.read().unwrap();
        store.get(&id).cloned()
    }

    /// Get a resource by name, provider, and resource type.
    pub fn get_by_name(
        &self,
        name: &str,
        provider: CloudProvider,
        resource_type: ResourceType,
    ) -> Option<CloudResource> {
        let store = self.resources.read().unwrap();
        store
            .values()
            .find(|r| r.name == name && r.provider == provider && r.resource_type == resource_type)
            .cloned()
    }

    /// Insert a resource into the store. Returns the resource ID.
    pub fn insert(&self, resource: CloudResource) -> Uuid {
        let id = resource.id;
        let mut store = self.resources.write().unwrap();
        store.insert(id, resource);
        id
    }

    /// Delete a resource by ID. Returns true if it existed.
    pub fn delete(&self, id: Uuid) -> bool {
        let mut store = self.resources.write().unwrap();
        store.remove(&id).is_some()
    }

    /// Update the status of a resource. Returns true if found and updated.
    pub fn update_status(&self, id: Uuid, status: ResourceStatus) -> bool {
        let mut store = self.resources.write().unwrap();
        if let Some(resource) = store.get_mut(&id) {
            resource.status = status;
            resource.updated_at = Utc::now();
            true
        } else {
            false
        }
    }

    /// List subnets that belong to a specific VPC (matched via metadata.vpc_id).
    pub fn list_subnets_for_vpc(
        &self,
        provider: CloudProvider,
        region: &str,
        vpc_id: &str,
    ) -> Vec<CloudResource> {
        let store = self.resources.read().unwrap();
        store
            .values()
            .filter(|r| {
                r.provider == provider
                    && r.region == region
                    && r.resource_type == ResourceType::Subnet
                    && r.metadata.get("vpc_id").and_then(|v| v.as_str()) == Some(vpc_id)
            })
            .cloned()
            .collect()
    }
}

/// Create and seed the in-memory store with realistic cloud resources.
pub fn create_seeded_store() -> InMemoryStore {
    let store = InMemoryStore::new();
    let now = Utc::now();

    // Helper to build a resource
    macro_rules! res {
        ($provider:expr, $rt:expr, $name:expr, $region:expr, $status:expr, $meta:expr, $tags:expr) => {
            CloudResource {
                id: Uuid::new_v4(),
                cloud_id: None,
                provider: $provider,
                resource_type: $rt,
                name: $name.to_string(),
                region: $region.to_string(),
                status: $status,
                metadata: $meta,
                tags: $tags,
                created_at: now,
                updated_at: now,
            }
        };
    }

    macro_rules! tags {
        ($($k:expr => $v:expr),* $(,)?) => {{
            let mut m = HashMap::new();
            $( m.insert($k.to_string(), $v.to_string()); )*
            m
        }};
    }

    // ============================================================
    // AWS Resources (us-east-1)
    // ============================================================

    // EC2 Instances
    store.insert(res!(
        CloudProvider::Aws, ResourceType::Instance, "web-server-1", "us-east-1",
        ResourceStatus::Running,
        serde_json::json!({
            "instance_type": "t3.large",
            "image_id": "ami-0c55b159cbfafe1f0",
            "private_ip": "10.0.1.15",
            "public_ip": "54.210.123.45",
            "vpc_id": "vpc-prod",
            "subnet_id": "subnet-prod-public-1a",
            "key_pair": "prod-keypair",
            "availability_zone": "us-east-1a"
        }),
        tags!("env" => "production", "team" => "platform", "Name" => "web-server-1")
    ));

    store.insert(res!(
        CloudProvider::Aws, ResourceType::Instance, "api-server-1", "us-east-1",
        ResourceStatus::Running,
        serde_json::json!({
            "instance_type": "m5.xlarge",
            "image_id": "ami-0c55b159cbfafe1f0",
            "private_ip": "10.0.1.20",
            "public_ip": "54.210.123.46",
            "vpc_id": "vpc-prod",
            "subnet_id": "subnet-prod-public-1a",
            "key_pair": "prod-keypair",
            "availability_zone": "us-east-1a"
        }),
        tags!("env" => "production", "team" => "backend", "Name" => "api-server-1")
    ));

    store.insert(res!(
        CloudProvider::Aws, ResourceType::Instance, "batch-worker-1", "us-east-1",
        ResourceStatus::Stopped,
        serde_json::json!({
            "instance_type": "c5.2xlarge",
            "image_id": "ami-0c55b159cbfafe1f0",
            "private_ip": "10.0.10.30",
            "vpc_id": "vpc-prod",
            "subnet_id": "subnet-prod-private-1a",
            "key_pair": "prod-keypair",
            "availability_zone": "us-east-1a"
        }),
        tags!("env" => "production", "team" => "data", "Name" => "batch-worker-1")
    ));

    store.insert(res!(
        CloudProvider::Aws, ResourceType::Instance, "dev-instance-1", "us-east-1",
        ResourceStatus::Running,
        serde_json::json!({
            "instance_type": "t3.medium",
            "image_id": "ami-0c55b159cbfafe1f0",
            "private_ip": "172.16.0.10",
            "public_ip": "3.95.12.78",
            "vpc_id": "vpc-dev",
            "subnet_id": "subnet-dev-public",
            "key_pair": "dev-keypair",
            "availability_zone": "us-east-1a"
        }),
        tags!("env" => "development", "team" => "engineering", "Name" => "dev-instance-1")
    ));

    // S3 Buckets
    store.insert(res!(
        CloudProvider::Aws, ResourceType::Bucket, "app-assets-prod", "us-east-1",
        ResourceStatus::Available,
        serde_json::json!({
            "versioning": true,
            "encryption": "AES256",
            "public_access": false,
            "storage_class": "STANDARD",
            "object_count": 15234,
            "total_size_bytes": 5368709120_u64
        }),
        tags!("env" => "production", "team" => "frontend")
    ));

    store.insert(res!(
        CloudProvider::Aws, ResourceType::Bucket, "data-lake-raw", "us-east-1",
        ResourceStatus::Available,
        serde_json::json!({
            "versioning": false,
            "encryption": "aws:kms",
            "public_access": false,
            "storage_class": "STANDARD_IA",
            "object_count": 892451,
            "total_size_bytes": 107374182400_u64
        }),
        tags!("env" => "production", "team" => "data")
    ));

    store.insert(res!(
        CloudProvider::Aws, ResourceType::Bucket, "backup-vault-2024", "us-east-1",
        ResourceStatus::Available,
        serde_json::json!({
            "versioning": true,
            "encryption": "aws:kms",
            "public_access": false,
            "storage_class": "GLACIER",
            "object_count": 3456,
            "total_size_bytes": 21474836480_u64
        }),
        tags!("env" => "production", "team" => "ops")
    ));

    // VPCs
    let aws_prod_vpc_id = Uuid::new_v4();
    store.insert(CloudResource {
        id: aws_prod_vpc_id,
        cloud_id: None,
        provider: CloudProvider::Aws,
        resource_type: ResourceType::Vpc,
        name: "prod-vpc".to_string(),
        region: "us-east-1".to_string(),
        status: ResourceStatus::Available,
        metadata: serde_json::json!({
            "cidr_block": "10.0.0.0/16",
            "enable_dns": true,
            "is_default": false,
            "dhcp_options_id": "dopt-abc123"
        }),
        tags: tags!("env" => "production", "Name" => "prod-vpc"),
        created_at: now,
        updated_at: now,
    });

    let aws_dev_vpc_id = Uuid::new_v4();
    store.insert(CloudResource {
        id: aws_dev_vpc_id,
        cloud_id: None,
        provider: CloudProvider::Aws,
        resource_type: ResourceType::Vpc,
        name: "dev-vpc".to_string(),
        region: "us-east-1".to_string(),
        status: ResourceStatus::Available,
        metadata: serde_json::json!({
            "cidr_block": "172.16.0.0/16",
            "enable_dns": true,
            "is_default": false,
            "dhcp_options_id": "dopt-def456"
        }),
        tags: tags!("env" => "development", "Name" => "dev-vpc"),
        created_at: now,
        updated_at: now,
    });

    // Subnets
    store.insert(res!(
        CloudProvider::Aws, ResourceType::Subnet, "prod-public-1a", "us-east-1",
        ResourceStatus::Available,
        serde_json::json!({
            "cidr_block": "10.0.1.0/24",
            "vpc_id": aws_prod_vpc_id.to_string(),
            "availability_zone": "us-east-1a",
            "is_public": true,
            "available_ips": 251
        }),
        tags!("env" => "production", "Name" => "prod-public-1a")
    ));

    store.insert(res!(
        CloudProvider::Aws, ResourceType::Subnet, "prod-private-1a", "us-east-1",
        ResourceStatus::Available,
        serde_json::json!({
            "cidr_block": "10.0.10.0/24",
            "vpc_id": aws_prod_vpc_id.to_string(),
            "availability_zone": "us-east-1a",
            "is_public": false,
            "available_ips": 250
        }),
        tags!("env" => "production", "Name" => "prod-private-1a")
    ));

    store.insert(res!(
        CloudProvider::Aws, ResourceType::Subnet, "prod-public-1b", "us-east-1",
        ResourceStatus::Available,
        serde_json::json!({
            "cidr_block": "10.0.2.0/24",
            "vpc_id": aws_prod_vpc_id.to_string(),
            "availability_zone": "us-east-1b",
            "is_public": true,
            "available_ips": 251
        }),
        tags!("env" => "production", "Name" => "prod-public-1b")
    ));

    store.insert(res!(
        CloudProvider::Aws, ResourceType::Subnet, "prod-private-1b", "us-east-1",
        ResourceStatus::Available,
        serde_json::json!({
            "cidr_block": "10.0.11.0/24",
            "vpc_id": aws_prod_vpc_id.to_string(),
            "availability_zone": "us-east-1b",
            "is_public": false,
            "available_ips": 250
        }),
        tags!("env" => "production", "Name" => "prod-private-1b")
    ));

    // RDS Databases
    store.insert(res!(
        CloudProvider::Aws, ResourceType::Database, "prod-postgres", "us-east-1",
        ResourceStatus::Running,
        serde_json::json!({
            "engine": "postgresql",
            "engine_version": "15.4",
            "instance_class": "db.r6g.xlarge",
            "storage_gb": 500,
            "multi_az": true,
            "endpoint": "prod-postgres.cluster-abc123.us-east-1.rds.amazonaws.com",
            "port": 5432,
            "storage_encrypted": true
        }),
        tags!("env" => "production", "team" => "backend", "Name" => "prod-postgres")
    ));

    store.insert(res!(
        CloudProvider::Aws, ResourceType::Database, "analytics-mysql", "us-east-1",
        ResourceStatus::Running,
        serde_json::json!({
            "engine": "mysql",
            "engine_version": "8.0",
            "instance_class": "db.r5.large",
            "storage_gb": 200,
            "multi_az": false,
            "endpoint": "analytics-mysql.abc123.us-east-1.rds.amazonaws.com",
            "port": 3306,
            "storage_encrypted": true
        }),
        tags!("env" => "production", "team" => "data", "Name" => "analytics-mysql")
    ));

    // Load Balancers
    store.insert(res!(
        CloudProvider::Aws, ResourceType::LoadBalancer, "prod-alb", "us-east-1",
        ResourceStatus::Available,
        serde_json::json!({
            "type": "application",
            "scheme": "internet-facing",
            "dns_name": "prod-alb-1234567890.us-east-1.elb.amazonaws.com",
            "vpc_id": aws_prod_vpc_id.to_string(),
            "subnets": ["subnet-prod-public-1a", "subnet-prod-public-1b"],
            "security_groups": ["web-sg"],
            "listeners": [{"port": 443, "protocol": "HTTPS"}, {"port": 80, "protocol": "HTTP"}]
        }),
        tags!("env" => "production", "Name" => "prod-alb")
    ));

    store.insert(res!(
        CloudProvider::Aws, ResourceType::LoadBalancer, "internal-nlb", "us-east-1",
        ResourceStatus::Available,
        serde_json::json!({
            "type": "network",
            "scheme": "internal",
            "dns_name": "internal-nlb-0987654321.us-east-1.elb.amazonaws.com",
            "vpc_id": aws_prod_vpc_id.to_string(),
            "subnets": ["subnet-prod-private-1a", "subnet-prod-private-1b"],
            "listeners": [{"port": 8080, "protocol": "TCP"}]
        }),
        tags!("env" => "production", "Name" => "internal-nlb")
    ));

    // Security Groups
    store.insert(res!(
        CloudProvider::Aws, ResourceType::SecurityGroup, "web-sg", "us-east-1",
        ResourceStatus::Available,
        serde_json::json!({
            "vpc_id": aws_prod_vpc_id.to_string(),
            "description": "Security group for web servers",
            "inbound_rules": [
                {"protocol": "tcp", "port": 80, "source": "0.0.0.0/0"},
                {"protocol": "tcp", "port": 443, "source": "0.0.0.0/0"}
            ],
            "outbound_rules": [
                {"protocol": "-1", "port": 0, "destination": "0.0.0.0/0"}
            ]
        }),
        tags!("env" => "production", "Name" => "web-sg")
    ));

    store.insert(res!(
        CloudProvider::Aws, ResourceType::SecurityGroup, "api-sg", "us-east-1",
        ResourceStatus::Available,
        serde_json::json!({
            "vpc_id": aws_prod_vpc_id.to_string(),
            "description": "Security group for API servers",
            "inbound_rules": [
                {"protocol": "tcp", "port": 8080, "source": "10.0.0.0/16"},
                {"protocol": "tcp", "port": 8443, "source": "10.0.0.0/16"}
            ],
            "outbound_rules": [
                {"protocol": "-1", "port": 0, "destination": "0.0.0.0/0"}
            ]
        }),
        tags!("env" => "production", "Name" => "api-sg")
    ));

    store.insert(res!(
        CloudProvider::Aws, ResourceType::SecurityGroup, "db-sg", "us-east-1",
        ResourceStatus::Available,
        serde_json::json!({
            "vpc_id": aws_prod_vpc_id.to_string(),
            "description": "Security group for database servers",
            "inbound_rules": [
                {"protocol": "tcp", "port": 5432, "source": "10.0.0.0/16"},
                {"protocol": "tcp", "port": 3306, "source": "10.0.0.0/16"}
            ],
            "outbound_rules": [
                {"protocol": "-1", "port": 0, "destination": "0.0.0.0/0"}
            ]
        }),
        tags!("env" => "production", "Name" => "db-sg")
    ));

    // ============================================================
    // GCP Resources (us-central1)
    // ============================================================

    // GCE Instances
    store.insert(res!(
        CloudProvider::Gcp, ResourceType::Instance, "gcp-web-1", "us-central1",
        ResourceStatus::Running,
        serde_json::json!({
            "instance_type": "n2-standard-4",
            "image_id": "projects/debian-cloud/global/images/debian-11-bullseye-v20231010",
            "private_ip": "10.128.1.10",
            "public_ip": "35.202.45.67",
            "zone": "us-central1-a",
            "network": "gcp-main-vpc",
            "subnet": "gcp-public-subnet"
        }),
        tags!("env" => "production", "team" => "platform")
    ));

    store.insert(res!(
        CloudProvider::Gcp, ResourceType::Instance, "gcp-api-1", "us-central1",
        ResourceStatus::Running,
        serde_json::json!({
            "instance_type": "n2-standard-8",
            "image_id": "projects/debian-cloud/global/images/debian-11-bullseye-v20231010",
            "private_ip": "10.128.1.20",
            "public_ip": "35.202.45.68",
            "zone": "us-central1-a",
            "network": "gcp-main-vpc",
            "subnet": "gcp-public-subnet"
        }),
        tags!("env" => "production", "team" => "backend")
    ));

    store.insert(res!(
        CloudProvider::Gcp, ResourceType::Instance, "gcp-ml-worker", "us-central1",
        ResourceStatus::Stopped,
        serde_json::json!({
            "instance_type": "a2-highgpu-1g",
            "image_id": "projects/ml-images/global/images/ml-gpu-v20231010",
            "private_ip": "10.128.10.30",
            "zone": "us-central1-a",
            "network": "gcp-main-vpc",
            "subnet": "gcp-private-subnet",
            "accelerators": [{"type": "nvidia-tesla-a100", "count": 1}]
        }),
        tags!("env" => "production", "team" => "ml")
    ));

    // GCS Buckets
    store.insert(res!(
        CloudProvider::Gcp, ResourceType::Bucket, "gcp-app-static", "us-central1",
        ResourceStatus::Available,
        serde_json::json!({
            "versioning": false,
            "encryption": "Google-managed",
            "public_access": true,
            "storage_class": "STANDARD",
            "object_count": 8432,
            "total_size_bytes": 2147483648_u64
        }),
        tags!("env" => "production", "team" => "frontend")
    ));

    store.insert(res!(
        CloudProvider::Gcp, ResourceType::Bucket, "gcp-data-warehouse", "us-central1",
        ResourceStatus::Available,
        serde_json::json!({
            "versioning": true,
            "encryption": "Customer-managed",
            "public_access": false,
            "storage_class": "NEARLINE",
            "object_count": 234567,
            "total_size_bytes": 53687091200_u64
        }),
        tags!("env" => "production", "team" => "data")
    ));

    // GCP VPC
    let gcp_vpc_id = Uuid::new_v4();
    store.insert(CloudResource {
        id: gcp_vpc_id,
        cloud_id: None,
        provider: CloudProvider::Gcp,
        resource_type: ResourceType::Vpc,
        name: "gcp-main-vpc".to_string(),
        region: "us-central1".to_string(),
        status: ResourceStatus::Available,
        metadata: serde_json::json!({
            "cidr_block": "10.128.0.0/16",
            "enable_dns": true,
            "auto_create_subnetworks": false,
            "routing_mode": "REGIONAL"
        }),
        tags: tags!("env" => "production", "Name" => "gcp-main-vpc"),
        created_at: now,
        updated_at: now,
    });

    // GCP Subnets
    store.insert(res!(
        CloudProvider::Gcp, ResourceType::Subnet, "gcp-public-subnet", "us-central1",
        ResourceStatus::Available,
        serde_json::json!({
            "cidr_block": "10.128.1.0/24",
            "vpc_id": gcp_vpc_id.to_string(),
            "availability_zone": "us-central1-a",
            "is_public": true,
            "private_google_access": true
        }),
        tags!("env" => "production", "Name" => "gcp-public-subnet")
    ));

    store.insert(res!(
        CloudProvider::Gcp, ResourceType::Subnet, "gcp-private-subnet", "us-central1",
        ResourceStatus::Available,
        serde_json::json!({
            "cidr_block": "10.128.10.0/24",
            "vpc_id": gcp_vpc_id.to_string(),
            "availability_zone": "us-central1-b",
            "is_public": false,
            "private_google_access": true
        }),
        tags!("env" => "production", "Name" => "gcp-private-subnet")
    ));

    // GCP Cloud SQL
    store.insert(res!(
        CloudProvider::Gcp, ResourceType::Database, "gcp-prod-postgres", "us-central1",
        ResourceStatus::Running,
        serde_json::json!({
            "engine": "postgresql",
            "engine_version": "15",
            "instance_class": "db-custom-4-16384",
            "storage_gb": 250,
            "multi_az": true,
            "endpoint": "gcp-prod-postgres:us-central1:gcp-prod-postgres",
            "port": 5432,
            "backup_enabled": true
        }),
        tags!("env" => "production", "team" => "backend")
    ));

    store.insert(res!(
        CloudProvider::Gcp, ResourceType::Database, "gcp-analytics-mysql", "us-central1",
        ResourceStatus::Running,
        serde_json::json!({
            "engine": "mysql",
            "engine_version": "8.0",
            "instance_class": "db-custom-2-8192",
            "storage_gb": 100,
            "multi_az": false,
            "endpoint": "gcp-analytics-mysql:us-central1:gcp-analytics-mysql",
            "port": 3306,
            "backup_enabled": true
        }),
        tags!("env" => "production", "team" => "data")
    ));

    // GCP Load Balancer
    store.insert(res!(
        CloudProvider::Gcp, ResourceType::LoadBalancer, "gcp-http-lb", "us-central1",
        ResourceStatus::Available,
        serde_json::json!({
            "type": "HTTP(S)",
            "scheme": "external",
            "ip_address": "34.120.56.78",
            "network": gcp_vpc_id.to_string(),
            "backend_services": ["gcp-web-1", "gcp-api-1"],
            "ssl_certificates": ["gcp-ssl-cert-prod"],
            "ports": [80, 443]
        }),
        tags!("env" => "production", "Name" => "gcp-http-lb")
    ));

    // GCP Firewall Rules (as SecurityGroups)
    store.insert(res!(
        CloudProvider::Gcp, ResourceType::SecurityGroup, "gcp-allow-http", "us-central1",
        ResourceStatus::Available,
        serde_json::json!({
            "vpc_id": gcp_vpc_id.to_string(),
            "description": "Allow HTTP and HTTPS traffic",
            "direction": "INGRESS",
            "priority": 1000,
            "inbound_rules": [
                {"protocol": "tcp", "port": 80, "source": "0.0.0.0/0"},
                {"protocol": "tcp", "port": 443, "source": "0.0.0.0/0"}
            ]
        }),
        tags!("env" => "production", "Name" => "gcp-allow-http")
    ));

    store.insert(res!(
        CloudProvider::Gcp, ResourceType::SecurityGroup, "gcp-allow-internal", "us-central1",
        ResourceStatus::Available,
        serde_json::json!({
            "vpc_id": gcp_vpc_id.to_string(),
            "description": "Allow all internal traffic",
            "direction": "INGRESS",
            "priority": 1000,
            "inbound_rules": [
                {"protocol": "all", "port": 0, "source": "10.128.0.0/16"}
            ]
        }),
        tags!("env" => "production", "Name" => "gcp-allow-internal")
    ));

    // ============================================================
    // Azure Resources (eastus)
    // ============================================================

    // Azure VMs
    store.insert(res!(
        CloudProvider::Azure, ResourceType::Instance, "azure-web-1", "eastus",
        ResourceStatus::Running,
        serde_json::json!({
            "instance_type": "Standard_D4s_v3",
            "image_id": "Canonical:UbuntuServer:22.04-LTS:latest",
            "private_ip": "10.1.1.10",
            "public_ip": "52.168.34.56",
            "vnet": "azure-prod-vnet",
            "subnet": "azure-public-subnet",
            "resource_group": "prod-rg",
            "availability_zone": "1"
        }),
        tags!("env" => "production", "team" => "platform")
    ));

    store.insert(res!(
        CloudProvider::Azure, ResourceType::Instance, "azure-api-1", "eastus",
        ResourceStatus::Running,
        serde_json::json!({
            "instance_type": "Standard_D8s_v3",
            "image_id": "Canonical:UbuntuServer:22.04-LTS:latest",
            "private_ip": "10.1.1.20",
            "public_ip": "52.168.34.57",
            "vnet": "azure-prod-vnet",
            "subnet": "azure-public-subnet",
            "resource_group": "prod-rg",
            "availability_zone": "2"
        }),
        tags!("env" => "production", "team" => "backend")
    ));

    store.insert(res!(
        CloudProvider::Azure, ResourceType::Instance, "azure-dev-1", "eastus",
        ResourceStatus::Stopped,
        serde_json::json!({
            "instance_type": "Standard_B2ms",
            "image_id": "Canonical:UbuntuServer:22.04-LTS:latest",
            "private_ip": "10.1.1.30",
            "vnet": "azure-prod-vnet",
            "subnet": "azure-private-subnet",
            "resource_group": "dev-rg",
            "availability_zone": "1"
        }),
        tags!("env" => "development", "team" => "engineering")
    ));

    // Azure Storage Accounts (as Buckets)
    store.insert(res!(
        CloudProvider::Azure, ResourceType::Bucket, "azureprodblob", "eastus",
        ResourceStatus::Available,
        serde_json::json!({
            "versioning": false,
            "encryption": "Microsoft.Storage",
            "public_access": false,
            "account_kind": "StorageV2",
            "replication": "LRS",
            "access_tier": "Hot",
            "object_count": 45123,
            "total_size_bytes": 10737418240_u64
        }),
        tags!("env" => "production", "team" => "platform")
    ));

    store.insert(res!(
        CloudProvider::Azure, ResourceType::Bucket, "azurebackupvault", "eastus",
        ResourceStatus::Available,
        serde_json::json!({
            "versioning": true,
            "encryption": "Microsoft.Storage",
            "public_access": false,
            "account_kind": "BlobStorage",
            "replication": "GRS",
            "access_tier": "Cool",
            "object_count": 2345,
            "total_size_bytes": 32212254720_u64
        }),
        tags!("env" => "production", "team" => "ops")
    ));

    // Azure VNet
    let azure_vnet_id = Uuid::new_v4();
    store.insert(CloudResource {
        id: azure_vnet_id,
        cloud_id: None,
        provider: CloudProvider::Azure,
        resource_type: ResourceType::Vpc,
        name: "azure-prod-vnet".to_string(),
        region: "eastus".to_string(),
        status: ResourceStatus::Available,
        metadata: serde_json::json!({
            "cidr_block": "10.1.0.0/16",
            "enable_dns": true,
            "resource_group": "prod-rg",
            "address_space": ["10.1.0.0/16"]
        }),
        tags: tags!("env" => "production", "Name" => "azure-prod-vnet"),
        created_at: now,
        updated_at: now,
    });

    // Azure Subnets
    store.insert(res!(
        CloudProvider::Azure, ResourceType::Subnet, "azure-public-subnet", "eastus",
        ResourceStatus::Available,
        serde_json::json!({
            "cidr_block": "10.1.1.0/24",
            "vpc_id": azure_vnet_id.to_string(),
            "availability_zone": "eastus-1",
            "is_public": true,
            "nsg": "azure-web-nsg"
        }),
        tags!("env" => "production", "Name" => "azure-public-subnet")
    ));

    store.insert(res!(
        CloudProvider::Azure, ResourceType::Subnet, "azure-private-subnet", "eastus",
        ResourceStatus::Available,
        serde_json::json!({
            "cidr_block": "10.1.10.0/24",
            "vpc_id": azure_vnet_id.to_string(),
            "availability_zone": "eastus-2",
            "is_public": false,
            "nsg": "azure-db-nsg"
        }),
        tags!("env" => "production", "Name" => "azure-private-subnet")
    ));

    // Azure SQL
    store.insert(res!(
        CloudProvider::Azure, ResourceType::Database, "azure-prod-sql", "eastus",
        ResourceStatus::Running,
        serde_json::json!({
            "engine": "sqlserver",
            "engine_version": "12.0",
            "instance_class": "GP_Gen5_4",
            "storage_gb": 256,
            "multi_az": true,
            "endpoint": "azure-prod-sql.database.windows.net",
            "port": 1433,
            "resource_group": "prod-rg"
        }),
        tags!("env" => "production", "team" => "backend")
    ));

    store.insert(res!(
        CloudProvider::Azure, ResourceType::Database, "azure-cosmos-db", "eastus",
        ResourceStatus::Running,
        serde_json::json!({
            "engine": "cosmosdb",
            "engine_version": "4.0",
            "instance_class": "Standard",
            "storage_gb": 100,
            "multi_az": true,
            "endpoint": "azure-cosmos-db.documents.azure.com",
            "port": 443,
            "consistency_level": "Session",
            "resource_group": "prod-rg"
        }),
        tags!("env" => "production", "team" => "backend")
    ));

    // Azure Load Balancer
    store.insert(res!(
        CloudProvider::Azure, ResourceType::LoadBalancer, "azure-pub-lb", "eastus",
        ResourceStatus::Available,
        serde_json::json!({
            "type": "Public",
            "sku": "Standard",
            "frontend_ip": "52.168.100.10",
            "vnet_id": azure_vnet_id.to_string(),
            "resource_group": "prod-rg",
            "backend_pools": ["azure-web-1", "azure-api-1"],
            "health_probes": [{"port": 80, "protocol": "HTTP", "path": "/health"}],
            "rules": [{"frontend_port": 80, "backend_port": 80, "protocol": "TCP"}]
        }),
        tags!("env" => "production", "Name" => "azure-pub-lb")
    ));

    // Azure NSGs (as SecurityGroups)
    store.insert(res!(
        CloudProvider::Azure, ResourceType::SecurityGroup, "azure-web-nsg", "eastus",
        ResourceStatus::Available,
        serde_json::json!({
            "vpc_id": azure_vnet_id.to_string(),
            "description": "NSG for web tier",
            "resource_group": "prod-rg",
            "inbound_rules": [
                {"priority": 100, "protocol": "tcp", "port": 80, "source": "*", "action": "Allow"},
                {"priority": 110, "protocol": "tcp", "port": 443, "source": "*", "action": "Allow"}
            ],
            "outbound_rules": [
                {"priority": 100, "protocol": "*", "port": 0, "destination": "*", "action": "Allow"}
            ]
        }),
        tags!("env" => "production", "Name" => "azure-web-nsg")
    ));

    store.insert(res!(
        CloudProvider::Azure, ResourceType::SecurityGroup, "azure-db-nsg", "eastus",
        ResourceStatus::Available,
        serde_json::json!({
            "vpc_id": azure_vnet_id.to_string(),
            "description": "NSG for database tier",
            "resource_group": "prod-rg",
            "inbound_rules": [
                {"priority": 100, "protocol": "tcp", "port": 1433, "source": "10.1.0.0/16", "action": "Allow"},
                {"priority": 110, "protocol": "tcp", "port": 443, "source": "10.1.0.0/16", "action": "Allow"}
            ],
            "outbound_rules": [
                {"priority": 100, "protocol": "*", "port": 0, "destination": "*", "action": "Allow"}
            ]
        }),
        tags!("env" => "production", "Name" => "azure-db-nsg")
    ));

    store
}

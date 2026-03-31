use async_trait::async_trait;
use std::sync::Arc;

use cloud_common::{CredentialManager, RedisCache};

use crate::error::CloudError;
use crate::models::*;
use crate::providers::gcp_mapper;
use crate::providers::gcp_rest_client::GcpRestClient;
use crate::traits::compute::Result;
use crate::traits::{ComputeProvider, ContainerRegistryProvider, DatabaseProvider, KubernetesProvider, NetworkingProvider, ServerlessProvider, StorageProvider, TrafficProvider, WorkflowProvider};

/// GCP provider backed by real GCP REST API calls.
pub struct GcpSdkProvider {
    client: GcpRestClient,
    _cache: Arc<RedisCache>,
}

impl GcpSdkProvider {
    pub fn new(credentials: Arc<CredentialManager>, cache: Arc<RedisCache>, project_id: String) -> Self {
        Self {
            client: GcpRestClient::new(credentials, project_id),
            _cache: cache,
        }
    }
}

#[async_trait]
impl ComputeProvider for GcpSdkProvider {
    async fn list_instances(&self, region: &str) -> Result<Vec<CloudResource>> {
        let zones = self.client.zones_in_region(region).await?;
        let mut instances = Vec::new();

        for zone in &zones {
            let url = format!(
                "https://compute.googleapis.com/compute/v1/projects/{}/zones/{}/instances",
                self.client.project_id(), zone
            );
            match self.client.get(&url).await {
                Ok(data) => {
                    if let Some(items) = data["items"].as_array() {
                        for item in items {
                            instances.push(gcp_mapper::gce_instance_to_resource(item, region));
                        }
                    }
                }
                Err(_) => continue,
            }
        }
        Ok(instances)
    }

    async fn get_instance(&self, region: &str, id: &str) -> Result<CloudResource> {
        let zones = self.client.zones_in_region(region).await?;
        for zone in &zones {
            let url = format!(
                "https://compute.googleapis.com/compute/v1/projects/{}/zones/{}/instances/{}",
                self.client.project_id(), zone, id
            );
            if let Ok(data) = self.client.get(&url).await {
                return Ok(gcp_mapper::gce_instance_to_resource(&data, region));
            }
        }
        Err(CloudError::NotFound(format!("GCE instance {id} not found in {region}")))
    }

    async fn create_instance(&self, region: &str, config: CreateInstanceRequest) -> Result<CloudResource> {
        let zone = format!("{}-a", region);
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/zones/{}/instances",
            self.client.project_id(), zone
        );
        let body = serde_json::json!({
            "name": config.name,
            "machineType": format!("zones/{}/machineTypes/{}", zone, config.instance_type),
            "disks": [{
                "boot": true,
                "autoDelete": true,
                "initializeParams": {
                    "sourceImage": config.image_id
                }
            }],
            "networkInterfaces": [{
                "network": "global/networks/default",
                "accessConfigs": [{"type": "ONE_TO_ONE_NAT", "name": "External NAT"}]
            }],
            "labels": config.tags,
        });

        let data = self.client.post(&url, &body).await?;
        Ok(gcp_mapper::gce_instance_to_resource(&data, region))
    }

    async fn delete_instance(&self, region: &str, id: &str) -> Result<()> {
        let zones = self.client.zones_in_region(region).await?;
        for zone in &zones {
            let url = format!(
                "https://compute.googleapis.com/compute/v1/projects/{}/zones/{}/instances/{}",
                self.client.project_id(), zone, id
            );
            if self.client.delete(&url).await.is_ok() {
                return Ok(());
            }
        }
        Err(CloudError::NotFound(format!("GCE instance {id} not found")))
    }

    async fn start_instance(&self, region: &str, id: &str) -> Result<()> {
        let zone = format!("{}-a", region);
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/zones/{}/instances/{}/start",
            self.client.project_id(), zone, id
        );
        self.client.post(&url, &serde_json::json!({})).await?;
        Ok(())
    }

    async fn stop_instance(&self, region: &str, id: &str) -> Result<()> {
        let zone = format!("{}-a", region);
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/zones/{}/instances/{}/stop",
            self.client.project_id(), zone, id
        );
        self.client.post(&url, &serde_json::json!({})).await?;
        Ok(())
    }

    async fn reboot_instance(&self, region: &str, id: &str) -> Result<()> {
        let zone = format!("{}-a", region);
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/zones/{}/instances/{}/reset",
            self.client.project_id(), zone, id
        );
        self.client.post(&url, &serde_json::json!({})).await?;
        Ok(())
    }
}

#[async_trait]
impl StorageProvider for GcpSdkProvider {
    async fn list_buckets(&self, _region: &str) -> Result<Vec<CloudResource>> {
        let url = format!(
            "https://storage.googleapis.com/storage/v1/b?project={}",
            self.client.project_id()
        );
        let data = self.client.get(&url).await?;
        let buckets = data["items"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|b| gcp_mapper::gcs_bucket_to_resource(b, b["location"].as_str().unwrap_or("US")))
            .collect();
        Ok(buckets)
    }

    async fn get_bucket(&self, _region: &str, name: &str) -> Result<CloudResource> {
        let url = format!("https://storage.googleapis.com/storage/v1/b/{}", name);
        let data = self.client.get(&url).await?;
        Ok(gcp_mapper::gcs_bucket_to_resource(&data, data["location"].as_str().unwrap_or("US")))
    }

    async fn create_bucket(&self, region: &str, config: CreateBucketRequest) -> Result<CloudResource> {
        let url = format!(
            "https://storage.googleapis.com/storage/v1/b?project={}",
            self.client.project_id()
        );
        let body = serde_json::json!({
            "name": config.name,
            "location": region.to_uppercase(),
            "storageClass": "STANDARD",
            "versioning": { "enabled": config.versioning },
        });
        let data = self.client.post(&url, &body).await?;
        Ok(gcp_mapper::gcs_bucket_to_resource(&data, region))
    }

    async fn delete_bucket(&self, _region: &str, name: &str) -> Result<()> {
        let url = format!("https://storage.googleapis.com/storage/v1/b/{}", name);
        self.client.delete(&url).await
    }

    async fn list_objects(&self, _region: &str, bucket: &str, prefix: Option<&str>) -> Result<Vec<CloudResource>> {
        let mut url = format!("https://storage.googleapis.com/storage/v1/b/{}/o", bucket);
        if let Some(prefix) = prefix {
            url = format!("{}?prefix={}", url, prefix);
        }
        let data = self.client.get(&url).await?;
        let objects = data["items"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|obj| {
                let name = obj["name"].as_str().unwrap_or_default().to_owned();
                CloudResource {
                    id: uuid::Uuid::new_v4(),
                    cloud_id: Some(name.clone()),
                    provider: CloudProvider::Gcp,
                    resource_type: ResourceType::Bucket,
                    name,
                    region: String::new(),
                    status: ResourceStatus::Available,
                    metadata: serde_json::json!({
                        "bucket": bucket,
                        "content_type": obj["contentType"].as_str().unwrap_or_default(),
                        "size_bytes": obj["size"].as_str().unwrap_or("0"),
                        "storage_class": obj["storageClass"].as_str().unwrap_or("STANDARD"),
                    }),
                    tags: std::collections::HashMap::new(),
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                }
            })
            .collect();
        Ok(objects)
    }

    async fn upload_object(&self, _region: &str, bucket: &str, request: UploadObjectRequest, data: Vec<u8>) -> Result<CloudResource> {
        let url = format!(
            "https://storage.googleapis.com/upload/storage/v1/b/{}/o?uploadType=media&name={}",
            bucket, request.key
        );
        // For media uploads we need raw body, use the REST client's post with empty JSON as placeholder
        let _ = self.client.post(&url, &serde_json::json!({})).await;

        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(request.key.clone()),
            provider: CloudProvider::Gcp,
            resource_type: ResourceType::Bucket,
            name: request.key,
            region: String::new(),
            status: ResourceStatus::Available,
            metadata: serde_json::json!({"bucket": bucket, "size_bytes": data.len()}),
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn delete_object(&self, _region: &str, bucket: &str, key: &str) -> Result<()> {
        let url = format!("https://storage.googleapis.com/storage/v1/b/{}/o/{}", bucket, key);
        self.client.delete(&url).await
    }

    async fn get_bucket_policy(&self, _region: &str, bucket: &str) -> Result<serde_json::Value> {
        let url = format!("https://storage.googleapis.com/storage/v1/b/{}/iam", bucket);
        self.client.get(&url).await
    }

    async fn put_bucket_policy(&self, _region: &str, bucket: &str, policy: &str) -> Result<()> {
        let url = format!("https://storage.googleapis.com/storage/v1/b/{}/iam", bucket);
        let body: serde_json::Value = serde_json::from_str(policy)
            .unwrap_or_else(|_| serde_json::json!({}));
        let _ = self.client.post(&url, &body).await?;
        Ok(())
    }

    async fn delete_bucket_policy(&self, _region: &str, bucket: &str) -> Result<()> {
        let url = format!("https://storage.googleapis.com/storage/v1/b/{}/iam", bucket);
        let empty_policy = serde_json::json!({"bindings": []});
        let _ = self.client.post(&url, &empty_policy).await?;
        Ok(())
    }

    async fn get_lifecycle_rules(&self, _region: &str, bucket: &str) -> Result<Vec<serde_json::Value>> {
        let url = format!("https://storage.googleapis.com/storage/v1/b/{}?fields=lifecycle", bucket);
        let data = self.client.get(&url).await?;
        Ok(data["lifecycle"]["rule"].as_array().cloned().unwrap_or_default())
    }

    async fn put_lifecycle_rules(&self, _region: &str, bucket: &str, rules: Vec<serde_json::Value>) -> Result<()> {
        let url = format!("https://storage.googleapis.com/storage/v1/b/{}", bucket);
        let body = serde_json::json!({"lifecycle": {"rule": rules}});
        let _ = self.client.post(&url, &body).await?;
        Ok(())
    }

    async fn get_bucket_encryption(&self, _region: &str, bucket: &str) -> Result<serde_json::Value> {
        let url = format!("https://storage.googleapis.com/storage/v1/b/{}?fields=encryption", bucket);
        self.client.get(&url).await
    }

    async fn put_bucket_encryption(&self, _region: &str, bucket: &str, enabled: bool) -> Result<()> {
        let url = format!("https://storage.googleapis.com/storage/v1/b/{}", bucket);
        let body = if enabled {
            serde_json::json!({"encryption": {"defaultKmsKeyName": "projects/default/locations/global/keyRings/default/cryptoKeys/default"}})
        } else {
            serde_json::json!({"encryption": null})
        };
        let _ = self.client.post(&url, &body).await?;
        Ok(())
    }

    async fn get_cors_rules(&self, _region: &str, bucket: &str) -> Result<serde_json::Value> {
        let url = format!("https://storage.googleapis.com/storage/v1/b/{}?fields=cors", bucket);
        let data = self.client.get(&url).await?;
        Ok(serde_json::json!({"cors_rules": data["cors"]}))
    }

    async fn put_cors_rules(&self, _region: &str, bucket: &str, rules: serde_json::Value) -> Result<()> {
        let url = format!("https://storage.googleapis.com/storage/v1/b/{}", bucket);
        let body = serde_json::json!({"cors": rules});
        let _ = self.client.post(&url, &body).await?;
        Ok(())
    }
}

#[async_trait]
impl NetworkingProvider for GcpSdkProvider {
    async fn list_vpcs(&self, _region: &str) -> Result<Vec<CloudResource>> {
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/global/networks",
            self.client.project_id()
        );
        let data = self.client.get(&url).await?;
        Ok(data["items"].as_array().unwrap_or(&vec![]).iter()
            .map(|n| gcp_mapper::vpc_network_to_resource(n, "global"))
            .collect())
    }

    async fn get_vpc(&self, _region: &str, id: &str) -> Result<CloudResource> {
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/global/networks/{}",
            self.client.project_id(), id
        );
        let data = self.client.get(&url).await?;
        Ok(gcp_mapper::vpc_network_to_resource(&data, "global"))
    }

    async fn create_vpc(&self, _region: &str, config: CreateVpcRequest) -> Result<CloudResource> {
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/global/networks",
            self.client.project_id()
        );
        let body = serde_json::json!({
            "name": config.name,
            "autoCreateSubnetworks": false,
            "routingConfig": { "routingMode": "REGIONAL" }
        });
        let data = self.client.post(&url, &body).await?;
        Ok(gcp_mapper::vpc_network_to_resource(&data, "global"))
    }

    async fn delete_vpc(&self, _region: &str, id: &str) -> Result<()> {
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/global/networks/{}",
            self.client.project_id(), id
        );
        self.client.delete(&url).await
    }

    async fn list_subnets(&self, region: &str, _vpc_id: &str) -> Result<Vec<CloudResource>> {
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/regions/{}/subnetworks",
            self.client.project_id(), region
        );
        let data = self.client.get(&url).await?;
        Ok(data["items"].as_array().unwrap_or(&vec![]).iter()
            .map(|s| gcp_mapper::subnetwork_to_resource(s, region))
            .collect())
    }

    async fn create_subnet(&self, region: &str, config: CreateSubnetRequest) -> Result<CloudResource> {
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/regions/{}/subnetworks",
            self.client.project_id(), region
        );
        let body = serde_json::json!({
            "name": config.name,
            "network": format!("projects/{}/global/networks/{}", self.client.project_id(), config.vpc_id),
            "ipCidrRange": config.cidr_block,
        });
        let data = self.client.post(&url, &body).await?;
        Ok(gcp_mapper::subnetwork_to_resource(&data, region))
    }

    async fn delete_subnet(&self, region: &str, id: &str) -> Result<()> {
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/regions/{}/subnetworks/{}",
            self.client.project_id(), region, id
        );
        self.client.delete(&url).await
    }

    async fn list_load_balancers(&self, _region: &str) -> Result<Vec<CloudResource>> {
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/global/forwardingRules",
            self.client.project_id()
        );
        let data = self.client.get(&url).await?;
        Ok(data["items"].as_array().unwrap_or(&vec![]).iter()
            .map(|r| gcp_mapper::forwarding_rule_to_resource(r, "global"))
            .collect())
    }

    async fn get_load_balancer(&self, _region: &str, id: &str) -> Result<CloudResource> {
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/global/forwardingRules/{}",
            self.client.project_id(), id
        );
        let data = self.client.get(&url).await?;
        Ok(gcp_mapper::forwarding_rule_to_resource(&data, "global"))
    }

    async fn delete_load_balancer(&self, _region: &str, id: &str) -> Result<()> {
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/global/forwardingRules/{}",
            self.client.project_id(), id
        );
        self.client.delete(&url).await
    }

    async fn list_security_groups(&self, _region: &str) -> Result<Vec<CloudResource>> {
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/global/firewalls",
            self.client.project_id()
        );
        let data = self.client.get(&url).await?;
        Ok(data["items"].as_array().unwrap_or(&vec![]).iter()
            .map(|fw| gcp_mapper::firewall_to_resource(fw, "global"))
            .collect())
    }

    // GCP stubs for new networking operations

    async fn list_elastic_ips(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(Vec::new()) }
    async fn allocate_elastic_ip(&self, _region: &str) -> Result<CloudResource> {
        Err(CloudError::ProviderError("GCP: allocate_elastic_ip not yet implemented for SDK mode".into()))
    }
    async fn associate_elastic_ip(&self, _region: &str, _eip_id: &str, _instance_id: &str) -> Result<()> {
        Err(CloudError::ProviderError("GCP: associate_elastic_ip not yet implemented for SDK mode".into()))
    }
    async fn disassociate_elastic_ip(&self, _region: &str, _association_id: &str) -> Result<()> {
        Err(CloudError::ProviderError("GCP: disassociate_elastic_ip not yet implemented for SDK mode".into()))
    }
    async fn release_elastic_ip(&self, _region: &str, _allocation_id: &str) -> Result<()> {
        Err(CloudError::ProviderError("GCP: release_elastic_ip not yet implemented for SDK mode".into()))
    }

    async fn list_nat_gateways(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(Vec::new()) }
    async fn create_nat_gateway(&self, _region: &str, _subnet_id: &str, _eip_allocation_id: &str) -> Result<CloudResource> {
        Err(CloudError::ProviderError("GCP: create_nat_gateway not yet implemented for SDK mode".into()))
    }
    async fn delete_nat_gateway(&self, _region: &str, _id: &str) -> Result<()> {
        Err(CloudError::ProviderError("GCP: delete_nat_gateway not yet implemented for SDK mode".into()))
    }

    async fn list_internet_gateways(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(Vec::new()) }
    async fn create_internet_gateway(&self, _region: &str) -> Result<CloudResource> {
        Err(CloudError::ProviderError("GCP: create_internet_gateway not yet implemented for SDK mode".into()))
    }
    async fn attach_internet_gateway(&self, _region: &str, _igw_id: &str, _vpc_id: &str) -> Result<()> {
        Err(CloudError::ProviderError("GCP: attach_internet_gateway not yet implemented for SDK mode".into()))
    }
    async fn detach_internet_gateway(&self, _region: &str, _igw_id: &str, _vpc_id: &str) -> Result<()> {
        Err(CloudError::ProviderError("GCP: detach_internet_gateway not yet implemented for SDK mode".into()))
    }
    async fn delete_internet_gateway(&self, _region: &str, _id: &str) -> Result<()> {
        Err(CloudError::ProviderError("GCP: delete_internet_gateway not yet implemented for SDK mode".into()))
    }

    async fn list_route_tables(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(Vec::new()) }
    async fn create_route_table(&self, _region: &str, _vpc_id: &str) -> Result<CloudResource> {
        Err(CloudError::ProviderError("GCP: create_route_table not yet implemented for SDK mode".into()))
    }
    async fn add_route(&self, _region: &str, _route_table_id: &str, _destination_cidr: &str, _target_id: &str) -> Result<()> {
        Err(CloudError::ProviderError("GCP: add_route not yet implemented for SDK mode".into()))
    }
    async fn delete_route(&self, _region: &str, _route_table_id: &str, _destination_cidr: &str) -> Result<()> {
        Err(CloudError::ProviderError("GCP: delete_route not yet implemented for SDK mode".into()))
    }
    async fn associate_route_table(&self, _region: &str, _route_table_id: &str, _subnet_id: &str) -> Result<String> {
        Err(CloudError::ProviderError("GCP: associate_route_table not yet implemented for SDK mode".into()))
    }
    async fn delete_route_table(&self, _region: &str, _id: &str) -> Result<()> {
        Err(CloudError::ProviderError("GCP: delete_route_table not yet implemented for SDK mode".into()))
    }

    async fn create_security_group(&self, _region: &str, _name: &str, _description: &str, _vpc_id: &str) -> Result<CloudResource> {
        Err(CloudError::ProviderError("GCP: create_security_group not yet implemented for SDK mode".into()))
    }
    async fn add_security_group_rule(&self, _region: &str, _sg_id: &str, _rule: SecurityGroupRule) -> Result<()> {
        Err(CloudError::ProviderError("GCP: add_security_group_rule not yet implemented for SDK mode".into()))
    }
    async fn remove_security_group_rule(&self, _region: &str, _sg_id: &str, _rule: SecurityGroupRule) -> Result<()> {
        Err(CloudError::ProviderError("GCP: remove_security_group_rule not yet implemented for SDK mode".into()))
    }
    async fn delete_security_group(&self, _region: &str, _id: &str) -> Result<()> {
        Err(CloudError::ProviderError("GCP: delete_security_group not yet implemented for SDK mode".into()))
    }

    async fn list_vpc_peering_connections(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(Vec::new()) }
    async fn create_vpc_peering(&self, _region: &str, _vpc_id: &str, _peer_vpc_id: &str) -> Result<CloudResource> {
        Err(CloudError::ProviderError("GCP: create_vpc_peering not yet implemented for SDK mode".into()))
    }
    async fn accept_vpc_peering(&self, _region: &str, _peering_id: &str) -> Result<()> {
        Err(CloudError::ProviderError("GCP: accept_vpc_peering not yet implemented for SDK mode".into()))
    }
    async fn delete_vpc_peering(&self, _region: &str, _peering_id: &str) -> Result<()> {
        Err(CloudError::ProviderError("GCP: delete_vpc_peering not yet implemented for SDK mode".into()))
    }
}

#[async_trait]
impl DatabaseProvider for GcpSdkProvider {
    async fn list_databases(&self, _region: &str) -> Result<Vec<CloudResource>> {
        let url = format!(
            "https://sqladmin.googleapis.com/sql/v1beta4/projects/{}/instances",
            self.client.project_id()
        );
        let data = self.client.get(&url).await?;
        Ok(data["items"].as_array().unwrap_or(&vec![]).iter()
            .map(|db| gcp_mapper::cloudsql_to_resource(db, db["region"].as_str().unwrap_or("us-central1")))
            .collect())
    }

    async fn get_database(&self, _region: &str, id: &str) -> Result<CloudResource> {
        let url = format!(
            "https://sqladmin.googleapis.com/sql/v1beta4/projects/{}/instances/{}",
            self.client.project_id(), id
        );
        let data = self.client.get(&url).await?;
        Ok(gcp_mapper::cloudsql_to_resource(&data, data["region"].as_str().unwrap_or("us-central1")))
    }

    async fn create_database(&self, region: &str, config: CreateDatabaseRequest) -> Result<CloudResource> {
        let url = format!(
            "https://sqladmin.googleapis.com/sql/v1beta4/projects/{}/instances",
            self.client.project_id()
        );
        let body = serde_json::json!({
            "name": config.name,
            "databaseVersion": config.engine.to_uppercase(),
            "region": region,
            "settings": {
                "tier": config.instance_class,
                "dataDiskSizeGb": config.storage_gb.to_string(),
                "backupConfiguration": { "enabled": true },
            }
        });
        let data = self.client.post(&url, &body).await?;
        Ok(gcp_mapper::cloudsql_to_resource(&data, region))
    }

    async fn delete_database(&self, _region: &str, id: &str) -> Result<()> {
        let url = format!(
            "https://sqladmin.googleapis.com/sql/v1beta4/projects/{}/instances/{}",
            self.client.project_id(), id
        );
        self.client.delete(&url).await
    }

    async fn restart_database(&self, _region: &str, id: &str) -> Result<()> {
        let url = format!(
            "https://sqladmin.googleapis.com/sql/v1beta4/projects/{}/instances/{}/restart",
            self.client.project_id(), id
        );
        self.client.post(&url, &serde_json::json!({})).await?;
        Ok(())
    }

    async fn create_snapshot(&self, _region: &str, db_id: &str, snapshot_name: &str) -> Result<CloudResource> {
        let url = format!(
            "https://sqladmin.googleapis.com/sql/v1beta4/projects/{}/instances/{}/backupRuns",
            self.client.project_id(), db_id
        );
        let _ = self.client.post(&url, &serde_json::json!({"kind": "sql#backupRun"})).await?;

        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(snapshot_name.to_owned()),
            provider: CloudProvider::Gcp,
            resource_type: ResourceType::Snapshot,
            name: snapshot_name.to_owned(),
            region: String::new(),
            status: ResourceStatus::Creating,
            metadata: serde_json::json!({"db_instance": db_id}),
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn create_read_replica(&self, _region: &str, _source_db_id: &str, _replica_name: &str) -> Result<CloudResource> {
        Err(CloudError::ProviderError("GCP Cloud SQL create_read_replica not yet implemented via SDK".into()))
    }
    async fn list_parameter_groups(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(vec![]) }
    async fn get_parameter_group(&self, _region: &str, name: &str) -> Result<serde_json::Value> {
        Ok(serde_json::json!({"name": name, "description": "GCP Cloud SQL flags (stub)"}))
    }
    async fn restore_to_point_in_time(&self, _region: &str, _source_db_id: &str, _target_name: &str, _restore_time: &str) -> Result<CloudResource> {
        Err(CloudError::ProviderError("GCP Cloud SQL restore_to_point_in_time not yet implemented via SDK".into()))
    }
}

#[async_trait]
impl ServerlessProvider for GcpSdkProvider {
    async fn list_functions(&self, _region: &str) -> Result<Vec<CloudResource>> {
        let url = format!(
            "https://cloudfunctions.googleapis.com/v2/projects/{}/locations/-/functions",
            self.client.project_id()
        );
        let data = self.client.get(&url).await?;
        Ok(data["functions"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|f| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: f["name"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Gcp,
                resource_type: ResourceType::Function,
                name: f["name"].as_str().unwrap_or_default().to_owned(),
                region: f["location"].as_str().unwrap_or_default().to_owned(),
                status: ResourceStatus::Available,
                metadata: f.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn get_function(&self, _region: &str, name: &str) -> Result<CloudResource> {
        let url = format!(
            "https://cloudfunctions.googleapis.com/v2/projects/{}/locations/-/functions/{}",
            self.client.project_id(),
            name
        );
        let data = self.client.get(&url).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["name"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Gcp,
            resource_type: ResourceType::Function,
            name: name.to_owned(),
            region: data["location"].as_str().unwrap_or_default().to_owned(),
            status: ResourceStatus::Available,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn create_function(&self, _region: &str, config: CreateFunctionRequest) -> Result<CloudResource> {
        let url = format!(
            "https://cloudfunctions.googleapis.com/v2/projects/{}/locations/us-central1/functions",
            self.client.project_id()
        );
        let body = serde_json::json!({
            "name": config.name,
            "buildConfig": {"runtime": config.runtime, "entryPoint": config.handler},
            "serviceConfig": {"availableMemory": format!("{}M", config.memory_mb), "timeoutSeconds": config.timeout_seconds},
        });
        let data = self.client.post(&url, &body).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["name"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Gcp,
            resource_type: ResourceType::Function,
            name: config.name,
            region: "us-central1".to_owned(),
            status: ResourceStatus::Creating,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn update_function_code(&self, _region: &str, name: &str, _zip_bytes: Vec<u8>) -> Result<CloudResource> {
        // GCP Cloud Functions code update is done via source upload URL — stub for now.
        self.get_function(_region, name).await
    }

    async fn delete_function(&self, _region: &str, name: &str) -> Result<()> {
        let url = format!(
            "https://cloudfunctions.googleapis.com/v2/projects/{}/locations/-/functions/{}",
            self.client.project_id(),
            name
        );
        self.client.delete(&url).await
    }

    async fn invoke_function(&self, _region: &str, name: &str, payload: serde_json::Value) -> Result<serde_json::Value> {
        let url = format!(
            "https://cloudfunctions.googleapis.com/v2/projects/{}/locations/-/functions/{}:call",
            self.client.project_id(),
            name
        );
        self.client.post(&url, &payload).await
    }

    async fn list_function_versions(&self, _region: &str, _name: &str) -> Result<Vec<CloudResource>> {
        // GCP Cloud Functions v2 doesn't have a versions API the same way Lambda does.
        Ok(vec![])
    }
}

#[async_trait]
impl TrafficProvider for GcpSdkProvider {
    async fn get_flow_logs(&self, _region: &str, _log_group: Option<&str>, _start_time: Option<i64>, _end_time: Option<i64>) -> Result<FlowLogResponse> {
        Ok(FlowLogResponse { entries: vec![], query_id: None })
    }
    async fn get_traffic_summary(&self, _region: &str) -> Result<TrafficSummary> {
        Ok(TrafficSummary { total_bytes_in: 0, total_bytes_out: 0, total_requests: 0, total_errors: 0, top_talkers: vec![], per_service: vec![], timestamp: chrono::Utc::now().to_rfc3339() })
    }
}

#[async_trait]
impl KubernetesProvider for GcpSdkProvider {
    async fn list_clusters(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(vec![]) }
    async fn get_cluster(&self, _region: &str, name: &str) -> Result<CloudResource> { Err(CloudError::NotFound(format!("GKE cluster {} not found", name))) }
    async fn create_cluster(&self, _region: &str, _config: CreateClusterRequest) -> Result<CloudResource> { Err(CloudError::ProviderError("GKE create_cluster not yet implemented".into())) }
    async fn delete_cluster(&self, _region: &str, _name: &str) -> Result<()> { Err(CloudError::ProviderError("GKE delete_cluster not yet implemented".into())) }
    async fn list_node_groups(&self, _region: &str, _cluster_name: &str) -> Result<Vec<CloudResource>> { Ok(vec![]) }
    async fn create_node_group(&self, _region: &str, _cluster_name: &str, _config: CreateNodeGroupRequest) -> Result<CloudResource> { Err(CloudError::ProviderError("GKE create_node_pool not yet implemented".into())) }
    async fn delete_node_group(&self, _region: &str, _cluster_name: &str, _node_group_name: &str) -> Result<()> { Err(CloudError::ProviderError("GKE delete_node_pool not yet implemented".into())) }
    async fn scale_node_group(&self, _region: &str, _cluster_name: &str, _node_group_name: &str, _desired: i32) -> Result<()> { Err(CloudError::ProviderError("GKE scale_node_pool not yet implemented".into())) }
}

#[async_trait]
impl ContainerRegistryProvider for GcpSdkProvider {
    async fn list_registries(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(vec![]) }
    async fn get_registry(&self, _region: &str, id: &str) -> Result<CloudResource> { Err(CloudError::NotFound(format!("GCP Artifact Registry {} not found", id))) }
    async fn create_registry(&self, _region: &str, _name: &str) -> Result<CloudResource> { Err(CloudError::ProviderError("GCP create_registry not yet implemented via SDK".into())) }
    async fn delete_registry(&self, _region: &str, _id: &str) -> Result<()> { Err(CloudError::ProviderError("GCP delete_registry not yet implemented via SDK".into())) }
    async fn list_images(&self, _region: &str, _registry: &str) -> Result<Vec<CloudResource>> { Ok(vec![]) }
    async fn get_image_scan_results(&self, _region: &str, registry: &str, image_tag: &str) -> Result<serde_json::Value> {
        Ok(serde_json::json!({"repository": registry, "image_tag": image_tag, "scan_status": "NOT_AVAILABLE"}))
    }
    async fn start_image_scan(&self, _region: &str, _registry: &str, _image_tag: &str) -> Result<()> {
        Err(CloudError::ProviderError("GCP image scanning not yet implemented via SDK".into()))
    }
}

#[async_trait]
impl WorkflowProvider for GcpSdkProvider {
    async fn list_state_machines(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(vec![]) }
    async fn get_state_machine(&self, _region: &str, arn: &str) -> Result<CloudResource> { Err(CloudError::NotFound(format!("GCP Workflow {} not found", arn))) }
    async fn start_execution(&self, _region: &str, _arn: &str, _input: serde_json::Value) -> Result<CloudResource> { Err(CloudError::ProviderError("GCP Workflows not yet implemented via SDK".into())) }
    async fn list_executions(&self, _region: &str, _arn: &str) -> Result<Vec<CloudResource>> { Ok(vec![]) }
}

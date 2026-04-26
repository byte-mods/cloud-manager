use async_trait::async_trait;
use std::sync::Arc;

use cloud_common::{CredentialManager, RedisCache};

use crate::error::CloudError;
use crate::models::*;
use crate::providers::azure_mapper;
use crate::providers::azure_rest_client::AzureRestClient;
use crate::traits::compute::Result;
use crate::traits::{
    ApiGatewayProvider, AutoScalingProvider, CacheDbProvider, CdnProvider, ComputeProvider,
    ContainerRegistryProvider, DatabaseProvider, DnsProvider, IamProvider, IoTProvider,
    KmsProvider, KubernetesProvider, MessagingProvider, MlProvider, NetworkingProvider,
    NoSqlProvider, ServerlessProvider, StorageProvider, TrafficProvider, VolumeProvider,
    WafProvider, WorkflowProvider,
};

// Azure API versions
const VM_API_VERSION: &str = "2024-07-01";
const STORAGE_API_VERSION: &str = "2023-05-01";
const NETWORK_API_VERSION: &str = "2024-01-01";
const SQL_API_VERSION: &str = "2023-08-01-preview";
const MISC_API_VERSION: &str = "2023-11-01";

/// Default resource group when none can be inferred.
const DEFAULT_RESOURCE_GROUP: &str = "default-rg";

/// Azure provider backed by real Azure REST API calls.
pub struct AzureSdkProvider {
    client: AzureRestClient,
    _cache: Arc<RedisCache>,
}

impl AzureSdkProvider {
    pub fn new(
        credentials: Arc<CredentialManager>,
        cache: Arc<RedisCache>,
        subscription_id: String,
    ) -> Self {
        Self {
            client: AzureRestClient::new(credentials, subscription_id),
            _cache: cache,
        }
    }
}

#[async_trait]
impl ComputeProvider for AzureSdkProvider {
    async fn list_instances(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.Compute/virtualMachines";
        let data = self.client.get(path, VM_API_VERSION).await?;
        let instances = data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter(|vm| {
                vm["location"]
                    .as_str()
                    .map(|loc| loc.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|vm| azure_mapper::vm_to_resource(vm, region))
            .collect();
        Ok(instances)
    }

    async fn get_instance(&self, region: &str, id: &str) -> Result<CloudResource> {
        // Try to fetch by resource group + name. If id looks like a full resource path, use it.
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Compute/virtualMachines/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        let data = self.client.get(&path, VM_API_VERSION).await?;
        Ok(azure_mapper::vm_to_resource(&data, region))
    }

    async fn create_instance(
        &self,
        region: &str,
        config: CreateInstanceRequest,
    ) -> Result<CloudResource> {
        let rg = DEFAULT_RESOURCE_GROUP;
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.Compute/virtualMachines/{}",
            rg, config.name
        );
        let body = serde_json::json!({
            "location": region,
            "properties": {
                "hardwareProfile": { "vmSize": config.instance_type },
                "storageProfile": {
                    "imageReference": {
                        "id": config.image_id
                    },
                    "osDisk": {
                        "createOption": "FromImage",
                        "managedDisk": { "storageAccountType": "Standard_LRS" }
                    }
                },
                "osProfile": {
                    "computerName": config.name,
                    "adminUsername": "azureuser"
                },
                "networkProfile": {
                    "networkInterfaces": config.subnet_id.as_ref().map(|nic_id| {
                        vec![serde_json::json!({
                            "id": nic_id,
                            "properties": { "primary": true }
                        })]
                    }).unwrap_or_default()
                }
            },
            "tags": config.tags,
        });

        let data = self.client.put(&path, VM_API_VERSION, &body).await?;
        Ok(azure_mapper::vm_to_resource(&data, region))
    }

    async fn delete_instance(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Compute/virtualMachines/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        self.client.delete(&path, VM_API_VERSION).await
    }

    async fn start_instance(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            format!("{}/start", id)
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Compute/virtualMachines/{}/start",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        self.client
            .post(&path, VM_API_VERSION, &serde_json::json!({}))
            .await?;
        Ok(())
    }

    async fn stop_instance(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            format!("{}/deallocate", id)
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Compute/virtualMachines/{}/deallocate",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        self.client
            .post(&path, VM_API_VERSION, &serde_json::json!({}))
            .await?;
        Ok(())
    }

    async fn reboot_instance(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            format!("{}/restart", id)
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Compute/virtualMachines/{}/restart",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        self.client
            .post(&path, VM_API_VERSION, &serde_json::json!({}))
            .await?;
        Ok(())
    }
}

#[async_trait]
impl StorageProvider for AzureSdkProvider {
    async fn list_buckets(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.Storage/storageAccounts";
        let data = self.client.get(path, STORAGE_API_VERSION).await?;
        let accounts = data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter(|sa| {
                sa["location"]
                    .as_str()
                    .map(|loc| loc.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|sa| azure_mapper::storage_account_to_resource(sa, region))
            .collect();
        Ok(accounts)
    }

    async fn get_bucket(&self, region: &str, name: &str) -> Result<CloudResource> {
        let path = if name.starts_with('/') {
            name.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Storage/storageAccounts/{}",
                DEFAULT_RESOURCE_GROUP, name
            )
        };
        let data = self.client.get(&path, STORAGE_API_VERSION).await?;
        Ok(azure_mapper::storage_account_to_resource(&data, region))
    }

    async fn create_bucket(
        &self,
        region: &str,
        config: CreateBucketRequest,
    ) -> Result<CloudResource> {
        let rg = DEFAULT_RESOURCE_GROUP;
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.Storage/storageAccounts/{}",
            rg, config.name
        );
        let body = serde_json::json!({
            "location": region,
            "kind": "StorageV2",
            "sku": { "name": "Standard_LRS" },
            "properties": {
                "supportsHttpsTrafficOnly": true,
                "accessTier": "Hot",
                "allowBlobPublicAccess": config.public_access,
                "encryption": {
                    "services": {
                        "blob": { "enabled": config.encryption },
                        "file": { "enabled": config.encryption }
                    },
                    "keySource": "Microsoft.Storage"
                }
            },
            "tags": config.tags,
        });

        let data = self.client.put(&path, STORAGE_API_VERSION, &body).await?;
        Ok(azure_mapper::storage_account_to_resource(&data, region))
    }

    async fn delete_bucket(&self, _region: &str, name: &str) -> Result<()> {
        let path = if name.starts_with('/') {
            name.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Storage/storageAccounts/{}",
                DEFAULT_RESOURCE_GROUP, name
            )
        };
        self.client.delete(&path, STORAGE_API_VERSION).await
    }

    async fn list_objects(
        &self,
        _region: &str,
        bucket: &str,
        prefix: Option<&str>,
    ) -> Result<Vec<CloudResource>> {
        // Azure Blob Storage objects are not managed through ARM REST API.
        // This would require the Azure Blob Storage data-plane API.
        // Return empty for now; a full implementation would use the blob endpoint.
        let _ = (bucket, prefix);
        Ok(Vec::new())
    }

    async fn upload_object(
        &self,
        _region: &str,
        bucket: &str,
        request: UploadObjectRequest,
        data: Vec<u8>,
    ) -> Result<CloudResource> {
        // Azure Blob uploads go through the data-plane, not ARM.
        // Return a placeholder resource representing the uploaded blob.
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(request.key.clone()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::Bucket,
            name: request.key,
            region: String::new(),
            status: ResourceStatus::Available,
            metadata: serde_json::json!({"storage_account": bucket, "size_bytes": data.len()}),
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn delete_object(&self, _region: &str, bucket: &str, key: &str) -> Result<()> {
        // Azure Blob deletes go through the data-plane, not ARM.
        let _ = (bucket, key);
        Ok(())
    }

    async fn get_bucket_policy(&self, _region: &str, _bucket: &str) -> Result<serde_json::Value> {
        // Azure uses RBAC, not bucket policies — return empty placeholder.
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
impl NetworkingProvider for AzureSdkProvider {
    async fn list_vpcs(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.Network/virtualNetworks";
        let data = self.client.get(path, NETWORK_API_VERSION).await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter(|vnet| {
                vnet["location"]
                    .as_str()
                    .map(|loc| loc.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|vnet| azure_mapper::vnet_to_resource(vnet, region))
            .collect())
    }

    async fn get_vpc(&self, region: &str, id: &str) -> Result<CloudResource> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/virtualNetworks/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        let data = self.client.get(&path, NETWORK_API_VERSION).await?;
        Ok(azure_mapper::vnet_to_resource(&data, region))
    }

    async fn create_vpc(
        &self,
        region: &str,
        config: CreateVpcRequest,
    ) -> Result<CloudResource> {
        let rg = DEFAULT_RESOURCE_GROUP;
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.Network/virtualNetworks/{}",
            rg, config.name
        );
        let body = serde_json::json!({
            "location": region,
            "properties": {
                "addressSpace": {
                    "addressPrefixes": [config.cidr_block]
                },
                "enableDdosProtection": false
            },
            "tags": config.tags,
        });

        let data = self.client.put(&path, NETWORK_API_VERSION, &body).await?;
        Ok(azure_mapper::vnet_to_resource(&data, region))
    }

    async fn delete_vpc(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/virtualNetworks/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        self.client.delete(&path, NETWORK_API_VERSION).await
    }

    async fn list_subnets(&self, region: &str, vpc_id: &str) -> Result<Vec<CloudResource>> {
        let path = if vpc_id.starts_with('/') {
            format!("{}/subnets", vpc_id)
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/virtualNetworks/{}/subnets",
                DEFAULT_RESOURCE_GROUP, vpc_id
            )
        };
        let data = self.client.get(&path, NETWORK_API_VERSION).await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|s| azure_mapper::subnet_to_resource(s, region))
            .collect())
    }

    async fn create_subnet(
        &self,
        region: &str,
        config: CreateSubnetRequest,
    ) -> Result<CloudResource> {
        let vpc_path = if config.vpc_id.starts_with('/') {
            config.vpc_id.clone()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/virtualNetworks/{}",
                DEFAULT_RESOURCE_GROUP, config.vpc_id
            )
        };
        let path = format!("{}/subnets/{}", vpc_path, config.name);
        let body = serde_json::json!({
            "properties": {
                "addressPrefix": config.cidr_block
            }
        });

        let data = self.client.put(&path, NETWORK_API_VERSION, &body).await?;
        Ok(azure_mapper::subnet_to_resource(&data, region))
    }

    async fn delete_subnet(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            // Cannot reliably construct the path without VNet name, so treat as full path.
            return Err(CloudError::ProviderError(
                "Azure subnet delete requires a full resource ID".to_string(),
            ));
        };
        self.client.delete(&path, NETWORK_API_VERSION).await
    }

    async fn list_load_balancers(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.Network/loadBalancers";
        let data = self.client.get(path, NETWORK_API_VERSION).await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter(|lb| {
                lb["location"]
                    .as_str()
                    .map(|loc| loc.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|lb| azure_mapper::load_balancer_to_resource(lb, region))
            .collect())
    }

    async fn get_load_balancer(&self, region: &str, id: &str) -> Result<CloudResource> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/loadBalancers/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        let data = self.client.get(&path, NETWORK_API_VERSION).await?;
        Ok(azure_mapper::load_balancer_to_resource(&data, region))
    }

    async fn delete_load_balancer(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/loadBalancers/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        self.client.delete(&path, NETWORK_API_VERSION).await
    }

    async fn list_security_groups(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.Network/networkSecurityGroups";
        let data = self.client.get(path, NETWORK_API_VERSION).await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter(|nsg| {
                nsg["location"]
                    .as_str()
                    .map(|loc| loc.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|nsg| azure_mapper::nsg_to_resource(nsg, region))
            .collect())
    }

    // --- Elastic IPs → Azure Public IP Addresses ---

    async fn list_elastic_ips(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.Network/publicIPAddresses";
        let data = self.client.get(path, NETWORK_API_VERSION).await?;
        Ok(data["value"].as_array().unwrap_or(&vec![]).iter()
            .filter(|pip| {
                pip["location"].as_str()
                    .map(|loc| loc.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|pip| azure_mapper::public_ip_to_resource(pip, region))
            .collect())
    }

    async fn allocate_elastic_ip(&self, region: &str) -> Result<CloudResource> {
        let name = format!("pip-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("x"));
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.Network/publicIPAddresses/{}",
            DEFAULT_RESOURCE_GROUP, name
        );
        let body = serde_json::json!({
            "location": region,
            "sku": { "name": "Standard" },
            "properties": {
                "publicIPAllocationMethod": "Static",
                "publicIPAddressVersion": "IPv4",
            }
        });
        let data = self.client.put(&path, NETWORK_API_VERSION, &body).await?;
        Ok(azure_mapper::public_ip_to_resource(&data, region))
    }

    async fn associate_elastic_ip(&self, _region: &str, eip_id: &str, instance_id: &str) -> Result<()> {
        // Get the VM's primary NIC, then update it with the public IP
        let vm_path = if instance_id.starts_with('/') {
            instance_id.to_owned()
        } else {
            format!("/resourceGroups/{}/providers/Microsoft.Compute/virtualMachines/{}", DEFAULT_RESOURCE_GROUP, instance_id)
        };
        let vm_data = self.client.get(&vm_path, VM_API_VERSION).await?;
        let nic_id = vm_data["properties"]["networkProfile"]["networkInterfaces"]
            .as_array()
            .and_then(|a| a.first())
            .and_then(|n| n["id"].as_str())
            .ok_or_else(|| CloudError::ProviderError("VM has no network interface".into()))?;
        // Strip subscription prefix for path
        let nic_path = if let Some(idx) = nic_id.find("/resourceGroups") {
            &nic_id[idx..]
        } else {
            nic_id
        };
        let mut nic_data = self.client.get(nic_path, NETWORK_API_VERSION).await?;
        let pip_id = if eip_id.starts_with('/') {
            eip_id.to_owned()
        } else {
            format!("/subscriptions/{}/resourceGroups/{}/providers/Microsoft.Network/publicIPAddresses/{}",
                self.client.get(&"/", "2020-01-01").await.unwrap_or_default()["subscriptionId"].as_str().unwrap_or_default(),
                DEFAULT_RESOURCE_GROUP, eip_id)
        };
        if let Some(configs) = nic_data["properties"]["ipConfigurations"].as_array_mut() {
            if let Some(config) = configs.first_mut() {
                config["properties"]["publicIPAddress"] = serde_json::json!({"id": pip_id});
            }
        }
        self.client.put(nic_path, NETWORK_API_VERSION, &nic_data).await?;
        Ok(())
    }

    async fn disassociate_elastic_ip(&self, _region: &str, association_id: &str) -> Result<()> {
        // association_id is the NIC resource ID
        let nic_path = if association_id.starts_with('/') {
            if let Some(idx) = association_id.find("/resourceGroups") {
                &association_id[idx..]
            } else {
                association_id
            }
        } else {
            return Err(CloudError::BadRequest("Expected NIC resource ID as association_id".into()));
        };
        let mut nic_data = self.client.get(nic_path, NETWORK_API_VERSION).await?;
        if let Some(configs) = nic_data["properties"]["ipConfigurations"].as_array_mut() {
            if let Some(config) = configs.first_mut() {
                config["properties"].as_object_mut()
                    .map(|obj| obj.remove("publicIPAddress"));
            }
        }
        self.client.put(nic_path, NETWORK_API_VERSION, &nic_data).await?;
        Ok(())
    }

    async fn release_elastic_ip(&self, _region: &str, allocation_id: &str) -> Result<()> {
        let path = if allocation_id.starts_with('/') {
            if let Some(idx) = allocation_id.find("/resourceGroups") {
                allocation_id[idx..].to_owned()
            } else {
                allocation_id.to_owned()
            }
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/publicIPAddresses/{}",
                DEFAULT_RESOURCE_GROUP, allocation_id
            )
        };
        self.client.delete(&path, NETWORK_API_VERSION).await
    }

    // --- NAT Gateways → Azure NAT Gateway (first-class resource) ---

    async fn list_nat_gateways(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.Network/natGateways";
        let data = self.client.get(path, NETWORK_API_VERSION).await?;
        Ok(data["value"].as_array().unwrap_or(&vec![]).iter()
            .filter(|nat| {
                nat["location"].as_str()
                    .map(|loc| loc.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|nat| azure_mapper::nat_gateway_to_resource(nat, region))
            .collect())
    }

    async fn create_nat_gateway(&self, region: &str, _subnet_id: &str, eip_allocation_id: &str) -> Result<CloudResource> {
        let name = format!("natgw-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("x"));
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.Network/natGateways/{}",
            DEFAULT_RESOURCE_GROUP, name
        );
        let pip_id = if eip_allocation_id.starts_with('/') {
            eip_allocation_id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/publicIPAddresses/{}",
                DEFAULT_RESOURCE_GROUP, eip_allocation_id
            )
        };
        let body = serde_json::json!({
            "location": region,
            "sku": { "name": "Standard" },
            "properties": {
                "idleTimeoutInMinutes": 4,
                "publicIpAddresses": [{ "id": pip_id }],
            }
        });
        let data = self.client.put(&path, NETWORK_API_VERSION, &body).await?;
        Ok(azure_mapper::nat_gateway_to_resource(&data, region))
    }

    async fn delete_nat_gateway(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            if let Some(idx) = id.find("/resourceGroups") {
                id[idx..].to_owned()
            } else {
                id.to_owned()
            }
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/natGateways/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        self.client.delete(&path, NETWORK_API_VERSION).await
    }

    // --- Internet Gateways → Azure Route Tables with 0.0.0.0/0 → Internet ---
    // Azure has no explicit internet gateway. Internet access is implicit but
    // controlled via Route Tables. We map IGW operations to route tables
    // that have a default route with Internet next hop.

    async fn list_internet_gateways(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.Network/routeTables";
        let data = self.client.get(path, NETWORK_API_VERSION).await?;
        let mut igws = Vec::new();
        for rt in data["value"].as_array().unwrap_or(&vec![]) {
            let loc = rt["location"].as_str().unwrap_or_default();
            if !loc.eq_ignore_ascii_case(region) {
                continue;
            }
            // Check if this route table has a 0.0.0.0/0 → Internet route
            let has_internet_route = rt["properties"]["routes"].as_array()
                .map(|routes| routes.iter().any(|r| {
                    r["properties"]["addressPrefix"].as_str() == Some("0.0.0.0/0")
                        && r["properties"]["nextHopType"].as_str() == Some("Internet")
                }))
                .unwrap_or(false);
            if has_internet_route {
                let mut resource = azure_mapper::route_table_to_resource(rt, region);
                resource.resource_type = ResourceType::InternetGateway;
                igws.push(resource);
            }
        }
        Ok(igws)
    }

    async fn create_internet_gateway(&self, region: &str) -> Result<CloudResource> {
        // Create a route table with a 0.0.0.0/0 → Internet route
        let name = format!("igw-rt-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("x"));
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.Network/routeTables/{}",
            DEFAULT_RESOURCE_GROUP, name
        );
        let body = serde_json::json!({
            "location": region,
            "properties": {
                "routes": [{
                    "name": "internet-route",
                    "properties": {
                        "addressPrefix": "0.0.0.0/0",
                        "nextHopType": "Internet",
                    }
                }]
            }
        });
        let data = self.client.put(&path, NETWORK_API_VERSION, &body).await?;
        let mut resource = azure_mapper::route_table_to_resource(&data, region);
        resource.resource_type = ResourceType::InternetGateway;
        Ok(resource)
    }

    async fn attach_internet_gateway(&self, _region: &str, igw_id: &str, vpc_id: &str) -> Result<()> {
        // Associate the route table (IGW) with the VNet's first subnet
        // vpc_id should be a subnet resource ID for Azure
        let subnet_path = if vpc_id.starts_with('/') {
            if let Some(idx) = vpc_id.find("/resourceGroups") {
                vpc_id[idx..].to_owned()
            } else {
                vpc_id.to_owned()
            }
        } else {
            return Err(CloudError::BadRequest("Expected subnet resource ID for vpc_id in Azure".into()));
        };
        let rt_id = if igw_id.starts_with('/') {
            igw_id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/routeTables/{}",
                DEFAULT_RESOURCE_GROUP, igw_id
            )
        };
        let mut subnet_data = self.client.get(&subnet_path, NETWORK_API_VERSION).await?;
        subnet_data["properties"]["routeTable"] = serde_json::json!({"id": rt_id});
        self.client.put(&subnet_path, NETWORK_API_VERSION, &subnet_data).await?;
        Ok(())
    }

    async fn detach_internet_gateway(&self, _region: &str, _igw_id: &str, vpc_id: &str) -> Result<()> {
        let subnet_path = if vpc_id.starts_with('/') {
            if let Some(idx) = vpc_id.find("/resourceGroups") {
                vpc_id[idx..].to_owned()
            } else {
                vpc_id.to_owned()
            }
        } else {
            return Err(CloudError::BadRequest("Expected subnet resource ID for vpc_id in Azure".into()));
        };
        let mut subnet_data = self.client.get(&subnet_path, NETWORK_API_VERSION).await?;
        subnet_data["properties"].as_object_mut()
            .map(|obj| obj.remove("routeTable"));
        self.client.put(&subnet_path, NETWORK_API_VERSION, &subnet_data).await?;
        Ok(())
    }

    async fn delete_internet_gateway(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            if let Some(idx) = id.find("/resourceGroups") {
                id[idx..].to_owned()
            } else {
                id.to_owned()
            }
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/routeTables/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        self.client.delete(&path, NETWORK_API_VERSION).await
    }

    // --- Route Tables → Azure Route Tables (first-class resource) ---

    async fn list_route_tables(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.Network/routeTables";
        let data = self.client.get(path, NETWORK_API_VERSION).await?;
        Ok(data["value"].as_array().unwrap_or(&vec![]).iter()
            .filter(|rt| {
                rt["location"].as_str()
                    .map(|loc| loc.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|rt| azure_mapper::route_table_to_resource(rt, region))
            .collect())
    }

    async fn create_route_table(&self, region: &str, _vpc_id: &str) -> Result<CloudResource> {
        let name = format!("rt-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("x"));
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.Network/routeTables/{}",
            DEFAULT_RESOURCE_GROUP, name
        );
        let body = serde_json::json!({
            "location": region,
            "properties": {}
        });
        let data = self.client.put(&path, NETWORK_API_VERSION, &body).await?;
        Ok(azure_mapper::route_table_to_resource(&data, region))
    }

    async fn add_route(&self, _region: &str, route_table_id: &str, destination_cidr: &str, target_id: &str) -> Result<()> {
        let route_name = format!("route-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("x"));
        let rt_path = if route_table_id.starts_with('/') {
            if let Some(idx) = route_table_id.find("/resourceGroups") {
                route_table_id[idx..].to_owned()
            } else {
                route_table_id.to_owned()
            }
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/routeTables/{}",
                DEFAULT_RESOURCE_GROUP, route_table_id
            )
        };
        let path = format!("{}/routes/{}", rt_path, route_name);
        let body = serde_json::json!({
            "properties": {
                "addressPrefix": destination_cidr,
                "nextHopType": "VirtualAppliance",
                "nextHopIpAddress": target_id,
            }
        });
        self.client.put(&path, NETWORK_API_VERSION, &body).await?;
        Ok(())
    }

    async fn delete_route(&self, _region: &str, route_table_id: &str, destination_cidr: &str) -> Result<()> {
        // destination_cidr is used as route name identifier
        let rt_path = if route_table_id.starts_with('/') {
            if let Some(idx) = route_table_id.find("/resourceGroups") {
                route_table_id[idx..].to_owned()
            } else {
                route_table_id.to_owned()
            }
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/routeTables/{}",
                DEFAULT_RESOURCE_GROUP, route_table_id
            )
        };
        let path = format!("{}/routes/{}", rt_path, destination_cidr);
        self.client.delete(&path, NETWORK_API_VERSION).await
    }

    async fn associate_route_table(&self, _region: &str, route_table_id: &str, subnet_id: &str) -> Result<String> {
        let subnet_path = if subnet_id.starts_with('/') {
            if let Some(idx) = subnet_id.find("/resourceGroups") {
                subnet_id[idx..].to_owned()
            } else {
                subnet_id.to_owned()
            }
        } else {
            return Err(CloudError::BadRequest("Expected subnet resource ID".into()));
        };
        let rt_id = if route_table_id.starts_with('/') {
            route_table_id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/routeTables/{}",
                DEFAULT_RESOURCE_GROUP, route_table_id
            )
        };
        let mut subnet_data = self.client.get(&subnet_path, NETWORK_API_VERSION).await?;
        subnet_data["properties"]["routeTable"] = serde_json::json!({"id": rt_id});
        self.client.put(&subnet_path, NETWORK_API_VERSION, &subnet_data).await?;
        Ok(format!("{}/{}", route_table_id, subnet_id))
    }

    async fn delete_route_table(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            if let Some(idx) = id.find("/resourceGroups") {
                id[idx..].to_owned()
            } else {
                id.to_owned()
            }
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/routeTables/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        self.client.delete(&path, NETWORK_API_VERSION).await
    }

    // --- Security Group CRUD → Azure Network Security Groups (NSGs) ---

    async fn create_security_group(&self, region: &str, name: &str, description: &str, _vpc_id: &str) -> Result<CloudResource> {
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.Network/networkSecurityGroups/{}",
            DEFAULT_RESOURCE_GROUP, name
        );
        let body = serde_json::json!({
            "location": region,
            "tags": { "description": description },
            "properties": {}
        });
        let data = self.client.put(&path, NETWORK_API_VERSION, &body).await?;
        Ok(azure_mapper::nsg_to_resource(&data, region))
    }

    async fn add_security_group_rule(&self, _region: &str, sg_id: &str, rule: SecurityGroupRule) -> Result<()> {
        let rule_name = format!("rule-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("x"));
        let nsg_path = if sg_id.starts_with('/') {
            if let Some(idx) = sg_id.find("/resourceGroups") {
                sg_id[idx..].to_owned()
            } else {
                sg_id.to_owned()
            }
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/networkSecurityGroups/{}",
                DEFAULT_RESOURCE_GROUP, sg_id
            )
        };
        let path = format!("{}/securityRules/{}", nsg_path, rule_name);
        let direction = if rule.direction.eq_ignore_ascii_case("ingress") { "Inbound" } else { "Outbound" };
        let protocol = match rule.protocol.to_lowercase().as_str() {
            "tcp" => "Tcp",
            "udp" => "Udp",
            "icmp" => "Icmp",
            _ => "*",
        };
        let body = serde_json::json!({
            "properties": {
                "protocol": protocol,
                "sourcePortRange": "*",
                "destinationPortRange": if rule.from_port == rule.to_port {
                    format!("{}", rule.from_port)
                } else {
                    format!("{}-{}", rule.from_port, rule.to_port)
                },
                "sourceAddressPrefix": rule.cidr,
                "destinationAddressPrefix": "*",
                "access": "Allow",
                "priority": 100,
                "direction": direction,
                "description": rule.description.unwrap_or_default(),
            }
        });
        self.client.put(&path, NETWORK_API_VERSION, &body).await?;
        Ok(())
    }

    async fn remove_security_group_rule(&self, _region: &str, sg_id: &str, rule: SecurityGroupRule) -> Result<()> {
        // Use the rule description as the rule name to delete, or derive from params
        let rule_name = rule.description.unwrap_or_default();
        if rule_name.is_empty() {
            return Err(CloudError::BadRequest("Rule description must contain the security rule name to delete".into()));
        }
        let nsg_path = if sg_id.starts_with('/') {
            if let Some(idx) = sg_id.find("/resourceGroups") {
                sg_id[idx..].to_owned()
            } else {
                sg_id.to_owned()
            }
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/networkSecurityGroups/{}",
                DEFAULT_RESOURCE_GROUP, sg_id
            )
        };
        let path = format!("{}/securityRules/{}", nsg_path, rule_name);
        self.client.delete(&path, NETWORK_API_VERSION).await
    }

    async fn delete_security_group(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            if let Some(idx) = id.find("/resourceGroups") {
                id[idx..].to_owned()
            } else {
                id.to_owned()
            }
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/networkSecurityGroups/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        self.client.delete(&path, NETWORK_API_VERSION).await
    }

    // --- VPC Peering → Azure VNet Peering ---

    async fn list_vpc_peering_connections(&self, region: &str) -> Result<Vec<CloudResource>> {
        // List all VNets, then collect peerings from each
        let vnet_path = "/providers/Microsoft.Network/virtualNetworks";
        let data = self.client.get(vnet_path, NETWORK_API_VERSION).await?;
        let mut peerings = Vec::new();
        for vnet in data["value"].as_array().unwrap_or(&vec![]) {
            let loc = vnet["location"].as_str().unwrap_or_default();
            if !loc.eq_ignore_ascii_case(region) {
                continue;
            }
            if let Some(vnet_id) = vnet["id"].as_str() {
                let peering_path = if let Some(idx) = vnet_id.find("/resourceGroups") {
                    format!("{}/virtualNetworkPeerings", &vnet_id[idx..])
                } else {
                    continue;
                };
                match self.client.get(&peering_path, NETWORK_API_VERSION).await {
                    Ok(peering_data) => {
                        for p in peering_data["value"].as_array().unwrap_or(&vec![]) {
                            peerings.push(azure_mapper::vnet_peering_to_resource(p, region));
                        }
                    }
                    Err(_) => continue,
                }
            }
        }
        Ok(peerings)
    }

    async fn create_vpc_peering(&self, _region: &str, vpc_id: &str, peer_vpc_id: &str) -> Result<CloudResource> {
        let peering_name = format!("peer-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("x"));
        let vnet_path = if vpc_id.starts_with('/') {
            if let Some(idx) = vpc_id.find("/resourceGroups") {
                vpc_id[idx..].to_owned()
            } else {
                vpc_id.to_owned()
            }
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/virtualNetworks/{}",
                DEFAULT_RESOURCE_GROUP, vpc_id
            )
        };
        let path = format!("{}/virtualNetworkPeerings/{}", vnet_path, peering_name);
        let body = serde_json::json!({
            "properties": {
                "remoteVirtualNetwork": { "id": peer_vpc_id },
                "allowVirtualNetworkAccess": true,
                "allowForwardedTraffic": false,
                "allowGatewayTransit": false,
                "useRemoteGateways": false,
            }
        });
        let data = self.client.put(&path, NETWORK_API_VERSION, &body).await?;
        Ok(azure_mapper::vnet_peering_to_resource(&data, "global"))
    }

    async fn accept_vpc_peering(&self, _region: &str, _peering_id: &str) -> Result<()> {
        // Azure VNet peering is auto-accepted when both sides create peerings.
        // No explicit accept action needed.
        Ok(())
    }

    async fn delete_vpc_peering(&self, _region: &str, peering_id: &str) -> Result<()> {
        let path = if peering_id.starts_with('/') {
            if let Some(idx) = peering_id.find("/resourceGroups") {
                peering_id[idx..].to_owned()
            } else {
                peering_id.to_owned()
            }
        } else {
            return Err(CloudError::BadRequest("Expected full peering resource ID".into()));
        };
        self.client.delete(&path, NETWORK_API_VERSION).await
    }
}

#[async_trait]
impl DatabaseProvider for AzureSdkProvider {
    async fn list_databases(&self, region: &str) -> Result<Vec<CloudResource>> {
        // First list all SQL servers, then list databases under each.
        let servers_path = "/providers/Microsoft.Sql/servers";
        let servers_data = self.client.get(servers_path, SQL_API_VERSION).await?;
        let mut databases = Vec::new();

        let empty = vec![];
        let servers = servers_data["value"].as_array().unwrap_or(&empty);
        for server in servers {
            let server_location = server["location"].as_str().unwrap_or_default();
            if !server_location.eq_ignore_ascii_case(region) {
                continue;
            }
            if let Some(server_id) = server["id"].as_str() {
                let dbs_path = format!("{}/databases", server_id);
                match self.client.get(&dbs_path, SQL_API_VERSION).await {
                    Ok(dbs_data) => {
                        if let Some(dbs) = dbs_data["value"].as_array() {
                            for db in dbs {
                                // Skip the system 'master' database.
                                if db["name"].as_str() == Some("master") {
                                    continue;
                                }
                                databases
                                    .push(azure_mapper::sql_database_to_resource(db, region));
                            }
                        }
                    }
                    Err(_) => continue,
                }
            }
        }
        Ok(databases)
    }

    async fn get_database(&self, region: &str, id: &str) -> Result<CloudResource> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            // Without a server name we cannot construct the path.
            return Err(CloudError::NotFound(format!(
                "Azure SQL database {id} not found -- provide full resource ID"
            )));
        };
        let data = self.client.get(&path, SQL_API_VERSION).await?;
        Ok(azure_mapper::sql_database_to_resource(&data, region))
    }

    async fn create_database(
        &self,
        region: &str,
        config: CreateDatabaseRequest,
    ) -> Result<CloudResource> {
        let rg = DEFAULT_RESOURCE_GROUP;

        // Derive a server name from the database name (convention: <db>-server).
        let server_name = format!("{}-server", config.name);

        // Ensure the SQL server exists (PUT is idempotent).
        let server_path = format!(
            "/resourceGroups/{}/providers/Microsoft.Sql/servers/{}",
            rg, server_name
        );
        let server_body = serde_json::json!({
            "location": region,
            "properties": {
                "administratorLogin": "sqladmin",
                "administratorLoginPassword": "ChangeMe!12345",
                "version": "12.0"
            }
        });
        self.client
            .put(&server_path, SQL_API_VERSION, &server_body)
            .await?;

        // Create the database under that server.
        let db_path = format!("{}/databases/{}", server_path, config.name);
        let body = serde_json::json!({
            "location": region,
            "sku": {
                "name": config.instance_class,
                "tier": "GeneralPurpose"
            },
            "properties": {
                "collation": "SQL_Latin1_General_CP1_CI_AS",
                "maxSizeBytes": (config.storage_gb as u64) * 1_073_741_824,
            },
            "tags": config.tags,
        });

        let data = self.client.put(&db_path, SQL_API_VERSION, &body).await?;
        Ok(azure_mapper::sql_database_to_resource(&data, region))
    }

    async fn delete_database(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            return Err(CloudError::ProviderError(
                "Azure SQL database delete requires a full resource ID".to_string(),
            ));
        };
        self.client.delete(&path, SQL_API_VERSION).await
    }

    async fn restart_database(&self, _region: &str, id: &str) -> Result<()> {
        // Azure SQL does not expose a direct restart action via ARM.
        // Failover can be used on replicas; for standalone DBs there is no equivalent.
        // We issue a failover POST as the closest equivalent.
        let path = if id.starts_with('/') {
            format!("{}/failover", id)
        } else {
            return Err(CloudError::ProviderError(
                "Azure SQL restart requires a full resource ID".to_string(),
            ));
        };
        self.client
            .post(&path, SQL_API_VERSION, &serde_json::json!({}))
            .await?;
        Ok(())
    }

    async fn create_snapshot(
        &self,
        _region: &str,
        db_id: &str,
        snapshot_name: &str,
    ) -> Result<CloudResource> {
        // Azure SQL uses automated backups; "snapshots" are modeled as database copies
        // or long-term retention policies. We create a database copy as a snapshot.
        let _ = self
            .client
            .post(
                &format!("{}/export", db_id),
                SQL_API_VERSION,
                &serde_json::json!({
                    "properties": {
                        "storageKeyType": "SharedAccessKey",
                        "storageKey": "snapshot-placeholder",
                        "storageUri": format!("https://snapshots.blob.core.windows.net/{}.bacpac", snapshot_name),
                        "administratorLogin": "sqladmin",
                        "administratorLoginPassword": "ChangeMe!12345"
                    }
                }),
            )
            .await?;

        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(snapshot_name.to_owned()),
            provider: CloudProvider::Azure,
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
        Err(CloudError::ProviderError("Azure SQL create_read_replica not yet implemented via SDK".into()))
    }
    async fn list_parameter_groups(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(vec![]) }
    async fn get_parameter_group(&self, _region: &str, name: &str) -> Result<serde_json::Value> {
        Ok(serde_json::json!({"name": name, "description": "Azure SQL server configuration (stub)"}))
    }
    async fn restore_to_point_in_time(&self, _region: &str, _source_db_id: &str, _target_name: &str, _restore_time: &str) -> Result<CloudResource> {
        Err(CloudError::ProviderError("Azure SQL restore_to_point_in_time not yet implemented via SDK".into()))
    }
}

#[async_trait]
impl ServerlessProvider for AzureSdkProvider {
    async fn list_functions(&self, _region: &str) -> Result<Vec<CloudResource>> {
        // Azure Functions are managed via Azure Web Apps / Function Apps.
        let path = "/providers/Microsoft.Web/sites?api-version=2023-12-01";
        let data = self.client.get(path, "2023-12-01").await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter(|v| v["kind"].as_str().unwrap_or("").contains("functionapp"))
            .map(|f| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: f["id"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Azure,
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
        let path = format!("/providers/Microsoft.Web/sites/{}", name);
        let data = self.client.get(&path, "2023-12-01").await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
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
        let path = format!("/providers/Microsoft.Web/sites/{}", config.name);
        let body = serde_json::json!({
            "kind": "functionapp",
            "location": "eastus",
            "properties": {
                "siteConfig": {
                    "appSettings": [
                        {"name": "FUNCTIONS_WORKER_RUNTIME", "value": config.runtime},
                    ],
                },
            },
        });
        let data = self.client.put(&path, "2023-12-01", &body).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::Function,
            name: config.name,
            region: "eastus".to_owned(),
            status: ResourceStatus::Creating,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn update_function_code(&self, _region: &str, name: &str, _zip_bytes: Vec<u8>) -> Result<CloudResource> {
        // Azure Function code deployment is done via zip deploy endpoint — stub.
        self.get_function(_region, name).await
    }

    async fn delete_function(&self, _region: &str, name: &str) -> Result<()> {
        let path = format!("/providers/Microsoft.Web/sites/{}", name);
        self.client.delete(&path, "2023-12-01").await
    }

    async fn invoke_function(&self, _region: &str, _name: &str, payload: serde_json::Value) -> Result<serde_json::Value> {
        // Azure Functions invocation goes through HTTP trigger, not ARM.
        Ok(serde_json::json!({"status_code": 200, "payload": {"echo": payload}}))
    }

    async fn list_function_versions(&self, _region: &str, _name: &str) -> Result<Vec<CloudResource>> {
        Ok(vec![])
    }
}

#[async_trait]
impl TrafficProvider for AzureSdkProvider {
    async fn get_flow_logs(&self, _region: &str, _log_group: Option<&str>, _start_time: Option<i64>, _end_time: Option<i64>) -> Result<FlowLogResponse> {
        Ok(FlowLogResponse { entries: vec![], query_id: None })
    }
    async fn get_traffic_summary(&self, _region: &str) -> Result<TrafficSummary> {
        Ok(TrafficSummary { total_bytes_in: 0, total_bytes_out: 0, total_requests: 0, total_errors: 0, top_talkers: vec![], per_service: vec![], timestamp: chrono::Utc::now().to_rfc3339() })
    }
}

#[async_trait]
impl KubernetesProvider for AzureSdkProvider {
    async fn list_clusters(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(vec![]) }
    async fn get_cluster(&self, _region: &str, name: &str) -> Result<CloudResource> { Err(CloudError::NotFound(format!("AKS cluster {} not found", name))) }
    async fn create_cluster(&self, _region: &str, _config: CreateClusterRequest) -> Result<CloudResource> { Err(CloudError::ProviderError("AKS create_cluster not yet implemented".into())) }
    async fn delete_cluster(&self, _region: &str, _name: &str) -> Result<()> { Err(CloudError::ProviderError("AKS delete_cluster not yet implemented".into())) }
    async fn list_node_groups(&self, _region: &str, _cluster_name: &str) -> Result<Vec<CloudResource>> { Ok(vec![]) }
    async fn create_node_group(&self, _region: &str, _cluster_name: &str, _config: CreateNodeGroupRequest) -> Result<CloudResource> { Err(CloudError::ProviderError("AKS create_node_pool not yet implemented".into())) }
    async fn delete_node_group(&self, _region: &str, _cluster_name: &str, _node_group_name: &str) -> Result<()> { Err(CloudError::ProviderError("AKS delete_node_pool not yet implemented".into())) }
    async fn scale_node_group(&self, _region: &str, _cluster_name: &str, _node_group_name: &str, _desired: i32) -> Result<()> { Err(CloudError::ProviderError("AKS scale_node_pool not yet implemented".into())) }
}

#[async_trait]
impl ContainerRegistryProvider for AzureSdkProvider {
    async fn list_registries(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(vec![]) }
    async fn get_registry(&self, _region: &str, id: &str) -> Result<CloudResource> { Err(CloudError::NotFound(format!("Azure ACR {} not found", id))) }
    async fn create_registry(&self, _region: &str, _name: &str) -> Result<CloudResource> { Err(CloudError::ProviderError("Azure ACR create not yet implemented via SDK".into())) }
    async fn delete_registry(&self, _region: &str, _id: &str) -> Result<()> { Err(CloudError::ProviderError("Azure ACR delete not yet implemented via SDK".into())) }
    async fn list_images(&self, _region: &str, _registry: &str) -> Result<Vec<CloudResource>> { Ok(vec![]) }
    async fn get_image_scan_results(&self, _region: &str, registry: &str, image_tag: &str) -> Result<serde_json::Value> {
        Ok(serde_json::json!({"repository": registry, "image_tag": image_tag, "scan_status": "NOT_AVAILABLE"}))
    }
    async fn start_image_scan(&self, _region: &str, _registry: &str, _image_tag: &str) -> Result<()> {
        Err(CloudError::ProviderError("Azure image scanning not yet implemented via SDK".into()))
    }
}

#[async_trait]
impl WorkflowProvider for AzureSdkProvider {
    async fn list_state_machines(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(vec![]) }
    async fn get_state_machine(&self, _region: &str, arn: &str) -> Result<CloudResource> { Err(CloudError::NotFound(format!("Azure Logic App {} not found", arn))) }
    async fn start_execution(&self, _region: &str, _arn: &str, _input: serde_json::Value) -> Result<CloudResource> { Err(CloudError::ProviderError("Azure Logic Apps not yet implemented via SDK".into())) }
    async fn list_executions(&self, _region: &str, _arn: &str) -> Result<Vec<CloudResource>> { Ok(vec![]) }
}

// ---------------------------------------------------------------------------
// ApiGatewayProvider – Azure API Management
// ---------------------------------------------------------------------------

#[async_trait]
impl ApiGatewayProvider for AzureSdkProvider {
    async fn list_apis(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.ApiManagement/service";
        let data = self.client.get(path, MISC_API_VERSION).await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter(|v| {
                v["location"]
                    .as_str()
                    .map(|l| l.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|v| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: v["id"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Azure,
                resource_type: ResourceType::ApiGateway,
                name: v["name"].as_str().unwrap_or_default().to_owned(),
                region: region.to_owned(),
                status: ResourceStatus::Available,
                metadata: v.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn get_api(&self, region: &str, id: &str) -> Result<CloudResource> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.ApiManagement/service/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        let data = self.client.get(&path, MISC_API_VERSION).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::ApiGateway,
            name: data["name"].as_str().unwrap_or(id).to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Available,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn create_api(&self, region: &str, name: &str, protocol: &str) -> Result<CloudResource> {
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.ApiManagement/service/{}",
            DEFAULT_RESOURCE_GROUP, name
        );
        let body = serde_json::json!({
            "location": region,
            "sku": { "name": "Consumption", "capacity": 0 },
            "properties": {
                "publisherEmail": "admin@example.com",
                "publisherName": "CloudManager",
                "gatewayUrl": format!("https://{}.azure-api.net", name),
                "protocols": [protocol],
            }
        });
        let data = self.client.put(&path, MISC_API_VERSION, &body).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::ApiGateway,
            name: name.to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Creating,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn delete_api(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.ApiManagement/service/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        self.client.delete(&path, MISC_API_VERSION).await
    }

    async fn list_routes(&self, _region: &str, api_id: &str) -> Result<Vec<CloudResource>> {
        let path = if api_id.starts_with('/') {
            format!("{}/apis", api_id)
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.ApiManagement/service/{}/apis",
                DEFAULT_RESOURCE_GROUP, api_id
            )
        };
        let data = self.client.get(&path, MISC_API_VERSION).await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|r| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: r["id"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Azure,
                resource_type: ResourceType::ApiRoute,
                name: r["name"].as_str().unwrap_or_default().to_owned(),
                region: String::new(),
                status: ResourceStatus::Available,
                metadata: r.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn create_route(&self, _region: &str, api_id: &str, method: &str, path: &str) -> Result<CloudResource> {
        let route_name = format!("{}-{}", method.to_lowercase(), path.replace('/', "-").trim_matches('-'));
        let api_path = if api_id.starts_with('/') {
            format!("{}/apis/{}", api_id, route_name)
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.ApiManagement/service/{}/apis/{}",
                DEFAULT_RESOURCE_GROUP, api_id, route_name
            )
        };
        let body = serde_json::json!({
            "properties": {
                "displayName": format!("{} {}", method, path),
                "path": path,
                "protocols": ["https"],
            }
        });
        let data = self.client.put(&api_path, MISC_API_VERSION, &body).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::ApiRoute,
            name: route_name,
            region: String::new(),
            status: ResourceStatus::Creating,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn list_stages(&self, _region: &str, _api_id: &str) -> Result<Vec<CloudResource>> {
        // Azure API Management does not have a stages concept like AWS — return empty.
        Ok(vec![])
    }

    async fn create_stage(&self, _region: &str, _api_id: &str, _name: &str) -> Result<CloudResource> {
        Err(CloudError::ProviderError(
            "Azure API Management does not support stages".into(),
        ))
    }
}

// ---------------------------------------------------------------------------
// CdnProvider – Azure CDN profiles / endpoints
// ---------------------------------------------------------------------------

#[async_trait]
impl CdnProvider for AzureSdkProvider {
    async fn list_distributions(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.Cdn/profiles";
        let data = self.client.get(path, MISC_API_VERSION).await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter(|v| {
                v["location"]
                    .as_str()
                    .map(|l| l.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|v| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: v["id"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Azure,
                resource_type: ResourceType::CdnDistribution,
                name: v["name"].as_str().unwrap_or_default().to_owned(),
                region: region.to_owned(),
                status: ResourceStatus::Available,
                metadata: v.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn get_distribution(&self, region: &str, id: &str) -> Result<CloudResource> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Cdn/profiles/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        let data = self.client.get(&path, MISC_API_VERSION).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::CdnDistribution,
            name: data["name"].as_str().unwrap_or(id).to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Available,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn create_distribution(&self, region: &str, config: CreateDistributionRequest) -> Result<CloudResource> {
        let profile_name = config.origin_domain.replace('.', "-");
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.Cdn/profiles/{}",
            DEFAULT_RESOURCE_GROUP, profile_name
        );
        let body = serde_json::json!({
            "location": region,
            "sku": { "name": "Standard_Microsoft" },
            "properties": {
                "originResponseTimeoutSeconds": 60,
            }
        });
        let data = self.client.put(&path, MISC_API_VERSION, &body).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::CdnDistribution,
            name: profile_name,
            region: region.to_owned(),
            status: ResourceStatus::Creating,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn delete_distribution(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Cdn/profiles/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        self.client.delete(&path, MISC_API_VERSION).await
    }

    async fn invalidate_cache(&self, _region: &str, distribution_id: &str, paths: Vec<String>) -> Result<()> {
        let purge_path = if distribution_id.starts_with('/') {
            format!("{}/purge", distribution_id)
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Cdn/profiles/{}/purge",
                DEFAULT_RESOURCE_GROUP, distribution_id
            )
        };
        let body = serde_json::json!({ "contentPaths": paths });
        self.client
            .post(&purge_path, MISC_API_VERSION, &body)
            .await?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// NoSqlProvider – Azure Cosmos DB
// ---------------------------------------------------------------------------

#[async_trait]
impl NoSqlProvider for AzureSdkProvider {
    async fn list_tables(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.DocumentDB/databaseAccounts";
        let data = self.client.get(path, MISC_API_VERSION).await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter(|v| {
                v["location"]
                    .as_str()
                    .map(|l| l.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|v| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: v["id"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Azure,
                resource_type: ResourceType::NoSqlTable,
                name: v["name"].as_str().unwrap_or_default().to_owned(),
                region: region.to_owned(),
                status: ResourceStatus::Available,
                metadata: v.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn get_table(&self, region: &str, name: &str) -> Result<CloudResource> {
        let path = if name.starts_with('/') {
            name.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.DocumentDB/databaseAccounts/{}",
                DEFAULT_RESOURCE_GROUP, name
            )
        };
        let data = self.client.get(&path, MISC_API_VERSION).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::NoSqlTable,
            name: data["name"].as_str().unwrap_or(name).to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Available,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn create_table(
        &self,
        region: &str,
        name: &str,
        key_schema: serde_json::Value,
    ) -> Result<CloudResource> {
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.DocumentDB/databaseAccounts/{}",
            DEFAULT_RESOURCE_GROUP, name
        );
        let body = serde_json::json!({
            "location": region,
            "kind": "GlobalDocumentDB",
            "properties": {
                "databaseAccountOfferType": "Standard",
                "locations": [{ "locationName": region, "failoverPriority": 0 }],
                "consistencyPolicy": { "defaultConsistencyLevel": "Session" },
                "keySchema": key_schema,
            }
        });
        let data = self.client.put(&path, MISC_API_VERSION, &body).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::NoSqlTable,
            name: name.to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Creating,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn delete_table(&self, _region: &str, name: &str) -> Result<()> {
        let path = if name.starts_with('/') {
            name.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.DocumentDB/databaseAccounts/{}",
                DEFAULT_RESOURCE_GROUP, name
            )
        };
        self.client.delete(&path, MISC_API_VERSION).await
    }

    async fn describe_table(&self, _region: &str, name: &str) -> Result<serde_json::Value> {
        let path = if name.starts_with('/') {
            name.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.DocumentDB/databaseAccounts/{}",
                DEFAULT_RESOURCE_GROUP, name
            )
        };
        let data = self.client.get(&path, MISC_API_VERSION).await?;
        Ok(data)
    }
}

// ---------------------------------------------------------------------------
// CacheDbProvider – Azure Cache for Redis
// ---------------------------------------------------------------------------

#[async_trait]
impl CacheDbProvider for AzureSdkProvider {
    async fn list_clusters(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.Cache/redis";
        let data = self.client.get(path, MISC_API_VERSION).await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter(|v| {
                v["location"]
                    .as_str()
                    .map(|l| l.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|v| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: v["id"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Azure,
                resource_type: ResourceType::CacheCluster,
                name: v["name"].as_str().unwrap_or_default().to_owned(),
                region: region.to_owned(),
                status: ResourceStatus::Available,
                metadata: v.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn get_cluster(&self, region: &str, id: &str) -> Result<CloudResource> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Cache/redis/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        let data = self.client.get(&path, MISC_API_VERSION).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::CacheCluster,
            name: data["name"].as_str().unwrap_or(id).to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Available,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn create_cluster(
        &self,
        region: &str,
        name: &str,
        _engine: &str,
        node_type: &str,
    ) -> Result<CloudResource> {
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.Cache/redis/{}",
            DEFAULT_RESOURCE_GROUP, name
        );
        let body = serde_json::json!({
            "location": region,
            "properties": {
                "sku": {
                    "name": "Standard",
                    "family": "C",
                    "capacity": node_type.parse::<i32>().unwrap_or(1),
                },
                "enableNonSslPort": false,
                "minimumTlsVersion": "1.2",
            }
        });
        let data = self.client.put(&path, MISC_API_VERSION, &body).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::CacheCluster,
            name: name.to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Creating,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn delete_cluster(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Cache/redis/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        self.client.delete(&path, MISC_API_VERSION).await
    }
}

// ---------------------------------------------------------------------------
// MlProvider – Azure Machine Learning workspaces
// ---------------------------------------------------------------------------

#[async_trait]
impl MlProvider for AzureSdkProvider {
    async fn list_models(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.MachineLearningServices/workspaces";
        let data = self.client.get(path, MISC_API_VERSION).await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter(|v| {
                v["location"]
                    .as_str()
                    .map(|l| l.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|v| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: v["id"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Azure,
                resource_type: ResourceType::MlModel,
                name: v["name"].as_str().unwrap_or_default().to_owned(),
                region: region.to_owned(),
                status: ResourceStatus::Available,
                metadata: v.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn list_endpoints(&self, region: &str) -> Result<Vec<CloudResource>> {
        // Azure ML online endpoints live under a workspace. Without a workspace name
        // we list workspaces as a proxy. A full implementation would enumerate
        // endpoints under each workspace.
        let _ = region;
        Ok(vec![])
    }

    async fn list_training_jobs(&self, _region: &str) -> Result<Vec<CloudResource>> {
        Ok(vec![])
    }

    async fn create_endpoint(
        &self,
        region: &str,
        name: &str,
        model_name: &str,
    ) -> Result<CloudResource> {
        // Creating an Azure ML online endpoint requires a workspace context.
        // Use a conventional workspace name derived from the endpoint name.
        let workspace = format!("{}-ws", name);
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.MachineLearningServices/workspaces/{}/onlineEndpoints/{}",
            DEFAULT_RESOURCE_GROUP, workspace, name
        );
        let body = serde_json::json!({
            "location": region,
            "properties": {
                "authMode": "Key",
                "description": format!("Endpoint for model {}", model_name),
            }
        });
        let data = self.client.put(&path, MISC_API_VERSION, &body).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::MlEndpoint,
            name: name.to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Creating,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn delete_endpoint(&self, _region: &str, name: &str) -> Result<()> {
        let workspace = format!("{}-ws", name);
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.MachineLearningServices/workspaces/{}/onlineEndpoints/{}",
            DEFAULT_RESOURCE_GROUP, workspace, name
        );
        self.client.delete(&path, MISC_API_VERSION).await
    }
}

// ---------------------------------------------------------------------------
// IoTProvider – Azure IoT Hub
// ---------------------------------------------------------------------------

#[async_trait]
impl IoTProvider for AzureSdkProvider {
    async fn list_things(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.Devices/IotHubs";
        let data = self.client.get(path, MISC_API_VERSION).await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter(|v| {
                v["location"]
                    .as_str()
                    .map(|l| l.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|v| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: v["id"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Azure,
                resource_type: ResourceType::IoTThing,
                name: v["name"].as_str().unwrap_or_default().to_owned(),
                region: region.to_owned(),
                status: ResourceStatus::Available,
                metadata: v.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn get_thing(&self, region: &str, name: &str) -> Result<CloudResource> {
        let path = if name.starts_with('/') {
            name.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Devices/IotHubs/{}",
                DEFAULT_RESOURCE_GROUP, name
            )
        };
        let data = self.client.get(&path, MISC_API_VERSION).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::IoTThing,
            name: data["name"].as_str().unwrap_or(name).to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Available,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn create_thing(
        &self,
        region: &str,
        name: &str,
        attributes: serde_json::Value,
    ) -> Result<CloudResource> {
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.Devices/IotHubs/{}",
            DEFAULT_RESOURCE_GROUP, name
        );
        let body = serde_json::json!({
            "location": region,
            "sku": { "name": "S1", "capacity": 1 },
            "properties": {
                "eventHubEndpoints": {},
                "routing": {},
                "features": "None",
                "customAttributes": attributes,
            }
        });
        let data = self.client.put(&path, MISC_API_VERSION, &body).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::IoTThing,
            name: name.to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Creating,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn delete_thing(&self, _region: &str, name: &str) -> Result<()> {
        let path = if name.starts_with('/') {
            name.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Devices/IotHubs/{}",
                DEFAULT_RESOURCE_GROUP, name
            )
        };
        self.client.delete(&path, MISC_API_VERSION).await
    }

    async fn list_thing_groups(&self, _region: &str) -> Result<Vec<CloudResource>> {
        // Azure IoT Hub does not have a direct "thing groups" ARM resource. Return empty.
        Ok(vec![])
    }
}

// ---------------------------------------------------------------------------
// MessagingProvider – Azure Service Bus
// ---------------------------------------------------------------------------

#[async_trait]
impl MessagingProvider for AzureSdkProvider {
    async fn list_queues(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.ServiceBus/namespaces";
        let data = self.client.get(path, MISC_API_VERSION).await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter(|v| {
                v["location"]
                    .as_str()
                    .map(|l| l.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|v| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: v["id"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Azure,
                resource_type: ResourceType::Queue,
                name: v["name"].as_str().unwrap_or_default().to_owned(),
                region: region.to_owned(),
                status: ResourceStatus::Available,
                metadata: v.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn get_queue(&self, region: &str, id: &str) -> Result<CloudResource> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.ServiceBus/namespaces/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        let data = self.client.get(&path, MISC_API_VERSION).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::Queue,
            name: data["name"].as_str().unwrap_or(id).to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Available,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn create_queue(&self, region: &str, name: &str, _fifo: bool) -> Result<CloudResource> {
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.ServiceBus/namespaces/{}",
            DEFAULT_RESOURCE_GROUP, name
        );
        let body = serde_json::json!({
            "location": region,
            "sku": { "name": "Standard", "tier": "Standard" },
            "properties": {}
        });
        let data = self.client.put(&path, MISC_API_VERSION, &body).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::Queue,
            name: name.to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Creating,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn delete_queue(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.ServiceBus/namespaces/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        self.client.delete(&path, MISC_API_VERSION).await
    }

    async fn list_topics(&self, _region: &str) -> Result<Vec<CloudResource>> {
        // Service Bus topics live under a namespace — without a specific namespace
        // we cannot enumerate them globally. Return empty.
        Ok(vec![])
    }

    async fn create_topic(&self, region: &str, name: &str) -> Result<CloudResource> {
        // Create a namespace to host the topic, then create the topic under it.
        let ns_name = format!("{}-ns", name);
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.ServiceBus/namespaces/{}/topics/{}",
            DEFAULT_RESOURCE_GROUP, ns_name, name
        );
        let body = serde_json::json!({
            "properties": {
                "maxSizeInMegabytes": 1024,
            }
        });
        let data = self.client.put(&path, MISC_API_VERSION, &body).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::Topic,
            name: name.to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Creating,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn delete_topic(&self, _region: &str, id: &str) -> Result<()> {
        if id.starts_with('/') {
            self.client.delete(id, MISC_API_VERSION).await
        } else {
            Err(CloudError::ProviderError(
                "Azure Service Bus topic delete requires a full resource ID".into(),
            ))
        }
    }
}

// ---------------------------------------------------------------------------
// DnsProvider – Azure DNS zones
// ---------------------------------------------------------------------------

#[async_trait]
impl DnsProvider for AzureSdkProvider {
    async fn list_hosted_zones(&self, _region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.Network/dnsZones";
        let data = self.client.get(path, NETWORK_API_VERSION).await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|v| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: v["id"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Azure,
                resource_type: ResourceType::DnsZone,
                name: v["name"].as_str().unwrap_or_default().to_owned(),
                region: "global".to_owned(),
                status: ResourceStatus::Available,
                metadata: v.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn list_records(&self, _region: &str, zone_id: &str) -> Result<Vec<CloudResource>> {
        let path = if zone_id.starts_with('/') {
            format!("{}/recordsets", zone_id)
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/dnsZones/{}/recordsets",
                DEFAULT_RESOURCE_GROUP, zone_id
            )
        };
        let data = self.client.get(&path, NETWORK_API_VERSION).await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|r| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: r["id"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Azure,
                resource_type: ResourceType::DnsRecord,
                name: r["name"].as_str().unwrap_or_default().to_owned(),
                region: "global".to_owned(),
                status: ResourceStatus::Available,
                metadata: r.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn create_record(&self, _region: &str, zone_id: &str, record: DnsRecordInput) -> Result<CloudResource> {
        let zone_path = if zone_id.starts_with('/') {
            zone_id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/dnsZones/{}",
                DEFAULT_RESOURCE_GROUP, zone_id
            )
        };
        let path = format!("{}/{}/{}", zone_path, record.record_type, record.name);
        let records_key = format!("{}Records", record.record_type);
        let body = serde_json::json!({
            "properties": {
                "TTL": record.ttl,
                records_key: record.values.iter().map(|v| {
                    serde_json::json!({"ipv4Address": v})
                }).collect::<Vec<_>>(),
            }
        });
        let data = self.client.put(&path, NETWORK_API_VERSION, &body).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::DnsRecord,
            name: record.name,
            region: "global".to_owned(),
            status: ResourceStatus::Available,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn delete_record(&self, _region: &str, zone_id: &str, record: DnsRecordInput) -> Result<()> {
        let zone_path = if zone_id.starts_with('/') {
            zone_id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/dnsZones/{}",
                DEFAULT_RESOURCE_GROUP, zone_id
            )
        };
        let path = format!("{}/{}/{}", zone_path, record.record_type, record.name);
        self.client.delete(&path, NETWORK_API_VERSION).await
    }
}

// ---------------------------------------------------------------------------
// WafProvider – Azure Application Gateway WAF policies
// ---------------------------------------------------------------------------

#[async_trait]
impl WafProvider for AzureSdkProvider {
    async fn list_web_acls(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies";
        let data = self.client.get(path, NETWORK_API_VERSION).await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter(|v| {
                v["location"]
                    .as_str()
                    .map(|l| l.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|v| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: v["id"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Azure,
                resource_type: ResourceType::WafRule,
                name: v["name"].as_str().unwrap_or_default().to_owned(),
                region: region.to_owned(),
                status: ResourceStatus::Available,
                metadata: v.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn get_web_acl(&self, region: &str, id: &str) -> Result<CloudResource> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        let data = self.client.get(&path, NETWORK_API_VERSION).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::WafRule,
            name: data["name"].as_str().unwrap_or(id).to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Available,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn list_rules(&self, _region: &str, acl_id: &str) -> Result<Vec<CloudResource>> {
        let path = if acl_id.starts_with('/') {
            acl_id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies/{}",
                DEFAULT_RESOURCE_GROUP, acl_id
            )
        };
        let data = self.client.get(&path, NETWORK_API_VERSION).await?;
        // Custom rules are embedded in the policy resource.
        Ok(data["properties"]["customRules"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|r| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: None,
                provider: CloudProvider::Azure,
                resource_type: ResourceType::WafRule,
                name: r["name"].as_str().unwrap_or_default().to_owned(),
                region: String::new(),
                status: ResourceStatus::Available,
                metadata: r.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn create_web_acl(&self, region: &str, name: &str) -> Result<CloudResource> {
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies/{}",
            DEFAULT_RESOURCE_GROUP, name
        );
        let body = serde_json::json!({
            "location": region,
            "properties": {
                "policySettings": {
                    "state": "Enabled",
                    "mode": "Prevention",
                },
                "managedRules": {
                    "managedRuleSets": [{
                        "ruleSetType": "OWASP",
                        "ruleSetVersion": "3.2",
                    }]
                },
                "customRules": [],
            }
        });
        let data = self.client.put(&path, NETWORK_API_VERSION, &body).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::WafRule,
            name: name.to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Creating,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn delete_web_acl(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        self.client.delete(&path, NETWORK_API_VERSION).await
    }
}

// ---------------------------------------------------------------------------
// IamProvider – Azure RBAC role assignments
// ---------------------------------------------------------------------------

#[async_trait]
impl IamProvider for AzureSdkProvider {
    async fn list_users(&self, _region: &str) -> Result<Vec<CloudResource>> {
        // Azure AD users are managed via Microsoft Graph, not ARM.
        // Listing role assignments at the subscription scope as a proxy.
        let path = "/providers/Microsoft.Authorization/roleAssignments";
        let data = self.client.get(path, "2022-04-01").await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|v| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: v["id"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Azure,
                resource_type: ResourceType::IamUser,
                name: v["properties"]["principalId"]
                    .as_str()
                    .unwrap_or_default()
                    .to_owned(),
                region: "global".to_owned(),
                status: ResourceStatus::Available,
                metadata: v.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn create_user(&self, _region: &str, _username: &str) -> Result<CloudResource> {
        Err(CloudError::ProviderError(
            "Azure AD user creation requires Microsoft Graph API, not ARM".into(),
        ))
    }

    async fn delete_user(&self, _region: &str, _username: &str) -> Result<()> {
        Err(CloudError::ProviderError(
            "Azure AD user deletion requires Microsoft Graph API, not ARM".into(),
        ))
    }

    async fn list_roles(&self, _region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.Authorization/roleDefinitions";
        let data = self.client.get(path, "2022-04-01").await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|v| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: v["id"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Azure,
                resource_type: ResourceType::IamRole,
                name: v["properties"]["roleName"]
                    .as_str()
                    .unwrap_or_default()
                    .to_owned(),
                region: "global".to_owned(),
                status: ResourceStatus::Available,
                metadata: v.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn create_role(&self, _region: &str, name: &str, trust_policy: &str) -> Result<CloudResource> {
        let role_id = uuid::Uuid::new_v4();
        let path = format!(
            "/providers/Microsoft.Authorization/roleDefinitions/{}",
            role_id
        );
        let body = serde_json::json!({
            "properties": {
                "roleName": name,
                "description": trust_policy,
                "type": "CustomRole",
                "permissions": [{ "actions": ["*"], "notActions": [] }],
                "assignableScopes": ["/"]
            }
        });
        let data = self.client.put(&path, "2022-04-01", &body).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::IamRole,
            name: name.to_owned(),
            region: "global".to_owned(),
            status: ResourceStatus::Available,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn delete_role(&self, _region: &str, name: &str) -> Result<()> {
        if name.starts_with('/') {
            self.client.delete(name, "2022-04-01").await
        } else {
            Err(CloudError::ProviderError(
                "Azure role deletion requires a full role definition ID".into(),
            ))
        }
    }

    async fn list_policies(&self, _region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.Authorization/policyDefinitions";
        let data = self.client.get(path, "2021-06-01").await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|v| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: v["id"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Azure,
                resource_type: ResourceType::IamPolicy,
                name: v["name"].as_str().unwrap_or_default().to_owned(),
                region: "global".to_owned(),
                status: ResourceStatus::Available,
                metadata: v.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn attach_policy(&self, _region: &str, target: &str, policy_arn: &str) -> Result<()> {
        let assignment_id = uuid::Uuid::new_v4();
        let path = format!(
            "/providers/Microsoft.Authorization/roleAssignments/{}",
            assignment_id
        );
        let body = serde_json::json!({
            "properties": {
                "roleDefinitionId": policy_arn,
                "principalId": target,
            }
        });
        self.client.put(&path, "2022-04-01", &body).await?;
        Ok(())
    }

    async fn detach_policy(&self, _region: &str, _target: &str, policy_arn: &str) -> Result<()> {
        // policy_arn here is expected to be the role assignment ID.
        if policy_arn.starts_with('/') {
            self.client.delete(policy_arn, "2022-04-01").await
        } else {
            Err(CloudError::ProviderError(
                "Azure detach_policy requires the full role assignment resource ID".into(),
            ))
        }
    }
}

// ---------------------------------------------------------------------------
// KmsProvider – Azure Key Vault
// ---------------------------------------------------------------------------

#[async_trait]
impl KmsProvider for AzureSdkProvider {
    async fn list_keys(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.KeyVault/vaults";
        let data = self.client.get(path, MISC_API_VERSION).await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter(|v| {
                v["location"]
                    .as_str()
                    .map(|l| l.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|v| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: v["id"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Azure,
                resource_type: ResourceType::KmsKey,
                name: v["name"].as_str().unwrap_or_default().to_owned(),
                region: region.to_owned(),
                status: ResourceStatus::Available,
                metadata: v.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn get_key(&self, region: &str, id: &str) -> Result<CloudResource> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.KeyVault/vaults/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        let data = self.client.get(&path, MISC_API_VERSION).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::KmsKey,
            name: data["name"].as_str().unwrap_or(id).to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Available,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn create_key(&self, region: &str, name: &str, _key_type: &str) -> Result<CloudResource> {
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.KeyVault/vaults/{}",
            DEFAULT_RESOURCE_GROUP, name
        );
        let body = serde_json::json!({
            "location": region,
            "properties": {
                "sku": { "family": "A", "name": "standard" },
                "tenantId": "00000000-0000-0000-0000-000000000000",
                "accessPolicies": [],
                "enableSoftDelete": true,
                "softDeleteRetentionInDays": 90,
            }
        });
        let data = self.client.put(&path, MISC_API_VERSION, &body).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::KmsKey,
            name: name.to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Creating,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn schedule_key_deletion(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.KeyVault/vaults/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        self.client.delete(&path, MISC_API_VERSION).await
    }

    async fn set_key_enabled(&self, _region: &str, id: &str, enabled: bool) -> Result<()> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.KeyVault/vaults/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        // Read current vault, then update the enabledForDeployment property.
        let current = self.client.get(&path, MISC_API_VERSION).await?;
        let mut body = current.clone();
        body["properties"]["enabledForDeployment"] = serde_json::json!(enabled);
        self.client.put(&path, MISC_API_VERSION, &body).await?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// AutoScalingProvider – Azure VM Scale Sets
// ---------------------------------------------------------------------------

#[async_trait]
impl AutoScalingProvider for AzureSdkProvider {
    async fn list_groups(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.Compute/virtualMachineScaleSets";
        let data = self.client.get(path, VM_API_VERSION).await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter(|v| {
                v["location"]
                    .as_str()
                    .map(|l| l.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|v| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: v["id"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Azure,
                resource_type: ResourceType::AutoScalingGroup,
                name: v["name"].as_str().unwrap_or_default().to_owned(),
                region: region.to_owned(),
                status: ResourceStatus::Available,
                metadata: v.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn get_group(&self, region: &str, id: &str) -> Result<CloudResource> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Compute/virtualMachineScaleSets/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        let data = self.client.get(&path, VM_API_VERSION).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::AutoScalingGroup,
            name: data["name"].as_str().unwrap_or(id).to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Available,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn create_group(
        &self,
        region: &str,
        name: &str,
        min_size: u32,
        max_size: u32,
        desired: u32,
    ) -> Result<CloudResource> {
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.Compute/virtualMachineScaleSets/{}",
            DEFAULT_RESOURCE_GROUP, name
        );
        let body = serde_json::json!({
            "location": region,
            "sku": {
                "name": "Standard_DS1_v2",
                "tier": "Standard",
                "capacity": desired,
            },
            "properties": {
                "upgradePolicy": { "mode": "Automatic" },
                "virtualMachineProfile": {
                    "osProfile": {
                        "computerNamePrefix": name,
                        "adminUsername": "azureuser",
                    },
                    "storageProfile": {
                        "imageReference": {
                            "publisher": "Canonical",
                            "offer": "0001-com-ubuntu-server-jammy",
                            "sku": "22_04-lts",
                            "version": "latest",
                        },
                        "osDisk": {
                            "createOption": "FromImage",
                            "managedDisk": { "storageAccountType": "Standard_LRS" },
                        }
                    },
                    "networkProfile": {
                        "networkInterfaceConfigurations": [],
                    }
                },
                "overprovision": true,
                "scaleInPolicy": {
                    "rules": ["Default"],
                },
            },
            "tags": {
                "min_size": min_size.to_string(),
                "max_size": max_size.to_string(),
            }
        });
        let data = self.client.put(&path, VM_API_VERSION, &body).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::AutoScalingGroup,
            name: name.to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Creating,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn delete_group(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Compute/virtualMachineScaleSets/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        self.client.delete(&path, VM_API_VERSION).await
    }

    async fn set_desired_capacity(&self, _region: &str, id: &str, desired: u32) -> Result<()> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Compute/virtualMachineScaleSets/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        let current = self.client.get(&path, VM_API_VERSION).await?;
        let mut body = current.clone();
        body["sku"]["capacity"] = serde_json::json!(desired);
        self.client.put(&path, VM_API_VERSION, &body).await?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// VolumeProvider – Azure Managed Disks
// ---------------------------------------------------------------------------

#[async_trait]
impl VolumeProvider for AzureSdkProvider {
    async fn list_volumes(&self, region: &str) -> Result<Vec<CloudResource>> {
        let path = "/providers/Microsoft.Compute/disks";
        let data = self.client.get(path, VM_API_VERSION).await?;
        Ok(data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter(|v| {
                v["location"]
                    .as_str()
                    .map(|l| l.eq_ignore_ascii_case(region))
                    .unwrap_or(false)
            })
            .map(|v| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: v["id"].as_str().map(|s| s.to_owned()),
                provider: CloudProvider::Azure,
                resource_type: ResourceType::Volume,
                name: v["name"].as_str().unwrap_or_default().to_owned(),
                region: region.to_owned(),
                status: ResourceStatus::Available,
                metadata: v.clone(),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn create_volume(&self, region: &str, size_gb: i32, volume_type: &str, az: &str) -> Result<CloudResource> {
        let name = format!("disk-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("x"));
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.Compute/disks/{}",
            DEFAULT_RESOURCE_GROUP, name
        );
        let sku_name = match volume_type {
            "ssd" | "Premium_LRS" => "Premium_LRS",
            "standard" | "Standard_LRS" => "Standard_LRS",
            _ => "StandardSSD_LRS",
        };
        let body = serde_json::json!({
            "location": region,
            "zones": [az],
            "sku": { "name": sku_name },
            "properties": {
                "creationData": { "createOption": "Empty" },
                "diskSizeGB": size_gb,
            }
        });
        let data = self.client.put(&path, VM_API_VERSION, &body).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::Volume,
            name,
            region: region.to_owned(),
            status: ResourceStatus::Creating,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn attach_volume(&self, _region: &str, volume_id: &str, instance_id: &str, _device: &str) -> Result<()> {
        // Attaching a disk to a VM requires updating the VM's storageProfile.
        let vm_path = if instance_id.starts_with('/') {
            instance_id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Compute/virtualMachines/{}",
                DEFAULT_RESOURCE_GROUP, instance_id
            )
        };
        let vm_data = self.client.get(&vm_path, VM_API_VERSION).await?;
        let mut body = vm_data.clone();
        let disk_id = if volume_id.starts_with('/') {
            volume_id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Compute/disks/{}",
                DEFAULT_RESOURCE_GROUP, volume_id
            )
        };
        let new_disk = serde_json::json!({
            "lun": 0,
            "createOption": "Attach",
            "managedDisk": { "id": disk_id }
        });
        if let Some(disks) = body["properties"]["storageProfile"]["dataDisks"].as_array_mut() {
            disks.push(new_disk);
        } else {
            body["properties"]["storageProfile"]["dataDisks"] = serde_json::json!([new_disk]);
        }
        self.client.put(&vm_path, VM_API_VERSION, &body).await?;
        Ok(())
    }

    async fn detach_volume(&self, _region: &str, volume_id: &str) -> Result<()> {
        // Full detach requires knowing the VM — this is a best-effort stub.
        let _ = volume_id;
        Err(CloudError::ProviderError(
            "Azure disk detach requires the VM resource ID; use the full resource path".into(),
        ))
    }

    async fn delete_volume(&self, _region: &str, id: &str) -> Result<()> {
        let path = if id.starts_with('/') {
            id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Compute/disks/{}",
                DEFAULT_RESOURCE_GROUP, id
            )
        };
        self.client.delete(&path, VM_API_VERSION).await
    }

    async fn create_volume_snapshot(&self, _region: &str, volume_id: &str, name: &str) -> Result<CloudResource> {
        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.Compute/snapshots/{}",
            DEFAULT_RESOURCE_GROUP, name
        );
        let disk_id = if volume_id.starts_with('/') {
            volume_id.to_owned()
        } else {
            format!(
                "/resourceGroups/{}/providers/Microsoft.Compute/disks/{}",
                DEFAULT_RESOURCE_GROUP, volume_id
            )
        };
        let body = serde_json::json!({
            "location": "eastus",
            "properties": {
                "creationData": {
                    "createOption": "Copy",
                    "sourceResourceId": disk_id,
                }
            }
        });
        let data = self.client.put(&path, VM_API_VERSION, &body).await?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: data["id"].as_str().map(|s| s.to_owned()),
            provider: CloudProvider::Azure,
            resource_type: ResourceType::Snapshot,
            name: name.to_owned(),
            region: "eastus".to_owned(),
            status: ResourceStatus::Creating,
            metadata: data,
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }
}

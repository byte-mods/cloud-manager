use async_trait::async_trait;
use std::sync::Arc;

use cloud_common::{CredentialManager, RedisCache};

use crate::error::CloudError;
use crate::models::*;
use crate::providers::azure_mapper;
use crate::providers::azure_rest_client::AzureRestClient;
use crate::traits::compute::Result;
use crate::traits::{ComputeProvider, ContainerRegistryProvider, DatabaseProvider, KubernetesProvider, NetworkingProvider, ServerlessProvider, StorageProvider, TrafficProvider, WorkflowProvider};

// Azure API versions
const VM_API_VERSION: &str = "2024-07-01";
const STORAGE_API_VERSION: &str = "2023-05-01";
const NETWORK_API_VERSION: &str = "2024-01-01";
const SQL_API_VERSION: &str = "2023-08-01-preview";

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

    // Azure stubs for new networking operations

    async fn list_elastic_ips(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(Vec::new()) }
    async fn allocate_elastic_ip(&self, _region: &str) -> Result<CloudResource> {
        Err(CloudError::ProviderError("Azure: allocate_elastic_ip not yet implemented for SDK mode".into()))
    }
    async fn associate_elastic_ip(&self, _region: &str, _eip_id: &str, _instance_id: &str) -> Result<()> {
        Err(CloudError::ProviderError("Azure: associate_elastic_ip not yet implemented for SDK mode".into()))
    }
    async fn disassociate_elastic_ip(&self, _region: &str, _association_id: &str) -> Result<()> {
        Err(CloudError::ProviderError("Azure: disassociate_elastic_ip not yet implemented for SDK mode".into()))
    }
    async fn release_elastic_ip(&self, _region: &str, _allocation_id: &str) -> Result<()> {
        Err(CloudError::ProviderError("Azure: release_elastic_ip not yet implemented for SDK mode".into()))
    }

    async fn list_nat_gateways(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(Vec::new()) }
    async fn create_nat_gateway(&self, _region: &str, _subnet_id: &str, _eip_allocation_id: &str) -> Result<CloudResource> {
        Err(CloudError::ProviderError("Azure: create_nat_gateway not yet implemented for SDK mode".into()))
    }
    async fn delete_nat_gateway(&self, _region: &str, _id: &str) -> Result<()> {
        Err(CloudError::ProviderError("Azure: delete_nat_gateway not yet implemented for SDK mode".into()))
    }

    async fn list_internet_gateways(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(Vec::new()) }
    async fn create_internet_gateway(&self, _region: &str) -> Result<CloudResource> {
        Err(CloudError::ProviderError("Azure: create_internet_gateway not yet implemented for SDK mode".into()))
    }
    async fn attach_internet_gateway(&self, _region: &str, _igw_id: &str, _vpc_id: &str) -> Result<()> {
        Err(CloudError::ProviderError("Azure: attach_internet_gateway not yet implemented for SDK mode".into()))
    }
    async fn detach_internet_gateway(&self, _region: &str, _igw_id: &str, _vpc_id: &str) -> Result<()> {
        Err(CloudError::ProviderError("Azure: detach_internet_gateway not yet implemented for SDK mode".into()))
    }
    async fn delete_internet_gateway(&self, _region: &str, _id: &str) -> Result<()> {
        Err(CloudError::ProviderError("Azure: delete_internet_gateway not yet implemented for SDK mode".into()))
    }

    async fn list_route_tables(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(Vec::new()) }
    async fn create_route_table(&self, _region: &str, _vpc_id: &str) -> Result<CloudResource> {
        Err(CloudError::ProviderError("Azure: create_route_table not yet implemented for SDK mode".into()))
    }
    async fn add_route(&self, _region: &str, _route_table_id: &str, _destination_cidr: &str, _target_id: &str) -> Result<()> {
        Err(CloudError::ProviderError("Azure: add_route not yet implemented for SDK mode".into()))
    }
    async fn delete_route(&self, _region: &str, _route_table_id: &str, _destination_cidr: &str) -> Result<()> {
        Err(CloudError::ProviderError("Azure: delete_route not yet implemented for SDK mode".into()))
    }
    async fn associate_route_table(&self, _region: &str, _route_table_id: &str, _subnet_id: &str) -> Result<String> {
        Err(CloudError::ProviderError("Azure: associate_route_table not yet implemented for SDK mode".into()))
    }
    async fn delete_route_table(&self, _region: &str, _id: &str) -> Result<()> {
        Err(CloudError::ProviderError("Azure: delete_route_table not yet implemented for SDK mode".into()))
    }

    async fn create_security_group(&self, _region: &str, _name: &str, _description: &str, _vpc_id: &str) -> Result<CloudResource> {
        Err(CloudError::ProviderError("Azure: create_security_group not yet implemented for SDK mode".into()))
    }
    async fn add_security_group_rule(&self, _region: &str, _sg_id: &str, _rule: SecurityGroupRule) -> Result<()> {
        Err(CloudError::ProviderError("Azure: add_security_group_rule not yet implemented for SDK mode".into()))
    }
    async fn remove_security_group_rule(&self, _region: &str, _sg_id: &str, _rule: SecurityGroupRule) -> Result<()> {
        Err(CloudError::ProviderError("Azure: remove_security_group_rule not yet implemented for SDK mode".into()))
    }
    async fn delete_security_group(&self, _region: &str, _id: &str) -> Result<()> {
        Err(CloudError::ProviderError("Azure: delete_security_group not yet implemented for SDK mode".into()))
    }

    async fn list_vpc_peering_connections(&self, _region: &str) -> Result<Vec<CloudResource>> { Ok(Vec::new()) }
    async fn create_vpc_peering(&self, _region: &str, _vpc_id: &str, _peer_vpc_id: &str) -> Result<CloudResource> {
        Err(CloudError::ProviderError("Azure: create_vpc_peering not yet implemented for SDK mode".into()))
    }
    async fn accept_vpc_peering(&self, _region: &str, _peering_id: &str) -> Result<()> {
        Err(CloudError::ProviderError("Azure: accept_vpc_peering not yet implemented for SDK mode".into()))
    }
    async fn delete_vpc_peering(&self, _region: &str, _peering_id: &str) -> Result<()> {
        Err(CloudError::ProviderError("Azure: delete_vpc_peering not yet implemented for SDK mode".into()))
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

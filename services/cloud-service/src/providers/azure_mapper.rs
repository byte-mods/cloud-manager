use chrono::Utc;
use std::collections::HashMap;
use uuid::Uuid;

use crate::models::{CloudProvider, CloudResource, ResourceStatus, ResourceType};

/// Extract the resource group from an Azure resource ID string.
/// Azure IDs look like: /subscriptions/.../resourceGroups/myRg/providers/...
fn extract_resource_group(id: &str) -> &str {
    let parts: Vec<&str> = id.split('/').collect();
    for (i, part) in parts.iter().enumerate() {
        if part.eq_ignore_ascii_case("resourceGroups") || part.eq_ignore_ascii_case("resourcegroups") {
            if let Some(rg) = parts.get(i + 1) {
                return rg;
            }
        }
    }
    "default-rg"
}

/// Map Azure provisioning / power state strings to ResourceStatus.
fn map_vm_status(provisioning_state: &str, power_state: Option<&str>) -> ResourceStatus {
    // Power state takes priority when present (e.g. from instance view).
    if let Some(ps) = power_state {
        return match ps {
            "PowerState/running" => ResourceStatus::Running,
            "PowerState/stopped" | "PowerState/deallocated" | "PowerState/deallocating" => {
                ResourceStatus::Stopped
            }
            "PowerState/starting" => ResourceStatus::Creating,
            _ => ResourceStatus::Pending,
        };
    }
    match provisioning_state {
        "Succeeded" => ResourceStatus::Running,
        "Creating" => ResourceStatus::Creating,
        "Updating" => ResourceStatus::Updating,
        "Deleting" => ResourceStatus::Deleting,
        "Failed" => ResourceStatus::Error,
        "Stopped" | "Deallocated" => ResourceStatus::Stopped,
        _ => ResourceStatus::Pending,
    }
}

/// Map a generic Azure provisioning state to ResourceStatus.
fn map_provisioning_status(state: &str) -> ResourceStatus {
    match state {
        "Succeeded" => ResourceStatus::Available,
        "Creating" => ResourceStatus::Creating,
        "Updating" => ResourceStatus::Updating,
        "Deleting" => ResourceStatus::Deleting,
        "Failed" => ResourceStatus::Error,
        _ => ResourceStatus::Pending,
    }
}

/// Convert an Azure Virtual Machine JSON to CloudResource.
pub fn vm_to_resource(vm: &serde_json::Value, region: &str) -> CloudResource {
    let name = vm["name"].as_str().unwrap_or_default().to_owned();
    let vm_id = vm["id"].as_str().unwrap_or_default().to_owned();
    let resource_group = extract_resource_group(&vm_id).to_owned();

    let provisioning_state = vm["properties"]["provisioningState"]
        .as_str()
        .unwrap_or("");

    // Try to pick up power state from instanceView.statuses if present.
    let power_state = vm["properties"]["instanceView"]["statuses"]
        .as_array()
        .and_then(|statuses| {
            statuses.iter().find_map(|s| {
                s["code"]
                    .as_str()
                    .filter(|c| c.starts_with("PowerState/"))
            })
        });

    let status = map_vm_status(provisioning_state, power_state);

    let vm_size = vm["properties"]["hardwareProfile"]["vmSize"]
        .as_str()
        .unwrap_or("unknown");

    let network_interfaces = vm["properties"]["networkProfile"]["networkInterfaces"].as_array();
    let primary_nic_id = network_interfaces
        .and_then(|nics| nics.first())
        .and_then(|nic| nic["id"].as_str())
        .unwrap_or_default();

    let os_disk = &vm["properties"]["storageProfile"]["osDisk"];
    let image_ref = &vm["properties"]["storageProfile"]["imageReference"];

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(vm_id),
        provider: CloudProvider::Azure,
        resource_type: ResourceType::Instance,
        name,
        region: region.to_owned(),
        status,
        metadata: serde_json::json!({
            "vm_size": vm_size,
            "resource_group": resource_group,
            "os_type": os_disk["osType"].as_str().unwrap_or("Linux"),
            "os_disk_size_gb": os_disk["diskSizeGB"].as_u64().unwrap_or(0),
            "image_publisher": image_ref["publisher"].as_str().unwrap_or_default(),
            "image_offer": image_ref["offer"].as_str().unwrap_or_default(),
            "image_sku": image_ref["sku"].as_str().unwrap_or_default(),
            "primary_nic_id": primary_nic_id,
        }),
        tags: extract_tags(vm),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Convert an Azure Storage Account JSON to CloudResource.
pub fn storage_account_to_resource(sa: &serde_json::Value, region: &str) -> CloudResource {
    let name = sa["name"].as_str().unwrap_or_default().to_owned();
    let sa_id = sa["id"].as_str().unwrap_or_default().to_owned();

    let status = map_provisioning_status(
        sa["properties"]["provisioningState"]
            .as_str()
            .unwrap_or(""),
    );

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(sa_id),
        provider: CloudProvider::Azure,
        resource_type: ResourceType::Bucket,
        name,
        region: region.to_owned(),
        status,
        metadata: serde_json::json!({
            "kind": sa["kind"].as_str().unwrap_or("StorageV2"),
            "sku": sa["sku"]["name"].as_str().unwrap_or("Standard_LRS"),
            "access_tier": sa["properties"]["accessTier"].as_str().unwrap_or("Hot"),
            "https_only": sa["properties"]["supportsHttpsTrafficOnly"].as_bool().unwrap_or(true),
            "primary_endpoint": sa["properties"]["primaryEndpoints"]["blob"].as_str().unwrap_or_default(),
        }),
        tags: extract_tags(sa),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Convert an Azure Virtual Network JSON to CloudResource.
pub fn vnet_to_resource(vnet: &serde_json::Value, region: &str) -> CloudResource {
    let name = vnet["name"].as_str().unwrap_or_default().to_owned();
    let vnet_id = vnet["id"].as_str().unwrap_or_default().to_owned();

    let status = map_provisioning_status(
        vnet["properties"]["provisioningState"]
            .as_str()
            .unwrap_or(""),
    );

    let address_prefixes = vnet["properties"]["addressSpace"]["addressPrefixes"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        })
        .unwrap_or_default();

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(vnet_id),
        provider: CloudProvider::Azure,
        resource_type: ResourceType::Vpc,
        name,
        region: region.to_owned(),
        status,
        metadata: serde_json::json!({
            "address_prefixes": address_prefixes,
            "enable_ddos_protection": vnet["properties"]["enableDdosProtection"].as_bool().unwrap_or(false),
            "enable_vm_protection": vnet["properties"]["enableVmProtection"].as_bool().unwrap_or(false),
            "subnet_count": vnet["properties"]["subnets"].as_array().map(|s| s.len()).unwrap_or(0),
        }),
        tags: extract_tags(vnet),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Convert an Azure Subnet JSON to CloudResource.
pub fn subnet_to_resource(subnet: &serde_json::Value, region: &str) -> CloudResource {
    let name = subnet["name"].as_str().unwrap_or_default().to_owned();
    let subnet_id = subnet["id"].as_str().unwrap_or_default().to_owned();

    let status = map_provisioning_status(
        subnet["properties"]["provisioningState"]
            .as_str()
            .unwrap_or(""),
    );

    // Extract the parent VNet name from the subnet ID.
    let vnet_name = subnet_id
        .split("/virtualNetworks/")
        .nth(1)
        .and_then(|s| s.split('/').next())
        .unwrap_or_default()
        .to_owned();

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(subnet_id),
        provider: CloudProvider::Azure,
        resource_type: ResourceType::Subnet,
        name,
        region: region.to_owned(),
        status,
        metadata: serde_json::json!({
            "cidr_block": subnet["properties"]["addressPrefix"].as_str().unwrap_or_default(),
            "vnet": vnet_name,
            "nsg_id": subnet["properties"]["networkSecurityGroup"]["id"].as_str().unwrap_or_default(),
            "private_endpoint_network_policies": subnet["properties"]["privateEndpointNetworkPolicies"].as_str().unwrap_or("Disabled"),
        }),
        tags: HashMap::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Convert an Azure SQL Database JSON to CloudResource.
pub fn sql_database_to_resource(db: &serde_json::Value, region: &str) -> CloudResource {
    let name = db["name"].as_str().unwrap_or_default().to_owned();
    let db_id = db["id"].as_str().unwrap_or_default().to_owned();

    let status = match db["properties"]["status"].as_str().unwrap_or("") {
        "Online" => ResourceStatus::Available,
        "Creating" => ResourceStatus::Creating,
        "Paused" | "Pausing" => ResourceStatus::Stopped,
        "Resuming" | "Scaling" => ResourceStatus::Updating,
        "Disabled" | "Offline" => ResourceStatus::Error,
        _ => ResourceStatus::Pending,
    };

    // Extract the server name from the database ID.
    let server_name = db_id
        .split("/servers/")
        .nth(1)
        .and_then(|s| s.split('/').next())
        .unwrap_or_default()
        .to_owned();

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(db_id),
        provider: CloudProvider::Azure,
        resource_type: ResourceType::Database,
        name,
        region: region.to_owned(),
        status,
        metadata: serde_json::json!({
            "engine": "Azure SQL",
            "server_name": server_name,
            "sku_name": db["sku"]["name"].as_str().unwrap_or_default(),
            "sku_tier": db["sku"]["tier"].as_str().unwrap_or_default(),
            "max_size_bytes": db["properties"]["maxSizeBytes"].as_u64().unwrap_or(0),
            "collation": db["properties"]["collation"].as_str().unwrap_or("SQL_Latin1_General_CP1_CI_AS"),
            "endpoint": format!("{}.database.windows.net", server_name),
        }),
        tags: extract_tags(db),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Convert an Azure Load Balancer JSON to CloudResource.
pub fn load_balancer_to_resource(lb: &serde_json::Value, region: &str) -> CloudResource {
    let name = lb["name"].as_str().unwrap_or_default().to_owned();
    let lb_id = lb["id"].as_str().unwrap_or_default().to_owned();

    let status = map_provisioning_status(
        lb["properties"]["provisioningState"]
            .as_str()
            .unwrap_or(""),
    );

    let frontend_count = lb["properties"]["frontendIPConfigurations"]
        .as_array()
        .map(|a| a.len())
        .unwrap_or(0);

    let backend_pool_count = lb["properties"]["backendAddressPools"]
        .as_array()
        .map(|a| a.len())
        .unwrap_or(0);

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(lb_id),
        provider: CloudProvider::Azure,
        resource_type: ResourceType::LoadBalancer,
        name,
        region: region.to_owned(),
        status,
        metadata: serde_json::json!({
            "sku": lb["sku"]["name"].as_str().unwrap_or("Basic"),
            "sku_tier": lb["sku"]["tier"].as_str().unwrap_or("Regional"),
            "frontend_ip_count": frontend_count,
            "backend_pool_count": backend_pool_count,
            "load_balancing_rules": lb["properties"]["loadBalancingRules"].as_array().map(|a| a.len()).unwrap_or(0),
        }),
        tags: extract_tags(lb),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Convert an Azure Network Security Group JSON to CloudResource.
pub fn nsg_to_resource(nsg: &serde_json::Value, region: &str) -> CloudResource {
    let name = nsg["name"].as_str().unwrap_or_default().to_owned();
    let nsg_id = nsg["id"].as_str().unwrap_or_default().to_owned();

    let status = map_provisioning_status(
        nsg["properties"]["provisioningState"]
            .as_str()
            .unwrap_or(""),
    );

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(nsg_id),
        provider: CloudProvider::Azure,
        resource_type: ResourceType::SecurityGroup,
        name,
        region: region.to_owned(),
        status,
        metadata: serde_json::json!({
            "security_rules": nsg["properties"]["securityRules"].as_array().map(|a| a.len()).unwrap_or(0),
            "default_security_rules": nsg["properties"]["defaultSecurityRules"].as_array().map(|a| a.len()).unwrap_or(0),
            "network_interfaces": nsg["properties"]["networkInterfaces"].as_array().map(|a| a.len()).unwrap_or(0),
            "subnets": nsg["properties"]["subnets"].as_array().map(|a| a.len()).unwrap_or(0),
        }),
        tags: extract_tags(nsg),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

pub fn public_ip_to_resource(pip: &serde_json::Value, region: &str) -> CloudResource {
    let name = pip["name"].as_str().unwrap_or_default().to_owned();
    let pip_id = pip["id"].as_str().unwrap_or_default().to_owned();
    let status = map_provisioning_status(
        pip["properties"]["provisioningState"].as_str().unwrap_or(""),
    );

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(pip_id),
        provider: CloudProvider::Azure,
        resource_type: ResourceType::ElasticIp,
        name,
        region: region.to_owned(),
        status,
        metadata: serde_json::json!({
            "ip_address": pip["properties"]["ipAddress"].as_str().unwrap_or_default(),
            "allocation_method": pip["properties"]["publicIPAllocationMethod"].as_str().unwrap_or("Static"),
            "sku": pip["sku"]["name"].as_str().unwrap_or("Standard"),
            "ip_version": pip["properties"]["publicIPAddressVersion"].as_str().unwrap_or("IPv4"),
            "associated_nic": pip["properties"]["ipConfiguration"]["id"].as_str().unwrap_or_default(),
        }),
        tags: extract_tags(pip),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

pub fn nat_gateway_to_resource(nat: &serde_json::Value, region: &str) -> CloudResource {
    let name = nat["name"].as_str().unwrap_or_default().to_owned();
    let nat_id = nat["id"].as_str().unwrap_or_default().to_owned();
    let status = map_provisioning_status(
        nat["properties"]["provisioningState"].as_str().unwrap_or(""),
    );

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(nat_id),
        provider: CloudProvider::Azure,
        resource_type: ResourceType::NatGateway,
        name,
        region: region.to_owned(),
        status,
        metadata: serde_json::json!({
            "idle_timeout_minutes": nat["properties"]["idleTimeoutInMinutes"].as_u64().unwrap_or(4),
            "sku": nat["sku"]["name"].as_str().unwrap_or("Standard"),
            "public_ip_addresses": nat["properties"]["publicIpAddresses"].as_array().map(|a| a.len()).unwrap_or(0),
            "subnets": nat["properties"]["subnets"].as_array().map(|a| a.len()).unwrap_or(0),
        }),
        tags: extract_tags(nat),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

pub fn route_table_to_resource(rt: &serde_json::Value, region: &str) -> CloudResource {
    let name = rt["name"].as_str().unwrap_or_default().to_owned();
    let rt_id = rt["id"].as_str().unwrap_or_default().to_owned();
    let status = map_provisioning_status(
        rt["properties"]["provisioningState"].as_str().unwrap_or(""),
    );

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(rt_id),
        provider: CloudProvider::Azure,
        resource_type: ResourceType::RouteTable,
        name,
        region: region.to_owned(),
        status,
        metadata: serde_json::json!({
            "routes": rt["properties"]["routes"].as_array().map(|a| a.len()).unwrap_or(0),
            "subnets": rt["properties"]["subnets"].as_array().map(|a| a.len()).unwrap_or(0),
            "disable_bgp_route_propagation": rt["properties"]["disableBgpRoutePropagation"].as_bool().unwrap_or(false),
        }),
        tags: extract_tags(rt),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

pub fn vnet_peering_to_resource(peering: &serde_json::Value, region: &str) -> CloudResource {
    let name = peering["name"].as_str().unwrap_or_default().to_owned();
    let peering_id = peering["id"].as_str().unwrap_or_default().to_owned();
    let state = peering["properties"]["peeringState"].as_str().unwrap_or("Disconnected");
    let status = match state {
        "Connected" => ResourceStatus::Available,
        "Initiated" => ResourceStatus::Pending,
        _ => ResourceStatus::Pending,
    };

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(peering_id),
        provider: CloudProvider::Azure,
        resource_type: ResourceType::VpcPeering,
        name,
        region: region.to_owned(),
        status,
        metadata: serde_json::json!({
            "peering_state": state,
            "remote_virtual_network": peering["properties"]["remoteVirtualNetwork"]["id"].as_str().unwrap_or_default(),
            "allow_virtual_network_access": peering["properties"]["allowVirtualNetworkAccess"].as_bool().unwrap_or(true),
            "allow_forwarded_traffic": peering["properties"]["allowForwardedTraffic"].as_bool().unwrap_or(false),
            "allow_gateway_transit": peering["properties"]["allowGatewayTransit"].as_bool().unwrap_or(false),
            "use_remote_gateways": peering["properties"]["useRemoteGateways"].as_bool().unwrap_or(false),
        }),
        tags: HashMap::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

fn extract_tags(json: &serde_json::Value) -> HashMap<String, String> {
    json["tags"]
        .as_object()
        .map(|obj| {
            obj.iter()
                .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_owned())))
                .collect()
        })
        .unwrap_or_default()
}

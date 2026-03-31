use chrono::Utc;
use std::collections::HashMap;
use uuid::Uuid;

use crate::models::{CloudProvider, CloudResource, ResourceStatus, ResourceType};

/// Convert a GCP Compute Engine instance JSON to CloudResource.
pub fn gce_instance_to_resource(instance: &serde_json::Value, region: &str) -> CloudResource {
    let name = instance["name"].as_str().unwrap_or_default().to_owned();
    let instance_id = instance["id"].as_str().unwrap_or_default().to_owned();

    let status = match instance["status"].as_str().unwrap_or("") {
        "RUNNING" => ResourceStatus::Running,
        "STOPPED" | "TERMINATED" => ResourceStatus::Stopped,
        "STAGING" | "PROVISIONING" => ResourceStatus::Creating,
        "STOPPING" | "SUSPENDING" => ResourceStatus::Updating,
        _ => ResourceStatus::Pending,
    };

    let machine_type = instance["machineType"]
        .as_str()
        .and_then(|s| s.rsplit('/').next())
        .unwrap_or("unknown");

    let network_interfaces = instance["networkInterfaces"].as_array();
    let private_ip = network_interfaces
        .and_then(|nis| nis.first())
        .and_then(|ni| ni["networkIP"].as_str())
        .unwrap_or_default();
    let public_ip = network_interfaces
        .and_then(|nis| nis.first())
        .and_then(|ni| ni["accessConfigs"].as_array())
        .and_then(|acs| acs.first())
        .and_then(|ac| ac["natIP"].as_str())
        .unwrap_or_default();

    let zone = instance["zone"]
        .as_str()
        .and_then(|s| s.rsplit('/').next())
        .unwrap_or_default();

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(instance_id),
        provider: CloudProvider::Gcp,
        resource_type: ResourceType::Instance,
        name,
        region: region.to_owned(),
        status,
        metadata: serde_json::json!({
            "machine_type": machine_type,
            "zone": zone,
            "private_ip": private_ip,
            "public_ip": public_ip,
            "disk_size_gb": instance["disks"].as_array().and_then(|d| d.first()).and_then(|d| d["diskSizeGb"].as_str()),
            "image": instance["disks"].as_array().and_then(|d| d.first()).and_then(|d| d["source"].as_str()),
        }),
        tags: extract_labels(instance),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Convert a GCS bucket JSON to CloudResource.
pub fn gcs_bucket_to_resource(bucket: &serde_json::Value, region: &str) -> CloudResource {
    let name = bucket["name"].as_str().unwrap_or_default().to_owned();

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(name.clone()),
        provider: CloudProvider::Gcp,
        resource_type: ResourceType::Bucket,
        name,
        region: region.to_owned(),
        status: ResourceStatus::Available,
        metadata: serde_json::json!({
            "storage_class": bucket["storageClass"].as_str().unwrap_or("STANDARD"),
            "location": bucket["location"].as_str().unwrap_or_default(),
            "versioning": bucket["versioning"]["enabled"].as_bool().unwrap_or(false),
        }),
        tags: extract_labels(bucket),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Convert a GCP VPC network JSON to CloudResource.
pub fn vpc_network_to_resource(network: &serde_json::Value, region: &str) -> CloudResource {
    let name = network["name"].as_str().unwrap_or_default().to_owned();
    let network_id = network["id"].as_str().unwrap_or_default().to_owned();

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(network_id),
        provider: CloudProvider::Gcp,
        resource_type: ResourceType::Vpc,
        name,
        region: region.to_owned(),
        status: ResourceStatus::Available,
        metadata: serde_json::json!({
            "auto_create_subnetworks": network["autoCreateSubnetworks"].as_bool().unwrap_or(false),
            "routing_mode": network["routingConfig"]["routingMode"].as_str().unwrap_or("REGIONAL"),
            "mtu": network["mtu"].as_u64().unwrap_or(1460),
        }),
        tags: HashMap::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Convert a GCP subnetwork JSON to CloudResource.
pub fn subnetwork_to_resource(subnet: &serde_json::Value, region: &str) -> CloudResource {
    let name = subnet["name"].as_str().unwrap_or_default().to_owned();
    let subnet_id = subnet["id"].as_str().unwrap_or_default().to_owned();

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(subnet_id),
        provider: CloudProvider::Gcp,
        resource_type: ResourceType::Subnet,
        name,
        region: region.to_owned(),
        status: ResourceStatus::Available,
        metadata: serde_json::json!({
            "cidr_block": subnet["ipCidrRange"].as_str().unwrap_or_default(),
            "network": subnet["network"].as_str().and_then(|s| s.rsplit('/').next()),
            "private_ip_google_access": subnet["privateIpGoogleAccess"].as_bool().unwrap_or(false),
        }),
        tags: HashMap::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Convert a GCP Cloud SQL instance JSON to CloudResource.
pub fn cloudsql_to_resource(db: &serde_json::Value, region: &str) -> CloudResource {
    let name = db["name"].as_str().unwrap_or_default().to_owned();

    let status = match db["state"].as_str().unwrap_or("") {
        "RUNNABLE" => ResourceStatus::Available,
        "PENDING_CREATE" => ResourceStatus::Creating,
        "MAINTENANCE" => ResourceStatus::Updating,
        "SUSPENDED" => ResourceStatus::Stopped,
        _ => ResourceStatus::Pending,
    };

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(name.clone()),
        provider: CloudProvider::Gcp,
        resource_type: ResourceType::Database,
        name,
        region: region.to_owned(),
        status,
        metadata: serde_json::json!({
            "engine": db["databaseVersion"].as_str().unwrap_or_default(),
            "instance_class": db["settings"]["tier"].as_str().unwrap_or_default(),
            "storage_gb": db["settings"]["dataDiskSizeGb"].as_str().unwrap_or("0"),
            "backup_enabled": db["settings"]["backupConfiguration"]["enabled"].as_bool().unwrap_or(false),
            "endpoint": format!("{}:{}", db["ipAddresses"].as_array().and_then(|a| a.first()).and_then(|i| i["ipAddress"].as_str()).unwrap_or(""), 5432),
        }),
        tags: extract_labels(db),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Convert a GCP forwarding rule JSON to CloudResource (load balancer).
pub fn forwarding_rule_to_resource(rule: &serde_json::Value, region: &str) -> CloudResource {
    let name = rule["name"].as_str().unwrap_or_default().to_owned();
    let rule_id = rule["id"].as_str().unwrap_or_default().to_owned();

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(rule_id),
        provider: CloudProvider::Gcp,
        resource_type: ResourceType::LoadBalancer,
        name,
        region: region.to_owned(),
        status: ResourceStatus::Running,
        metadata: serde_json::json!({
            "ip_address": rule["IPAddress"].as_str().unwrap_or_default(),
            "ip_protocol": rule["IPProtocol"].as_str().unwrap_or_default(),
            "port_range": rule["portRange"].as_str().unwrap_or_default(),
            "load_balancing_scheme": rule["loadBalancingScheme"].as_str().unwrap_or("EXTERNAL"),
            "target": rule["target"].as_str().and_then(|s| s.rsplit('/').next()),
        }),
        tags: HashMap::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Convert a GCP firewall rule JSON to CloudResource (as SecurityGroup equivalent).
pub fn firewall_to_resource(fw: &serde_json::Value, region: &str) -> CloudResource {
    let name = fw["name"].as_str().unwrap_or_default().to_owned();
    let fw_id = fw["id"].as_str().unwrap_or_default().to_owned();

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(fw_id),
        provider: CloudProvider::Gcp,
        resource_type: ResourceType::SecurityGroup,
        name,
        region: region.to_owned(),
        status: ResourceStatus::Available,
        metadata: serde_json::json!({
            "direction": fw["direction"].as_str().unwrap_or("INGRESS"),
            "priority": fw["priority"].as_u64().unwrap_or(1000),
            "network": fw["network"].as_str().and_then(|s| s.rsplit('/').next()),
            "allowed": fw["allowed"],
            "source_ranges": fw["sourceRanges"],
        }),
        tags: HashMap::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

fn extract_labels(json: &serde_json::Value) -> HashMap<String, String> {
    json["labels"]
        .as_object()
        .map(|obj| {
            obj.iter()
                .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_owned())))
                .collect()
        })
        .unwrap_or_default()
}

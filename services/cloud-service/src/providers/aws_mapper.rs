use chrono::{DateTime, Utc};
use std::collections::HashMap;
use uuid::Uuid;

use crate::models::{CloudProvider, CloudResource, ResourceStatus, ResourceType};

/// Convert an EC2 Instance from the AWS SDK into our CloudResource model.
pub fn ec2_instance_to_resource(
    instance: &aws_sdk_ec2::types::Instance,
    region: &str,
) -> CloudResource {
    let instance_id = instance.instance_id().unwrap_or_default();
    let name = instance
        .tags()
        .iter()
        .find(|t| t.key() == Some("Name"))
        .and_then(|t| t.value())
        .unwrap_or(instance_id)
        .to_owned();

    let status = match instance.state().and_then(|s| s.name()) {
        Some(aws_sdk_ec2::types::InstanceStateName::Running) => ResourceStatus::Running,
        Some(aws_sdk_ec2::types::InstanceStateName::Stopped) => ResourceStatus::Stopped,
        Some(aws_sdk_ec2::types::InstanceStateName::Terminated) => ResourceStatus::Terminated,
        Some(aws_sdk_ec2::types::InstanceStateName::Pending) => ResourceStatus::Pending,
        Some(aws_sdk_ec2::types::InstanceStateName::ShuttingDown) => ResourceStatus::Deleting,
        Some(aws_sdk_ec2::types::InstanceStateName::Stopping) => ResourceStatus::Updating,
        _ => ResourceStatus::Pending,
    };

    let security_group_ids: Vec<String> = instance
        .security_groups()
        .iter()
        .filter_map(|sg| sg.group_id().map(|s| s.to_owned()))
        .collect();

    let metadata = serde_json::json!({
        "instance_type": instance.instance_type().map(|t| t.as_str()).unwrap_or("unknown"),
        "image_id": instance.image_id().unwrap_or_default(),
        "private_ip": instance.private_ip_address().unwrap_or_default(),
        "public_ip": instance.public_ip_address().unwrap_or_default(),
        "vpc_id": instance.vpc_id().unwrap_or_default(),
        "subnet_id": instance.subnet_id().unwrap_or_default(),
        "security_group_ids": security_group_ids,
        "key_pair": instance.key_name().unwrap_or_default(),
        "architecture": instance.architecture().map(|a| a.as_str()).unwrap_or("unknown"),
        "platform": instance.platform_details().unwrap_or("Linux/UNIX"),
        "launch_time": instance.launch_time().map(|t| t.to_string()).unwrap_or_default(),
    });

    let tags = extract_tags(instance.tags());

    let launch_time = instance
        .launch_time()
        .and_then(|t| DateTime::parse_from_rfc3339(&t.to_string()).ok())
        .map(|t| t.with_timezone(&Utc))
        .unwrap_or_else(Utc::now);

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(instance_id.to_owned()),
        provider: CloudProvider::Aws,
        resource_type: ResourceType::Instance,
        name,
        region: region.to_owned(),
        status,
        metadata,
        tags,
        created_at: launch_time,
        updated_at: Utc::now(),
    }
}

/// Convert an S3 Bucket from the AWS SDK into our CloudResource model.
pub fn s3_bucket_to_resource(
    bucket: &aws_sdk_s3::types::Bucket,
    region: &str,
    versioning: Option<bool>,
    encryption: Option<bool>,
) -> CloudResource {
    let name = bucket.name().unwrap_or_default().to_owned();
    let created = bucket
        .creation_date()
        .and_then(|d| DateTime::parse_from_rfc3339(&d.to_string()).ok())
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(Utc::now);

    let metadata = serde_json::json!({
        "versioning": versioning.unwrap_or(false),
        "encryption": encryption.unwrap_or(true),
        "public_access": false,
        "storage_class": "STANDARD",
    });

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(name.clone()),
        provider: CloudProvider::Aws,
        resource_type: ResourceType::Bucket,
        name,
        region: region.to_owned(),
        status: ResourceStatus::Available,
        metadata,
        tags: HashMap::new(),
        created_at: created,
        updated_at: Utc::now(),
    }
}

/// Convert a VPC from the AWS SDK into our CloudResource model.
pub fn vpc_to_resource(vpc: &aws_sdk_ec2::types::Vpc, region: &str) -> CloudResource {
    let vpc_id = vpc.vpc_id().unwrap_or_default();
    let name = vpc
        .tags()
        .iter()
        .find(|t| t.key() == Some("Name"))
        .and_then(|t| t.value())
        .unwrap_or(vpc_id)
        .to_owned();

    let status = match vpc.state() {
        Some(aws_sdk_ec2::types::VpcState::Available) => ResourceStatus::Available,
        Some(aws_sdk_ec2::types::VpcState::Pending) => ResourceStatus::Pending,
        _ => ResourceStatus::Available,
    };

    let metadata = serde_json::json!({
        "cidr_block": vpc.cidr_block().unwrap_or_default(),
        "is_default": vpc.is_default(),
        "dhcp_options_id": vpc.dhcp_options_id().unwrap_or_default(),
        "instance_tenancy": vpc.instance_tenancy().map(|t| t.as_str()).unwrap_or("default"),
    });

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(vpc_id.to_owned()),
        provider: CloudProvider::Aws,
        resource_type: ResourceType::Vpc,
        name,
        region: region.to_owned(),
        status,
        metadata,
        tags: extract_tags(vpc.tags()),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Convert a Subnet from the AWS SDK into our CloudResource model.
pub fn subnet_to_resource(subnet: &aws_sdk_ec2::types::Subnet, region: &str) -> CloudResource {
    let subnet_id = subnet.subnet_id().unwrap_or_default();
    let name = subnet
        .tags()
        .iter()
        .find(|t| t.key() == Some("Name"))
        .and_then(|t| t.value())
        .unwrap_or(subnet_id)
        .to_owned();

    let metadata = serde_json::json!({
        "vpc_id": subnet.vpc_id().unwrap_or_default(),
        "cidr_block": subnet.cidr_block().unwrap_or_default(),
        "availability_zone": subnet.availability_zone().unwrap_or_default(),
        "is_public": subnet.map_public_ip_on_launch(),
        "available_ips": subnet.available_ip_address_count(),
    });

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(subnet_id.to_owned()),
        provider: CloudProvider::Aws,
        resource_type: ResourceType::Subnet,
        name,
        region: region.to_owned(),
        status: ResourceStatus::Available,
        metadata,
        tags: extract_tags(subnet.tags()),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Convert an RDS DB Instance from the AWS SDK into our CloudResource model.
pub fn rds_instance_to_resource(
    db: &aws_sdk_rds::types::DbInstance,
    region: &str,
) -> CloudResource {
    let db_id = db.db_instance_identifier().unwrap_or_default();
    let status_str = db.db_instance_status().unwrap_or_default();
    let status = match status_str {
        "available" => ResourceStatus::Available,
        "creating" => ResourceStatus::Creating,
        "deleting" => ResourceStatus::Deleting,
        "stopped" => ResourceStatus::Stopped,
        "starting" => ResourceStatus::Pending,
        "stopping" => ResourceStatus::Updating,
        "rebooting" => ResourceStatus::Updating,
        _ => ResourceStatus::Pending,
    };

    let metadata = serde_json::json!({
        "engine": db.engine().unwrap_or_default(),
        "engine_version": db.engine_version().unwrap_or_default(),
        "instance_class": db.db_instance_class().unwrap_or_default(),
        "storage_gb": db.allocated_storage(),
        "multi_az": db.multi_az(),
        "endpoint": db.endpoint().map(|e| format!("{}:{}", e.address().unwrap_or_default(), e.port().unwrap_or(5432))),
        "storage_type": db.storage_type().unwrap_or_default(),
        "backup_retention_period": db.backup_retention_period(),
    });

    let created = db
        .instance_create_time()
        .and_then(|t| DateTime::parse_from_rfc3339(&t.to_string()).ok())
        .map(|t| t.with_timezone(&Utc))
        .unwrap_or_else(Utc::now);

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(db_id.to_owned()),
        provider: CloudProvider::Aws,
        resource_type: ResourceType::Database,
        name: db_id.to_owned(),
        region: region.to_owned(),
        status,
        metadata,
        tags: HashMap::new(),
        created_at: created,
        updated_at: Utc::now(),
    }
}

/// Convert an ELBv2 Load Balancer from the AWS SDK into our CloudResource model.
pub fn load_balancer_to_resource(
    lb: &aws_sdk_elasticloadbalancingv2::types::LoadBalancer,
    region: &str,
) -> CloudResource {
    let arn = lb.load_balancer_arn().unwrap_or_default();
    let name = lb.load_balancer_name().unwrap_or_default().to_owned();

    let status = match lb.state().and_then(|s| s.code()) {
        Some(aws_sdk_elasticloadbalancingv2::types::LoadBalancerStateEnum::Active) => {
            ResourceStatus::Running
        }
        Some(aws_sdk_elasticloadbalancingv2::types::LoadBalancerStateEnum::Provisioning) => {
            ResourceStatus::Creating
        }
        _ => ResourceStatus::Available,
    };

    let lb_type = lb
        .r#type()
        .map(|t| t.as_str())
        .unwrap_or("application");

    let metadata = serde_json::json!({
        "arn": arn,
        "type": lb_type,
        "scheme": lb.scheme().map(|s| s.as_str()).unwrap_or("internet-facing"),
        "dns_name": lb.dns_name().unwrap_or_default(),
        "vpc_id": lb.vpc_id().unwrap_or_default(),
        "availability_zones": lb.availability_zones().iter().map(|az| az.zone_name().unwrap_or_default()).collect::<Vec<_>>(),
    });

    let created = lb
        .created_time()
        .and_then(|t| DateTime::parse_from_rfc3339(&t.to_string()).ok())
        .map(|t| t.with_timezone(&Utc))
        .unwrap_or_else(Utc::now);

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(arn.to_owned()),
        provider: CloudProvider::Aws,
        resource_type: ResourceType::LoadBalancer,
        name,
        region: region.to_owned(),
        status,
        metadata,
        tags: HashMap::new(),
        created_at: created,
        updated_at: Utc::now(),
    }
}

/// Convert a Security Group from the AWS SDK into our CloudResource model.
pub fn security_group_to_resource(
    sg: &aws_sdk_ec2::types::SecurityGroup,
    region: &str,
) -> CloudResource {
    let sg_id = sg.group_id().unwrap_or_default();
    let name = sg.group_name().unwrap_or_default().to_owned();

    let inbound_rules: Vec<serde_json::Value> = sg
        .ip_permissions()
        .iter()
        .map(|p| {
            serde_json::json!({
                "protocol": p.ip_protocol().unwrap_or_default(),
                "from_port": p.from_port(),
                "to_port": p.to_port(),
                "sources": p.ip_ranges().iter().map(|r| r.cidr_ip().unwrap_or_default()).collect::<Vec<_>>(),
            })
        })
        .collect();

    let metadata = serde_json::json!({
        "description": sg.description().unwrap_or_default(),
        "vpc_id": sg.vpc_id().unwrap_or_default(),
        "inbound_rules": inbound_rules,
        "outbound_rules_count": sg.ip_permissions_egress().len(),
    });

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(sg_id.to_owned()),
        provider: CloudProvider::Aws,
        resource_type: ResourceType::SecurityGroup,
        name,
        region: region.to_owned(),
        status: ResourceStatus::Available,
        metadata,
        tags: extract_tags(sg.tags()),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Convert an Elastic IP (Address) from the AWS SDK into our CloudResource model.
pub fn elastic_ip_to_resource(
    addr: &aws_sdk_ec2::types::Address,
    region: &str,
) -> CloudResource {
    let allocation_id = addr.allocation_id().unwrap_or_default();
    let name = addr
        .tags()
        .iter()
        .find(|t| t.key() == Some("Name"))
        .and_then(|t| t.value())
        .unwrap_or(allocation_id)
        .to_owned();

    let metadata = serde_json::json!({
        "allocation_id": allocation_id,
        "association_id": addr.association_id().unwrap_or_default(),
        "public_ip": addr.public_ip().unwrap_or_default(),
        "private_ip": addr.private_ip_address().unwrap_or_default(),
        "instance_id": addr.instance_id().unwrap_or_default(),
        "domain": addr.domain().map(|d| d.as_str()).unwrap_or("vpc"),
        "network_interface_id": addr.network_interface_id().unwrap_or_default(),
    });

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(allocation_id.to_owned()),
        provider: CloudProvider::Aws,
        resource_type: ResourceType::ElasticIp,
        name,
        region: region.to_owned(),
        status: if addr.association_id().is_some() {
            ResourceStatus::Running
        } else {
            ResourceStatus::Available
        },
        metadata,
        tags: extract_tags(addr.tags()),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Convert a NAT Gateway from the AWS SDK into our CloudResource model.
pub fn nat_gateway_to_resource(
    ngw: &aws_sdk_ec2::types::NatGateway,
    region: &str,
) -> CloudResource {
    let ngw_id = ngw.nat_gateway_id().unwrap_or_default();
    let name = ngw
        .tags()
        .iter()
        .find(|t| t.key() == Some("Name"))
        .and_then(|t| t.value())
        .unwrap_or(ngw_id)
        .to_owned();

    let status = match ngw.state() {
        Some(aws_sdk_ec2::types::NatGatewayState::Available) => ResourceStatus::Available,
        Some(aws_sdk_ec2::types::NatGatewayState::Pending) => ResourceStatus::Pending,
        Some(aws_sdk_ec2::types::NatGatewayState::Deleting) => ResourceStatus::Deleting,
        Some(aws_sdk_ec2::types::NatGatewayState::Deleted) => ResourceStatus::Terminated,
        Some(aws_sdk_ec2::types::NatGatewayState::Failed) => ResourceStatus::Error,
        _ => ResourceStatus::Pending,
    };

    let eip_allocation_ids: Vec<String> = ngw
        .nat_gateway_addresses()
        .iter()
        .filter_map(|a| a.allocation_id().map(|s| s.to_owned()))
        .collect();

    let metadata = serde_json::json!({
        "subnet_id": ngw.subnet_id().unwrap_or_default(),
        "vpc_id": ngw.vpc_id().unwrap_or_default(),
        "eip_allocation_ids": eip_allocation_ids,
        "connectivity_type": ngw.connectivity_type().map(|c| c.as_str()).unwrap_or("public"),
    });

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(ngw_id.to_owned()),
        provider: CloudProvider::Aws,
        resource_type: ResourceType::NatGateway,
        name,
        region: region.to_owned(),
        status,
        metadata,
        tags: extract_tags(ngw.tags()),
        created_at: ngw
            .create_time()
            .and_then(|t| DateTime::parse_from_rfc3339(&t.to_string()).ok())
            .map(|t| t.with_timezone(&Utc))
            .unwrap_or_else(Utc::now),
        updated_at: Utc::now(),
    }
}

/// Convert an Internet Gateway from the AWS SDK into our CloudResource model.
pub fn internet_gateway_to_resource(
    igw: &aws_sdk_ec2::types::InternetGateway,
    region: &str,
) -> CloudResource {
    let igw_id = igw.internet_gateway_id().unwrap_or_default();
    let name = igw
        .tags()
        .iter()
        .find(|t| t.key() == Some("Name"))
        .and_then(|t| t.value())
        .unwrap_or(igw_id)
        .to_owned();

    let attachments: Vec<serde_json::Value> = igw
        .attachments()
        .iter()
        .map(|a| {
            serde_json::json!({
                "vpc_id": a.vpc_id().unwrap_or_default(),
                "state": a.state().map(|s| s.as_str()).unwrap_or("unknown"),
            })
        })
        .collect();

    let metadata = serde_json::json!({
        "attachments": attachments,
    });

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(igw_id.to_owned()),
        provider: CloudProvider::Aws,
        resource_type: ResourceType::InternetGateway,
        name,
        region: region.to_owned(),
        status: ResourceStatus::Available,
        metadata,
        tags: extract_tags(igw.tags()),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Convert a Route Table from the AWS SDK into our CloudResource model.
pub fn route_table_to_resource(
    rt: &aws_sdk_ec2::types::RouteTable,
    region: &str,
) -> CloudResource {
    let rt_id = rt.route_table_id().unwrap_or_default();
    let name = rt
        .tags()
        .iter()
        .find(|t| t.key() == Some("Name"))
        .and_then(|t| t.value())
        .unwrap_or(rt_id)
        .to_owned();

    let routes: Vec<serde_json::Value> = rt
        .routes()
        .iter()
        .map(|r| {
            serde_json::json!({
                "destination_cidr": r.destination_cidr_block().unwrap_or_default(),
                "gateway_id": r.gateway_id().unwrap_or_default(),
                "nat_gateway_id": r.nat_gateway_id().unwrap_or_default(),
                "state": r.state().map(|s| s.as_str()).unwrap_or("unknown"),
            })
        })
        .collect();

    let associations: Vec<serde_json::Value> = rt
        .associations()
        .iter()
        .map(|a| {
            serde_json::json!({
                "association_id": a.route_table_association_id().unwrap_or_default(),
                "subnet_id": a.subnet_id().unwrap_or_default(),
                "main": a.main(),
            })
        })
        .collect();

    let metadata = serde_json::json!({
        "vpc_id": rt.vpc_id().unwrap_or_default(),
        "routes": routes,
        "associations": associations,
    });

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(rt_id.to_owned()),
        provider: CloudProvider::Aws,
        resource_type: ResourceType::RouteTable,
        name,
        region: region.to_owned(),
        status: ResourceStatus::Available,
        metadata,
        tags: extract_tags(rt.tags()),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Convert a VPC Peering Connection from the AWS SDK into our CloudResource model.
pub fn vpc_peering_to_resource(
    pc: &aws_sdk_ec2::types::VpcPeeringConnection,
    region: &str,
) -> CloudResource {
    let pc_id = pc.vpc_peering_connection_id().unwrap_or_default();
    let name = pc
        .tags()
        .iter()
        .find(|t| t.key() == Some("Name"))
        .and_then(|t| t.value())
        .unwrap_or(pc_id)
        .to_owned();

    let status = match pc.status().and_then(|s| s.code()) {
        Some(aws_sdk_ec2::types::VpcPeeringConnectionStateReasonCode::Active) => ResourceStatus::Running,
        Some(aws_sdk_ec2::types::VpcPeeringConnectionStateReasonCode::PendingAcceptance) => ResourceStatus::Pending,
        Some(aws_sdk_ec2::types::VpcPeeringConnectionStateReasonCode::Deleted) => ResourceStatus::Terminated,
        Some(aws_sdk_ec2::types::VpcPeeringConnectionStateReasonCode::Rejected) => ResourceStatus::Error,
        Some(aws_sdk_ec2::types::VpcPeeringConnectionStateReasonCode::Failed) => ResourceStatus::Error,
        Some(aws_sdk_ec2::types::VpcPeeringConnectionStateReasonCode::Deleting) => ResourceStatus::Deleting,
        _ => ResourceStatus::Pending,
    };

    let requester_vpc = pc.requester_vpc_info();
    let accepter_vpc = pc.accepter_vpc_info();

    let metadata = serde_json::json!({
        "requester_vpc_id": requester_vpc.map(|v| v.vpc_id().unwrap_or_default()).unwrap_or_default(),
        "requester_owner_id": requester_vpc.map(|v| v.owner_id().unwrap_or_default()).unwrap_or_default(),
        "accepter_vpc_id": accepter_vpc.map(|v| v.vpc_id().unwrap_or_default()).unwrap_or_default(),
        "accepter_owner_id": accepter_vpc.map(|v| v.owner_id().unwrap_or_default()).unwrap_or_default(),
        "status_message": pc.status().and_then(|s| s.message()).unwrap_or_default(),
    });

    CloudResource {
        id: Uuid::new_v4(),
        cloud_id: Some(pc_id.to_owned()),
        provider: CloudProvider::Aws,
        resource_type: ResourceType::VpcPeering,
        name,
        region: region.to_owned(),
        status,
        metadata,
        tags: extract_tags(pc.tags()),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

/// Extract Name=Value tags from AWS EC2 Tag list into a HashMap.
fn extract_tags(tags: &[aws_sdk_ec2::types::Tag]) -> HashMap<String, String> {
    tags.iter()
        .filter_map(|t| {
            let key = t.key()?.to_owned();
            let value = t.value()?.to_owned();
            Some((key, value))
        })
        .collect()
}

use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::sync::Arc;

use crate::error::CloudError;
use crate::models::{CloudProvider, CreateSubnetRequest, CreateVpcRequest, ResourceListResponse, SecurityGroupRule};
use crate::providers;
use crate::providers::ProviderContext;

#[derive(Debug, Deserialize)]
pub struct ProviderPath {
    pub provider: String,
}

#[derive(Debug, Deserialize)]
pub struct ResourcePath {
    pub provider: String,
    pub id: String,
}

#[derive(Debug, Deserialize)]
pub struct SubnetListPath {
    pub provider: String,
    pub vpc_id: String,
}

#[derive(Debug, Deserialize)]
pub struct RegionQuery {
    pub region: Option<String>,
}

fn parse_provider(name: &str) -> Result<CloudProvider, CloudError> {
    CloudProvider::from_str(name)
        .ok_or_else(|| CloudError::BadRequest(format!("Unknown provider: {}", name)))
}

fn default_region(provider: CloudProvider, query_region: Option<&str>) -> String {
    query_region.map(String::from).unwrap_or_else(|| match provider {
        CloudProvider::Aws => "us-east-1".to_string(),
        CloudProvider::Gcp => "us-central1".to_string(),
        CloudProvider::Azure => "eastus".to_string(),
    })
}

/// GET /api/v1/cloud/{provider}/networking/vpcs
pub async fn list_vpcs(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let vpcs = networking.list_vpcs(&region).await?;
    let response = ResourceListResponse {
        total: vpcs.len(),
        resources: vpcs,
        next_token: None,
    };

    Ok(HttpResponse::Ok().json(response))
}

/// GET /api/v1/cloud/{provider}/networking/vpcs/{id}
pub async fn get_vpc(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let vpc = networking.get_vpc(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(vpc))
}

/// POST /api/v1/cloud/{provider}/networking/vpcs
pub async fn create_vpc(
    path: web::Path<ProviderPath>,
    body: web::Json<CreateVpcRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = config.region.clone();
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let vpc = networking.create_vpc(&region, config).await?;
    Ok(HttpResponse::Created().json(vpc))
}

/// DELETE /api/v1/cloud/{provider}/networking/vpcs/{id}
pub async fn delete_vpc(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    networking.delete_vpc(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// GET /api/v1/cloud/{provider}/networking/vpcs/{vpc_id}/subnets
pub async fn list_subnets(
    path: web::Path<SubnetListPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let subnets = networking.list_subnets(&region, &path.vpc_id).await?;
    let response = ResourceListResponse {
        total: subnets.len(),
        resources: subnets,
        next_token: None,
    };

    Ok(HttpResponse::Ok().json(response))
}

/// POST /api/v1/cloud/{provider}/networking/subnets
pub async fn create_subnet(
    path: web::Path<ProviderPath>,
    body: web::Json<CreateSubnetRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = config.availability_zone.clone();
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let subnet = networking.create_subnet(&region, config).await?;
    Ok(HttpResponse::Created().json(subnet))
}

/// DELETE /api/v1/cloud/{provider}/networking/subnets/{id}
pub async fn delete_subnet(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    networking.delete_subnet(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// GET /api/v1/cloud/{provider}/networking/load-balancers
pub async fn list_load_balancers(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let lbs = networking.list_load_balancers(&region).await?;
    let response = ResourceListResponse {
        total: lbs.len(),
        resources: lbs,
        next_token: None,
    };

    Ok(HttpResponse::Ok().json(response))
}

/// GET /api/v1/cloud/{provider}/networking/load-balancers/{id}
pub async fn get_load_balancer(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let lb = networking.get_load_balancer(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(lb))
}

/// DELETE /api/v1/cloud/{provider}/networking/load-balancers/{id}
pub async fn delete_load_balancer(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    networking.delete_load_balancer(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// GET /api/v1/cloud/{provider}/networking/security-groups
pub async fn list_security_groups(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let sgs = networking.list_security_groups(&region).await?;
    let response = ResourceListResponse {
        total: sgs.len(),
        resources: sgs,
        next_token: None,
    };

    Ok(HttpResponse::Ok().json(response))
}

// ======================== Elastic IPs ========================

/// GET /api/v1/cloud/{provider}/networking/elastic-ips
pub async fn list_elastic_ips(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let eips = networking.list_elastic_ips(&region).await?;
    let response = ResourceListResponse {
        total: eips.len(),
        resources: eips,
        next_token: None,
    };

    Ok(HttpResponse::Ok().json(response))
}

/// POST /api/v1/cloud/{provider}/networking/elastic-ips
pub async fn allocate_elastic_ip(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let eip = networking.allocate_elastic_ip(&region).await?;
    Ok(HttpResponse::Created().json(eip))
}

#[derive(Debug, Deserialize)]
pub struct AssociateEipRequest {
    pub instance_id: String,
}

/// POST /api/v1/cloud/{provider}/networking/elastic-ips/{id}/associate
pub async fn associate_elastic_ip(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    body: web::Json<AssociateEipRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    networking.associate_elastic_ip(&region, &path.id, &body.instance_id).await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "associated"})))
}

#[derive(Debug, Deserialize)]
pub struct DisassociateEipPath {
    pub provider: String,
    pub association_id: String,
}

/// POST /api/v1/cloud/{provider}/networking/elastic-ips/{association_id}/disassociate
pub async fn disassociate_elastic_ip(
    path: web::Path<DisassociateEipPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    networking.disassociate_elastic_ip(&region, &path.association_id).await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "disassociated"})))
}

/// DELETE /api/v1/cloud/{provider}/networking/elastic-ips/{id}
pub async fn release_elastic_ip(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    networking.release_elastic_ip(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

// ======================== NAT Gateways ========================

/// GET /api/v1/cloud/{provider}/networking/nat-gateways
pub async fn list_nat_gateways(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let ngws = networking.list_nat_gateways(&region).await?;
    let response = ResourceListResponse {
        total: ngws.len(),
        resources: ngws,
        next_token: None,
    };

    Ok(HttpResponse::Ok().json(response))
}

#[derive(Debug, Deserialize)]
pub struct CreateNatGatewayRequest {
    pub subnet_id: String,
    pub eip_allocation_id: String,
}

/// POST /api/v1/cloud/{provider}/networking/nat-gateways
pub async fn create_nat_gateway(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    body: web::Json<CreateNatGatewayRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let ngw = networking.create_nat_gateway(&region, &body.subnet_id, &body.eip_allocation_id).await?;
    Ok(HttpResponse::Created().json(ngw))
}

/// DELETE /api/v1/cloud/{provider}/networking/nat-gateways/{id}
pub async fn delete_nat_gateway(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    networking.delete_nat_gateway(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

// ======================== Internet Gateways ========================

/// GET /api/v1/cloud/{provider}/networking/internet-gateways
pub async fn list_internet_gateways(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let igws = networking.list_internet_gateways(&region).await?;
    let response = ResourceListResponse {
        total: igws.len(),
        resources: igws,
        next_token: None,
    };

    Ok(HttpResponse::Ok().json(response))
}

/// POST /api/v1/cloud/{provider}/networking/internet-gateways
pub async fn create_internet_gateway(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let igw = networking.create_internet_gateway(&region).await?;
    Ok(HttpResponse::Created().json(igw))
}

#[derive(Debug, Deserialize)]
pub struct AttachIgwRequest {
    pub vpc_id: String,
}

/// POST /api/v1/cloud/{provider}/networking/internet-gateways/{id}/attach
pub async fn attach_internet_gateway(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    body: web::Json<AttachIgwRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    networking.attach_internet_gateway(&region, &path.id, &body.vpc_id).await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "attached"})))
}

/// POST /api/v1/cloud/{provider}/networking/internet-gateways/{id}/detach
pub async fn detach_internet_gateway(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    body: web::Json<AttachIgwRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    networking.detach_internet_gateway(&region, &path.id, &body.vpc_id).await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "detached"})))
}

/// DELETE /api/v1/cloud/{provider}/networking/internet-gateways/{id}
pub async fn delete_internet_gateway(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    networking.delete_internet_gateway(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

// ======================== Route Tables ========================

/// GET /api/v1/cloud/{provider}/networking/route-tables
pub async fn list_route_tables(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let rts = networking.list_route_tables(&region).await?;
    let response = ResourceListResponse {
        total: rts.len(),
        resources: rts,
        next_token: None,
    };

    Ok(HttpResponse::Ok().json(response))
}

#[derive(Debug, Deserialize)]
pub struct CreateRouteTableRequest {
    pub vpc_id: String,
}

/// POST /api/v1/cloud/{provider}/networking/route-tables
pub async fn create_route_table(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    body: web::Json<CreateRouteTableRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let rt = networking.create_route_table(&region, &body.vpc_id).await?;
    Ok(HttpResponse::Created().json(rt))
}

#[derive(Debug, Deserialize)]
pub struct AddRouteRequest {
    pub destination_cidr: String,
    pub target_id: String,
}

/// POST /api/v1/cloud/{provider}/networking/route-tables/{id}/routes
pub async fn add_route(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    body: web::Json<AddRouteRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    networking.add_route(&region, &path.id, &body.destination_cidr, &body.target_id).await?;
    Ok(HttpResponse::Created().json(serde_json::json!({"status": "route_added"})))
}

#[derive(Debug, Deserialize)]
pub struct DeleteRouteRequest {
    pub destination_cidr: String,
}

/// DELETE (via POST) /api/v1/cloud/{provider}/networking/route-tables/{id}/routes/delete
pub async fn delete_route(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    body: web::Json<DeleteRouteRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    networking.delete_route(&region, &path.id, &body.destination_cidr).await?;
    Ok(HttpResponse::NoContent().finish())
}

#[derive(Debug, Deserialize)]
pub struct AssociateRouteTableRequest {
    pub subnet_id: String,
}

/// POST /api/v1/cloud/{provider}/networking/route-tables/{id}/associate
pub async fn associate_route_table(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    body: web::Json<AssociateRouteTableRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let assoc_id = networking.associate_route_table(&region, &path.id, &body.subnet_id).await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({"association_id": assoc_id})))
}

/// DELETE /api/v1/cloud/{provider}/networking/route-tables/{id}
pub async fn delete_route_table(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    networking.delete_route_table(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

// ======================== Security Group CRUD ========================

#[derive(Debug, Deserialize)]
pub struct CreateSecurityGroupRequest {
    pub name: String,
    pub description: String,
    pub vpc_id: String,
}

/// POST /api/v1/cloud/{provider}/networking/security-groups
pub async fn create_security_group(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    body: web::Json<CreateSecurityGroupRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let sg = networking.create_security_group(&region, &body.name, &body.description, &body.vpc_id).await?;
    Ok(HttpResponse::Created().json(sg))
}

/// POST /api/v1/cloud/{provider}/networking/security-groups/{id}/rules
pub async fn add_security_group_rule(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    body: web::Json<SecurityGroupRule>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    networking.add_security_group_rule(&region, &path.id, body.into_inner()).await?;
    Ok(HttpResponse::Created().json(serde_json::json!({"status": "rule_added"})))
}

/// POST /api/v1/cloud/{provider}/networking/security-groups/{id}/rules/delete
pub async fn remove_security_group_rule(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    body: web::Json<SecurityGroupRule>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    networking.remove_security_group_rule(&region, &path.id, body.into_inner()).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// DELETE /api/v1/cloud/{provider}/networking/security-groups/{id}
pub async fn delete_security_group(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    networking.delete_security_group(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

// ======================== VPC Peering ========================

/// GET /api/v1/cloud/{provider}/networking/vpc-peerings
pub async fn list_vpc_peering_connections(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let pcs = networking.list_vpc_peering_connections(&region).await?;
    let response = ResourceListResponse {
        total: pcs.len(),
        resources: pcs,
        next_token: None,
    };

    Ok(HttpResponse::Ok().json(response))
}

#[derive(Debug, Deserialize)]
pub struct CreateVpcPeeringRequest {
    pub vpc_id: String,
    pub peer_vpc_id: String,
}

/// POST /api/v1/cloud/{provider}/networking/vpc-peerings
pub async fn create_vpc_peering(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    body: web::Json<CreateVpcPeeringRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    let pc = networking.create_vpc_peering(&region, &body.vpc_id, &body.peer_vpc_id).await?;
    Ok(HttpResponse::Created().json(pc))
}

/// POST /api/v1/cloud/{provider}/networking/vpc-peerings/{id}/accept
pub async fn accept_vpc_peering(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    networking.accept_vpc_peering(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "accepted"})))
}

/// DELETE /api/v1/cloud/{provider}/networking/vpc-peerings/{id}
pub async fn delete_vpc_peering(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let networking = providers::get_networking_provider(provider, ctx.get_ref());

    networking.delete_vpc_peering(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

// ---------------------------------------------------------------------------
// Transit Gateways
// ---------------------------------------------------------------------------

/// GET /api/v1/cloud/{provider}/networking/transit-gateways
pub async fn list_transit_gateways(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "resources": [
            { "id": "tgw-01a2b3c4d", "name": "prod-transit-gw", "provider": path.provider, "region": region, "status": "available", "type": "transit_gateway", "metadata": { "asn": 64512, "attachments": 5, "routeTables": 2 }, "createdAt": "2026-01-15T00:00:00Z" },
            { "id": "tgw-05e6f7g8h", "name": "staging-transit-gw", "provider": path.provider, "region": region, "status": "available", "type": "transit_gateway", "metadata": { "asn": 64513, "attachments": 3, "routeTables": 1 }, "createdAt": "2026-02-01T00:00:00Z" },
        ],
        "total": 2,
        "nextToken": null
    })))
}

/// GET /api/v1/cloud/{provider}/networking/direct-connects
pub async fn list_direct_connects(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "resources": [
            { "id": "dxcon-abc123", "name": "prod-dx-primary", "provider": path.provider, "region": region, "status": "available", "type": "direct_connect", "metadata": { "bandwidth": "10 Gbps", "location": "EqDC2, Ashburn VA", "vlan": 100, "bgpStatus": "established" }, "createdAt": "2025-06-15T00:00:00Z" },
            { "id": "dxcon-def456", "name": "prod-dx-secondary", "provider": path.provider, "region": region, "status": "available", "type": "direct_connect", "metadata": { "bandwidth": "10 Gbps", "location": "CoreSite, Los Angeles", "vlan": 101, "bgpStatus": "established" }, "createdAt": "2025-06-20T00:00:00Z" },
        ],
        "total": 2,
        "nextToken": null
    })))
}

/// GET /api/v1/cloud/{provider}/networking/vpc-endpoints
pub async fn list_vpc_endpoints(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "resources": [
            { "id": "vpce-s3-01", "name": "s3-endpoint", "provider": path.provider, "region": region, "status": "available", "type": "vpc_endpoint", "metadata": { "endpointType": "Gateway", "serviceName": "com.amazonaws.us-east-1.s3", "vpcId": "vpc-prod-01" }, "createdAt": "2025-08-01T00:00:00Z" },
            { "id": "vpce-ec2-01", "name": "ec2-endpoint", "provider": path.provider, "region": region, "status": "available", "type": "vpc_endpoint", "metadata": { "endpointType": "Interface", "serviceName": "com.amazonaws.us-east-1.ec2", "vpcId": "vpc-prod-01", "subnets": 3 }, "createdAt": "2025-08-01T00:00:00Z" },
            { "id": "vpce-ssm-01", "name": "ssm-endpoint", "provider": path.provider, "region": region, "status": "available", "type": "vpc_endpoint", "metadata": { "endpointType": "Interface", "serviceName": "com.amazonaws.us-east-1.ssm", "vpcId": "vpc-prod-01", "subnets": 3 }, "createdAt": "2025-09-15T00:00:00Z" },
        ],
        "total": 3,
        "nextToken": null
    })))
}

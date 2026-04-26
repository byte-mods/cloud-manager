use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::sync::Arc;

use crate::error::CloudError;
use crate::models::{CloudProvider, DnsRecordInput, ResourceListResponse};
use crate::providers;
use crate::providers::ProviderContext;

#[derive(Debug, Deserialize)]
pub struct ProviderPath {
    pub provider: String,
}

#[derive(Debug, Deserialize)]
pub struct ZonePath {
    pub provider: String,
    pub zone_id: String,
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

/// GET /api/v1/cloud/{provider}/dns/zones
pub async fn list_zones(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let dns = providers::get_dns_provider(provider, ctx.get_ref());

    let zones = dns.list_hosted_zones(&region).await?;
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: zones.len(),
        resources: zones,
        next_token: None,
    }))
}

/// GET /api/v1/cloud/{provider}/dns/zones/{zone_id}/records
pub async fn list_records(
    path: web::Path<ZonePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let dns = providers::get_dns_provider(provider, ctx.get_ref());

    let records = dns.list_records(&region, &path.zone_id).await?;
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: records.len(),
        resources: records,
        next_token: None,
    }))
}

/// POST /api/v1/cloud/{provider}/dns/zones/{zone_id}/records
pub async fn create_record(
    path: web::Path<ZonePath>,
    body: web::Json<DnsRecordInput>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = default_region(provider, None);
    let dns = providers::get_dns_provider(provider, ctx.get_ref());

    let record = dns.create_record(&region, &path.zone_id, config).await?;
    Ok(HttpResponse::Created().json(record))
}

/// DELETE /api/v1/cloud/{provider}/dns/zones/{zone_id}/records
pub async fn delete_record(
    path: web::Path<ZonePath>,
    body: web::Json<DnsRecordInput>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = default_region(provider, None);
    let dns = providers::get_dns_provider(provider, ctx.get_ref());

    dns.delete_record(&region, &path.zone_id, config).await?;
    Ok(HttpResponse::NoContent().finish())
}

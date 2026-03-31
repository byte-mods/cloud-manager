use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::sync::Arc;

use crate::error::CloudError;
use crate::models::{CloudProvider, CreateDistributionRequest, InvalidateCacheRequest, ResourceListResponse};
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

/// GET /api/v1/cloud/{provider}/cdn/distributions
pub async fn list_distributions(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let cdn_provider = providers::get_cdn_provider(provider, ctx.get_ref());
    let dists = cdn_provider.list_distributions(&region).await?;
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: dists.len(),
        resources: dists,
        next_token: None,
    }))
}

/// GET /api/v1/cloud/{provider}/cdn/distributions/{id}
pub async fn get_distribution(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let cdn_provider = providers::get_cdn_provider(provider, ctx.get_ref());
    let dist = cdn_provider.get_distribution(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(dist))
}

/// POST /api/v1/cloud/{provider}/cdn/distributions
pub async fn create_distribution(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    body: web::Json<CreateDistributionRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let cdn_provider = providers::get_cdn_provider(provider, ctx.get_ref());
    let dist = cdn_provider.create_distribution(&region, body.into_inner()).await?;
    Ok(HttpResponse::Created().json(dist))
}

/// DELETE /api/v1/cloud/{provider}/cdn/distributions/{id}
pub async fn delete_distribution(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let cdn_provider = providers::get_cdn_provider(provider, ctx.get_ref());
    cdn_provider.delete_distribution(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// POST /api/v1/cloud/{provider}/cdn/distributions/{id}/invalidate
pub async fn invalidate_cache(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    body: web::Json<InvalidateCacheRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let cdn_provider = providers::get_cdn_provider(provider, ctx.get_ref());
    cdn_provider.invalidate_cache(&region, &path.id, body.into_inner().paths).await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "invalidation_created"})))
}

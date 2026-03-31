use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::sync::Arc;

use crate::error::CloudError;
use crate::models::{CloudProvider, CreateCacheClusterRequest, ResourceListResponse};
use crate::providers;
use crate::providers::ProviderContext;

#[derive(Debug, Deserialize)]
pub struct ProviderPath {
    pub provider: String,
}

#[derive(Debug, Deserialize)]
pub struct ClusterPath {
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

/// GET /api/v1/cloud/{provider}/cache/clusters
pub async fn list_clusters(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let cache_provider = providers::get_cache_db_provider(provider, ctx.get_ref());

    let clusters = cache_provider.list_clusters(&region).await?;
    let response = ResourceListResponse {
        total: clusters.len(),
        resources: clusters,
        next_token: None,
    };

    Ok(HttpResponse::Ok().json(response))
}

/// GET /api/v1/cloud/{provider}/cache/clusters/{id}
pub async fn get_cluster(
    path: web::Path<ClusterPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let cache_provider = providers::get_cache_db_provider(provider, ctx.get_ref());

    let cluster = cache_provider.get_cluster(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(cluster))
}

/// POST /api/v1/cloud/{provider}/cache/clusters
pub async fn create_cluster(
    path: web::Path<ProviderPath>,
    body: web::Json<CreateCacheClusterRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let req = body.into_inner();
    let cache_provider = providers::get_cache_db_provider(provider, ctx.get_ref());

    let cluster = cache_provider
        .create_cluster(&req.region, &req.name, &req.engine, &req.node_type)
        .await?;
    Ok(HttpResponse::Created().json(cluster))
}

/// DELETE /api/v1/cloud/{provider}/cache/clusters/{id}
pub async fn delete_cluster(
    path: web::Path<ClusterPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let cache_provider = providers::get_cache_db_provider(provider, ctx.get_ref());

    cache_provider.delete_cluster(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

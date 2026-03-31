use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::sync::Arc;

use crate::error::CloudError;
use crate::models::{CloudProvider, CreateApiRouteRequest, CreateApiStageRequest, ResourceListResponse};
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

#[derive(Debug, Deserialize)]
pub struct CreateApiBody {
    pub name: String,
    pub protocol: Option<String>,
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

/// GET /api/v1/cloud/{provider}/api-gateway/apis
pub async fn list_apis(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let gateway_provider = providers::get_api_gateway_provider(provider, ctx.get_ref());
    let apis = gateway_provider.list_apis(&region).await?;
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: apis.len(),
        resources: apis,
        next_token: None,
    }))
}

/// GET /api/v1/cloud/{provider}/api-gateway/apis/{id}
pub async fn get_api(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let gateway_provider = providers::get_api_gateway_provider(provider, ctx.get_ref());
    let api = gateway_provider.get_api(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(api))
}

/// POST /api/v1/cloud/{provider}/api-gateway/apis
pub async fn create_api(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    body: web::Json<CreateApiBody>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let gateway_provider = providers::get_api_gateway_provider(provider, ctx.get_ref());
    let protocol = body.protocol.as_deref().unwrap_or("HTTP");
    let api = gateway_provider.create_api(&region, &body.name, protocol).await?;
    Ok(HttpResponse::Created().json(api))
}

/// DELETE /api/v1/cloud/{provider}/api-gateway/apis/{id}
pub async fn delete_api(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let gateway_provider = providers::get_api_gateway_provider(provider, ctx.get_ref());
    gateway_provider.delete_api(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// GET /api/v1/cloud/{provider}/api-gateway/apis/{id}/routes
pub async fn list_routes(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let gateway_provider = providers::get_api_gateway_provider(provider, ctx.get_ref());
    let routes = gateway_provider.list_routes(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: routes.len(),
        resources: routes,
        next_token: None,
    }))
}

/// POST /api/v1/cloud/{provider}/api-gateway/apis/{id}/routes
pub async fn create_route(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    body: web::Json<CreateApiRouteRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let gateway_provider = providers::get_api_gateway_provider(provider, ctx.get_ref());
    let route = gateway_provider.create_route(&region, &path.id, &body.method, &body.path).await?;
    Ok(HttpResponse::Created().json(route))
}

/// GET /api/v1/cloud/{provider}/api-gateway/apis/{id}/stages
pub async fn list_stages(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let gateway_provider = providers::get_api_gateway_provider(provider, ctx.get_ref());
    let stages = gateway_provider.list_stages(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: stages.len(),
        resources: stages,
        next_token: None,
    }))
}

/// POST /api/v1/cloud/{provider}/api-gateway/apis/{id}/stages
pub async fn create_stage(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    body: web::Json<CreateApiStageRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let gateway_provider = providers::get_api_gateway_provider(provider, ctx.get_ref());
    let stage = gateway_provider.create_stage(&region, &path.id, &body.name).await?;
    Ok(HttpResponse::Created().json(stage))
}

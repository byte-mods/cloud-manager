use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::sync::Arc;

use crate::error::CloudError;
use crate::models::{CloudProvider, ResourceListResponse};
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
pub struct CreateRegistryRequest {
    pub name: String,
    pub encryption: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ImageScanPath {
    pub provider: String,
    pub id: String,
    pub tag: String,
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

/// GET /api/v1/cloud/{provider}/container-registries
pub async fn list_registries(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let cr_provider = providers::get_container_registry_provider(provider, ctx.get_ref());

    let registries = cr_provider.list_registries(&region).await?;
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: registries.len(),
        resources: registries,
        next_token: None,
    }))
}

/// GET /api/v1/cloud/{provider}/container-registries/{id}
pub async fn get_registry(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let cr_provider = providers::get_container_registry_provider(provider, ctx.get_ref());

    let registry = cr_provider.get_registry(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(registry))
}

/// POST /api/v1/cloud/{provider}/container-registries
pub async fn create_registry(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    body: web::Json<CreateRegistryRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let cr_provider = providers::get_container_registry_provider(provider, ctx.get_ref());
    let config = body.into_inner();

    let registry = cr_provider.create_registry(&region, &config.name).await?;
    Ok(HttpResponse::Created().json(registry))
}

/// DELETE /api/v1/cloud/{provider}/container-registries/{id}
pub async fn delete_registry(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let cr_provider = providers::get_container_registry_provider(provider, ctx.get_ref());

    cr_provider.delete_registry(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// GET /api/v1/cloud/{provider}/container-registries/{id}/images
pub async fn list_images(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let cr_provider = providers::get_container_registry_provider(provider, ctx.get_ref());

    let images = cr_provider.list_images(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: images.len(),
        resources: images,
        next_token: None,
    }))
}

/// GET /api/v1/cloud/{provider}/container-registries/{id}/images/{tag}/scan
pub async fn get_image_scan_results(
    path: web::Path<ImageScanPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let cr_provider = providers::get_container_registry_provider(provider, ctx.get_ref());

    let results = cr_provider.get_image_scan_results(&region, &path.id, &path.tag).await?;
    Ok(HttpResponse::Ok().json(results))
}

/// POST /api/v1/cloud/{provider}/container-registries/{id}/images/{tag}/scan
pub async fn start_image_scan(
    path: web::Path<ImageScanPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let cr_provider = providers::get_container_registry_provider(provider, ctx.get_ref());

    cr_provider.start_image_scan(&region, &path.id, &path.tag).await?;
    Ok(HttpResponse::Accepted().json(serde_json::json!({
        "status": "scan_started",
        "repository": path.id,
        "image_tag": path.tag,
    })))
}

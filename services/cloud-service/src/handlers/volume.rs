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
pub struct CreateVolumeRequest {
    pub size_gb: i32,
    pub volume_type: String,
    pub availability_zone: String,
}

#[derive(Debug, Deserialize)]
pub struct AttachVolumeRequest {
    pub instance_id: String,
    pub device: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateSnapshotRequest {
    pub name: String,
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

/// GET /api/v1/cloud/{provider}/volumes
pub async fn list_volumes(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());

    let vol = providers::get_volume_provider(provider, ctx.get_ref());
    let volumes = vol.list_volumes(&region).await?;
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: volumes.len(),
        resources: volumes,
        next_token: None,
    }))
}

/// POST /api/v1/cloud/{provider}/volumes
pub async fn create_volume(
    path: web::Path<ProviderPath>,
    body: web::Json<CreateVolumeRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = default_region(provider, None);

    let vol = providers::get_volume_provider(provider, ctx.get_ref());
    let volume = vol.create_volume(&region, config.size_gb, &config.volume_type, &config.availability_zone).await?;
    Ok(HttpResponse::Created().json(volume))
}

/// DELETE /api/v1/cloud/{provider}/volumes/{id}
pub async fn delete_volume(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());

    let vol = providers::get_volume_provider(provider, ctx.get_ref());
    vol.delete_volume(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// POST /api/v1/cloud/{provider}/volumes/{id}/attach
pub async fn attach_volume(
    path: web::Path<ResourcePath>,
    body: web::Json<AttachVolumeRequest>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = default_region(provider, query.region.as_deref());

    let vol = providers::get_volume_provider(provider, ctx.get_ref());
    vol.attach_volume(&region, &path.id, &config.instance_id, &config.device).await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "attached"})))
}

/// POST /api/v1/cloud/{provider}/volumes/{id}/detach
pub async fn detach_volume(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());

    let vol = providers::get_volume_provider(provider, ctx.get_ref());
    vol.detach_volume(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "detached"})))
}

/// POST /api/v1/cloud/{provider}/volumes/{id}/snapshot
pub async fn create_snapshot(
    path: web::Path<ResourcePath>,
    body: web::Json<CreateSnapshotRequest>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = default_region(provider, query.region.as_deref());

    let vol = providers::get_volume_provider(provider, ctx.get_ref());
    let snapshot = vol.create_volume_snapshot(&region, &path.id, &config.name).await?;
    Ok(HttpResponse::Created().json(snapshot))
}

use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::sync::Arc;

use crate::error::CloudError;
use crate::models::{CloudProvider, ResourceListResponse};
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
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let _ = region;

    let volumes = vec![];
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
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    let _config = body.into_inner();
    Ok(HttpResponse::Created().json(serde_json::json!({"status": "created"})))
}

/// DELETE /api/v1/cloud/{provider}/volumes/{id}
pub async fn delete_volume(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    let _region = default_region(_provider, query.region.as_deref());
    Ok(HttpResponse::NoContent().finish())
}

/// POST /api/v1/cloud/{provider}/volumes/{id}/attach
pub async fn attach_volume(
    path: web::Path<ResourcePath>,
    body: web::Json<AttachVolumeRequest>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    let _config = body.into_inner();
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "attached"})))
}

/// POST /api/v1/cloud/{provider}/volumes/{id}/detach
pub async fn detach_volume(
    path: web::Path<ResourcePath>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "detached"})))
}

/// POST /api/v1/cloud/{provider}/volumes/{id}/snapshot
pub async fn create_snapshot(
    path: web::Path<ResourcePath>,
    body: web::Json<CreateSnapshotRequest>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    let _config = body.into_inner();
    Ok(HttpResponse::Created().json(serde_json::json!({"status": "snapshot_created"})))
}

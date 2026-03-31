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
pub struct CreateKeyRequest {
    pub alias: String,
    pub key_usage: Option<String>,
    pub key_spec: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ScheduleDeletionRequest {
    pub pending_window_in_days: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct SetEnabledRequest {
    pub enabled: bool,
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

/// GET /api/v1/cloud/{provider}/kms/keys
pub async fn list_keys(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let _ = region;

    let keys = vec![];
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: keys.len(),
        resources: keys,
        next_token: None,
    }))
}

/// GET /api/v1/cloud/{provider}/kms/keys/{id}
pub async fn get_key(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let _ = region;

    let keys = vec![];
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: keys.len(),
        resources: keys,
        next_token: None,
    }))
}

/// POST /api/v1/cloud/{provider}/kms/keys
pub async fn create_key(
    path: web::Path<ProviderPath>,
    body: web::Json<CreateKeyRequest>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    let _config = body.into_inner();
    Ok(HttpResponse::Created().json(serde_json::json!({"status": "created"})))
}

/// DELETE /api/v1/cloud/{provider}/kms/keys/{id}
pub async fn schedule_deletion(
    path: web::Path<ResourcePath>,
    body: web::Json<ScheduleDeletionRequest>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    let _config = body.into_inner();
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "deletion_scheduled"})))
}

/// POST /api/v1/cloud/{provider}/kms/keys/{id}/enabled
pub async fn set_enabled(
    path: web::Path<ResourcePath>,
    body: web::Json<SetEnabledRequest>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    let _config = body.into_inner();
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "key_updated"})))
}

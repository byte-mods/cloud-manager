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
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());

    let kms = providers::get_kms_provider(provider, ctx.get_ref());
    let keys = kms.list_keys(&region).await?;

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
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());

    let kms = providers::get_kms_provider(provider, ctx.get_ref());
    let key = kms.get_key(&region, &path.id).await?;

    Ok(HttpResponse::Ok().json(key))
}

/// POST /api/v1/cloud/{provider}/kms/keys
pub async fn create_key(
    path: web::Path<ProviderPath>,
    body: web::Json<CreateKeyRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = default_region(provider, None);

    let kms = providers::get_kms_provider(provider, ctx.get_ref());
    let key = kms.create_key(&region, &config.alias, &config.key_spec.unwrap_or_else(|| "SYMMETRIC_DEFAULT".to_string())).await?;

    Ok(HttpResponse::Created().json(key))
}

/// DELETE /api/v1/cloud/{provider}/kms/keys/{id}
pub async fn schedule_deletion(
    path: web::Path<ResourcePath>,
    _body: web::Json<ScheduleDeletionRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, None);

    let kms = providers::get_kms_provider(provider, ctx.get_ref());
    kms.schedule_key_deletion(&region, &path.id).await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "deletion_scheduled"})))
}

/// POST /api/v1/cloud/{provider}/kms/keys/{id}/enabled
pub async fn set_enabled(
    path: web::Path<ResourcePath>,
    body: web::Json<SetEnabledRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = default_region(provider, None);

    let kms = providers::get_kms_provider(provider, ctx.get_ref());
    kms.set_key_enabled(&region, &path.id, config.enabled).await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "key_updated"})))
}

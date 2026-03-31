use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::sync::Arc;

use crate::error::CloudError;
use crate::models::{CloudProvider, CreateInstanceRequest, ResourceActionRequest, ResourceListResponse};
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
pub struct ActionPath {
    pub provider: String,
    pub id: String,
    pub action: String,
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

/// GET /api/v1/cloud/{provider}/compute/instances
pub async fn list_instances(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let compute = providers::get_compute_provider(provider, ctx.get_ref());

    let instances = compute.list_instances(&region).await?;
    let response = ResourceListResponse {
        total: instances.len(),
        resources: instances,
        next_token: None,
    };

    Ok(HttpResponse::Ok().json(response))
}

/// GET /api/v1/cloud/{provider}/compute/instances/{id}
pub async fn get_instance(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let compute = providers::get_compute_provider(provider, ctx.get_ref());

    let instance = compute.get_instance(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(instance))
}

/// POST /api/v1/cloud/{provider}/compute/instances
pub async fn create_instance(
    path: web::Path<ProviderPath>,
    body: web::Json<CreateInstanceRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = config.region.clone();
    let compute = providers::get_compute_provider(provider, ctx.get_ref());

    let instance = compute.create_instance(&region, config).await?;
    Ok(HttpResponse::Created().json(instance))
}

/// DELETE /api/v1/cloud/{provider}/compute/instances/{id}
pub async fn delete_instance(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let compute = providers::get_compute_provider(provider, ctx.get_ref());

    compute.delete_instance(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// POST /api/v1/cloud/{provider}/compute/instances/{id}/actions/{action}
pub async fn instance_action(
    path: web::Path<ActionPath>,
    query: web::Query<RegionQuery>,
    _body: web::Json<ResourceActionRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let compute = providers::get_compute_provider(provider, ctx.get_ref());

    match path.action.as_str() {
        "start" => compute.start_instance(&region, &path.id).await?,
        "stop" => compute.stop_instance(&region, &path.id).await?,
        "reboot" => compute.reboot_instance(&region, &path.id).await?,
        action => {
            return Err(CloudError::BadRequest(format!(
                "Unknown action: {}",
                action
            )));
        }
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "status": "accepted",
        "action": path.action,
        "instance_id": path.id,
    })))
}

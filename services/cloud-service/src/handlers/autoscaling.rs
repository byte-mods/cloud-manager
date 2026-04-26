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
pub struct CreateGroupRequest {
    pub name: String,
    pub min_size: Option<u32>,
    pub max_size: Option<u32>,
    pub desired_capacity: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct SetCapacityRequest {
    pub desired_capacity: u32,
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

/// GET /api/v1/cloud/{provider}/autoscaling/groups
pub async fn list_groups(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());

    let asg = providers::get_autoscaling_provider(provider, ctx.get_ref());
    let groups = asg.list_groups(&region).await?;
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: groups.len(),
        resources: groups,
        next_token: None,
    }))
}

/// GET /api/v1/cloud/{provider}/autoscaling/groups/{id}
pub async fn get_group(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());

    let asg = providers::get_autoscaling_provider(provider, ctx.get_ref());
    let group = asg.get_group(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(group))
}

/// POST /api/v1/cloud/{provider}/autoscaling/groups
pub async fn create_group(
    path: web::Path<ProviderPath>,
    body: web::Json<CreateGroupRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = default_region(provider, None);

    let asg = providers::get_autoscaling_provider(provider, ctx.get_ref());
    let group = asg.create_group(
        &region,
        &config.name,
        config.min_size.unwrap_or(1),
        config.max_size.unwrap_or(10),
        config.desired_capacity.unwrap_or(1),
    ).await?;
    Ok(HttpResponse::Created().json(group))
}

/// DELETE /api/v1/cloud/{provider}/autoscaling/groups/{id}
pub async fn delete_group(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());

    let asg = providers::get_autoscaling_provider(provider, ctx.get_ref());
    asg.delete_group(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// POST /api/v1/cloud/{provider}/autoscaling/groups/{id}/capacity
pub async fn set_capacity(
    path: web::Path<ResourcePath>,
    body: web::Json<SetCapacityRequest>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = default_region(provider, query.region.as_deref());

    let asg = providers::get_autoscaling_provider(provider, ctx.get_ref());
    asg.set_desired_capacity(&region, &path.id, config.desired_capacity).await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "capacity_updated"})))
}

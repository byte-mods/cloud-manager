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
pub struct StartExecutionRequest {
    pub input: serde_json::Value,
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

/// GET /api/v1/cloud/{provider}/workflows/state-machines
pub async fn list_state_machines(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let wf_provider = providers::get_workflow_provider(provider, ctx.get_ref());

    let machines = wf_provider.list_state_machines(&region).await?;
    let response = ResourceListResponse {
        total: machines.len(),
        resources: machines,
        next_token: None,
    };
    Ok(HttpResponse::Ok().json(response))
}

/// GET /api/v1/cloud/{provider}/workflows/state-machines/{id}
pub async fn get_state_machine(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let wf_provider = providers::get_workflow_provider(provider, ctx.get_ref());

    let machine = wf_provider.get_state_machine(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(machine))
}

/// POST /api/v1/cloud/{provider}/workflows/state-machines/{id}/executions
pub async fn start_execution(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    body: web::Json<StartExecutionRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let wf_provider = providers::get_workflow_provider(provider, ctx.get_ref());

    let execution = wf_provider
        .start_execution(&region, &path.id, body.into_inner().input)
        .await?;
    Ok(HttpResponse::Created().json(execution))
}

/// GET /api/v1/cloud/{provider}/workflows/state-machines/{id}/executions
pub async fn list_executions(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let wf_provider = providers::get_workflow_provider(provider, ctx.get_ref());

    let executions = wf_provider.list_executions(&region, &path.id).await?;
    let response = ResourceListResponse {
        total: executions.len(),
        resources: executions,
        next_token: None,
    };
    Ok(HttpResponse::Ok().json(response))
}

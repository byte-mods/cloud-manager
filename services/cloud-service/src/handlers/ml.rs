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
pub struct EndpointPath {
    pub provider: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct RegionQuery {
    pub region: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEndpointReq {
    pub name: String,
    pub model_name: String,
}

fn parse_provider(n: &str) -> Result<CloudProvider, CloudError> {
    CloudProvider::from_str(n).ok_or_else(|| CloudError::BadRequest(format!("Unknown provider: {n}")))
}

fn default_region(q: &RegionQuery) -> String {
    q.region.clone().unwrap_or_else(|| "us-east-1".to_string())
}

/// GET /api/v1/cloud/{provider}/ml/models
pub async fn list_models(
    p: web::Path<ProviderPath>,
    q: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&p.provider)?;
    let region = default_region(&q);
    let ml = crate::providers::get_ml_provider(provider, &ctx);
    let models = ml.list_models(&region).await?;
    let total = models.len();
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        resources: models,
        total,
        next_token: None,
    }))
}

/// GET /api/v1/cloud/{provider}/ml/endpoints
pub async fn list_endpoints(
    p: web::Path<ProviderPath>,
    q: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&p.provider)?;
    let region = default_region(&q);
    let ml = crate::providers::get_ml_provider(provider, &ctx);
    let endpoints = ml.list_endpoints(&region).await?;
    let total = endpoints.len();
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        resources: endpoints,
        total,
        next_token: None,
    }))
}

/// GET /api/v1/cloud/{provider}/ml/training-jobs
pub async fn list_training_jobs(
    p: web::Path<ProviderPath>,
    q: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&p.provider)?;
    let region = default_region(&q);
    let ml = crate::providers::get_ml_provider(provider, &ctx);
    let jobs = ml.list_training_jobs(&region).await?;
    let total = jobs.len();
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        resources: jobs,
        total,
        next_token: None,
    }))
}

/// POST /api/v1/cloud/{provider}/ml/endpoints
pub async fn create_endpoint(
    p: web::Path<ProviderPath>,
    q: web::Query<RegionQuery>,
    body: web::Json<CreateEndpointReq>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&p.provider)?;
    let region = default_region(&q);
    let ml = crate::providers::get_ml_provider(provider, &ctx);
    let endpoint = ml.create_endpoint(&region, &body.name, &body.model_name).await?;
    Ok(HttpResponse::Created().json(endpoint))
}

/// DELETE /api/v1/cloud/{provider}/ml/endpoints/{name}
pub async fn delete_endpoint(
    p: web::Path<EndpointPath>,
    q: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&p.provider)?;
    let region = default_region(&q);
    let ml = crate::providers::get_ml_provider(provider, &ctx);
    ml.delete_endpoint(&region, &p.name).await?;
    Ok(HttpResponse::NoContent().finish())
}

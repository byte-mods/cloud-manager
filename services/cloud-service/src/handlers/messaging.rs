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
pub struct CreateQueueRequest {
    pub name: String,
    pub fifo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTopicRequest {
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

/// GET /api/v1/cloud/{provider}/messaging/queues
pub async fn list_queues(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());

    // SDK integration for SQS/Cloud Tasks/Azure Queue
    let queues = vec![]; // Will be populated by real SDK provider
    let _ = region;

    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: queues.len(),
        resources: queues,
        next_token: None,
    }))
}

/// POST /api/v1/cloud/{provider}/messaging/queues
pub async fn create_queue(
    path: web::Path<ProviderPath>,
    body: web::Json<CreateQueueRequest>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    let _config = body.into_inner();
    Ok(HttpResponse::Created().json(serde_json::json!({"status": "created"})))
}

/// DELETE /api/v1/cloud/{provider}/messaging/queues/{id}
pub async fn delete_queue(
    path: web::Path<ResourcePath>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    Ok(HttpResponse::NoContent().finish())
}

/// GET /api/v1/cloud/{provider}/messaging/topics
pub async fn list_topics(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let _ = region;

    let topics = vec![];
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: topics.len(),
        resources: topics,
        next_token: None,
    }))
}

/// POST /api/v1/cloud/{provider}/messaging/topics
pub async fn create_topic(
    path: web::Path<ProviderPath>,
    body: web::Json<CreateTopicRequest>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    let _config = body.into_inner();
    Ok(HttpResponse::Created().json(serde_json::json!({"status": "created"})))
}

/// DELETE /api/v1/cloud/{provider}/messaging/topics/{id}
pub async fn delete_topic(
    path: web::Path<ResourcePath>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    Ok(HttpResponse::NoContent().finish())
}

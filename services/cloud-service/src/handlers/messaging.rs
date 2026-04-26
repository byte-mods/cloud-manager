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
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());

    let messaging = providers::get_messaging_provider(provider, ctx.get_ref());
    let queues = messaging.list_queues(&region).await?;

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
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = default_region(provider, None);

    let messaging = providers::get_messaging_provider(provider, ctx.get_ref());
    let queue = messaging.create_queue(&region, &config.name, config.fifo.unwrap_or(false)).await?;

    Ok(HttpResponse::Created().json(queue))
}

/// DELETE /api/v1/cloud/{provider}/messaging/queues/{id}
pub async fn delete_queue(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());

    let messaging = providers::get_messaging_provider(provider, ctx.get_ref());
    messaging.delete_queue(&region, &path.id).await?;

    Ok(HttpResponse::NoContent().finish())
}

/// GET /api/v1/cloud/{provider}/messaging/topics
pub async fn list_topics(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());

    let messaging = providers::get_messaging_provider(provider, ctx.get_ref());
    let topics = messaging.list_topics(&region).await?;

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
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = default_region(provider, None);

    let messaging = providers::get_messaging_provider(provider, ctx.get_ref());
    let topic = messaging.create_topic(&region, &config.name).await?;

    Ok(HttpResponse::Created().json(topic))
}

/// DELETE /api/v1/cloud/{provider}/messaging/topics/{id}
pub async fn delete_topic(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());

    let messaging = providers::get_messaging_provider(provider, ctx.get_ref());
    messaging.delete_topic(&region, &path.id).await?;

    Ok(HttpResponse::NoContent().finish())
}

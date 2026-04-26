use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::sync::Arc;

use crate::error::CloudError;
use crate::models::{CloudProvider, CreateFunctionRequest, ResourceListResponse};
use crate::providers;
use crate::providers::ProviderContext;

#[derive(Debug, Deserialize)]
pub struct ProviderPath {
    pub provider: String,
}

#[derive(Debug, Deserialize)]
pub struct ResourcePath {
    pub provider: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct RegionQuery {
    pub region: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct InvokeReq {
    pub payload: Option<serde_json::Value>,
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

/// GET /api/v1/cloud/{provider}/serverless/functions
pub async fn list_functions(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let serverless = providers::get_serverless_provider(provider, ctx.get_ref());

    let functions = serverless.list_functions(&region).await?;
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: functions.len(),
        resources: functions,
        next_token: None,
    }))
}

/// GET /api/v1/cloud/{provider}/serverless/functions/{name}
pub async fn get_function(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let serverless = providers::get_serverless_provider(provider, ctx.get_ref());

    let function = serverless.get_function(&region, &path.name).await?;
    Ok(HttpResponse::Ok().json(function))
}

/// POST /api/v1/cloud/{provider}/serverless/functions
pub async fn create_function(
    path: web::Path<ProviderPath>,
    body: web::Json<CreateFunctionRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = "us-east-1".to_string(); // default; could come from config
    let serverless = providers::get_serverless_provider(provider, ctx.get_ref());

    let function = serverless.create_function(&region, config).await?;
    Ok(HttpResponse::Created().json(function))
}

/// PUT /api/v1/cloud/{provider}/serverless/functions/{name}/code
pub async fn update_code(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    body: web::Bytes,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let serverless = providers::get_serverless_provider(provider, ctx.get_ref());

    let function = serverless.update_function_code(&region, &path.name, body.to_vec()).await?;
    Ok(HttpResponse::Ok().json(function))
}

/// DELETE /api/v1/cloud/{provider}/serverless/functions/{name}
pub async fn delete_function(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let serverless = providers::get_serverless_provider(provider, ctx.get_ref());

    serverless.delete_function(&region, &path.name).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// POST /api/v1/cloud/{provider}/serverless/functions/{name}/invoke
pub async fn invoke_function(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    body: web::Json<InvokeReq>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let serverless = providers::get_serverless_provider(provider, ctx.get_ref());

    let payload = body.into_inner().payload.unwrap_or(serde_json::Value::Null);
    let result = serverless.invoke_function(&region, &path.name, payload).await?;
    Ok(HttpResponse::Ok().json(result))
}

/// GET /api/v1/cloud/{provider}/serverless/functions/{name}/versions
pub async fn list_versions(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let serverless = providers::get_serverless_provider(provider, ctx.get_ref());

    let versions = serverless.list_function_versions(&region, &path.name).await?;
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: versions.len(),
        resources: versions,
        next_token: None,
    }))
}

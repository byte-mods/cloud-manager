use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::sync::Arc;

use crate::error::CloudError;
use crate::models::{CloudProvider, CreateNoSqlTableRequest, ResourceListResponse};
use crate::providers;
use crate::providers::ProviderContext;

#[derive(Debug, Deserialize)]
pub struct ProviderPath {
    pub provider: String,
}

#[derive(Debug, Deserialize)]
pub struct TablePath {
    pub provider: String,
    pub name: String,
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

/// GET /api/v1/cloud/{provider}/nosql/tables
pub async fn list_tables(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let nosql_provider = providers::get_nosql_provider(provider, ctx.get_ref());

    let tables = nosql_provider.list_tables(&region).await?;
    let response = ResourceListResponse {
        total: tables.len(),
        resources: tables,
        next_token: None,
    };

    Ok(HttpResponse::Ok().json(response))
}

/// GET /api/v1/cloud/{provider}/nosql/tables/{name}
pub async fn get_table(
    path: web::Path<TablePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let nosql_provider = providers::get_nosql_provider(provider, ctx.get_ref());

    let table = nosql_provider.get_table(&region, &path.name).await?;
    Ok(HttpResponse::Ok().json(table))
}

/// POST /api/v1/cloud/{provider}/nosql/tables
pub async fn create_table(
    path: web::Path<ProviderPath>,
    body: web::Json<CreateNoSqlTableRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let req = body.into_inner();
    let nosql_provider = providers::get_nosql_provider(provider, ctx.get_ref());

    let table = nosql_provider
        .create_table(&req.region, &req.name, req.key_schema)
        .await?;
    Ok(HttpResponse::Created().json(table))
}

/// DELETE /api/v1/cloud/{provider}/nosql/tables/{name}
pub async fn delete_table(
    path: web::Path<TablePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let nosql_provider = providers::get_nosql_provider(provider, ctx.get_ref());

    nosql_provider.delete_table(&region, &path.name).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// GET /api/v1/cloud/{provider}/nosql/tables/{name}/describe
pub async fn describe_table(
    path: web::Path<TablePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let nosql_provider = providers::get_nosql_provider(provider, ctx.get_ref());

    let description = nosql_provider.describe_table(&region, &path.name).await?;
    Ok(HttpResponse::Ok().json(description))
}

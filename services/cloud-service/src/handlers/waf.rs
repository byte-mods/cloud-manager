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
pub struct CreateWebAclRequest {
    pub name: String,
    pub default_action: Option<String>,
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

/// GET /api/v1/cloud/{provider}/waf/acls
pub async fn list_web_acls(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let waf = providers::get_waf_provider(provider, ctx.get_ref());

    let acls = waf.list_web_acls(&region).await?;
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: acls.len(),
        resources: acls,
        next_token: None,
    }))
}

/// GET /api/v1/cloud/{provider}/waf/acls/{id}
pub async fn get_web_acl(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let waf = providers::get_waf_provider(provider, ctx.get_ref());

    let acl = waf.get_web_acl(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(acl))
}

/// GET /api/v1/cloud/{provider}/waf/acls/{id}/rules
pub async fn list_rules(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let waf = providers::get_waf_provider(provider, ctx.get_ref());

    let rules = waf.list_rules(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: rules.len(),
        resources: rules,
        next_token: None,
    }))
}

/// POST /api/v1/cloud/{provider}/waf/acls
pub async fn create_web_acl(
    path: web::Path<ProviderPath>,
    body: web::Json<CreateWebAclRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = default_region(provider, None);
    let waf = providers::get_waf_provider(provider, ctx.get_ref());

    let acl = waf.create_web_acl(&region, &config.name).await?;
    Ok(HttpResponse::Created().json(acl))
}

/// DELETE /api/v1/cloud/{provider}/waf/acls/{id}
pub async fn delete_web_acl(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let waf = providers::get_waf_provider(provider, ctx.get_ref());

    waf.delete_web_acl(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

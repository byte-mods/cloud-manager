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
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let _ = region;

    let acls = vec![];
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
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let _ = region;

    let acls = vec![];
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: acls.len(),
        resources: acls,
        next_token: None,
    }))
}

/// GET /api/v1/cloud/{provider}/waf/acls/{id}/rules
pub async fn list_rules(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let _ = region;

    let rules = vec![];
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
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    let _config = body.into_inner();
    Ok(HttpResponse::Created().json(serde_json::json!({"status": "created"})))
}

/// DELETE /api/v1/cloud/{provider}/waf/acls/{id}
pub async fn delete_web_acl(
    path: web::Path<ResourcePath>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    Ok(HttpResponse::NoContent().finish())
}

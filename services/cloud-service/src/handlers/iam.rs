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
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct RegionQuery {
    pub region: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateRoleRequest {
    pub name: String,
    pub trust_policy: String,
}

#[derive(Debug, Deserialize)]
pub struct AttachPolicyRequest {
    pub target: String,
    pub policy_arn: String,
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

/// GET /api/v1/cloud/{provider}/iam/users
pub async fn list_users(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let _ = region;

    let users = vec![];
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: users.len(),
        resources: users,
        next_token: None,
    }))
}

/// POST /api/v1/cloud/{provider}/iam/users
pub async fn create_user(
    path: web::Path<ProviderPath>,
    body: web::Json<CreateUserRequest>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    let _config = body.into_inner();
    Ok(HttpResponse::Created().json(serde_json::json!({"status": "created"})))
}

/// DELETE /api/v1/cloud/{provider}/iam/users/{name}
pub async fn delete_user(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    let _region = default_region(_provider, query.region.as_deref());
    Ok(HttpResponse::NoContent().finish())
}

/// GET /api/v1/cloud/{provider}/iam/roles
pub async fn list_roles(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let _ = region;

    let roles = vec![];
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: roles.len(),
        resources: roles,
        next_token: None,
    }))
}

/// POST /api/v1/cloud/{provider}/iam/roles
pub async fn create_role(
    path: web::Path<ProviderPath>,
    body: web::Json<CreateRoleRequest>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    let _config = body.into_inner();
    Ok(HttpResponse::Created().json(serde_json::json!({"status": "created"})))
}

/// DELETE /api/v1/cloud/{provider}/iam/roles/{name}
pub async fn delete_role(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    let _region = default_region(_provider, query.region.as_deref());
    Ok(HttpResponse::NoContent().finish())
}

/// GET /api/v1/cloud/{provider}/iam/policies
pub async fn list_policies(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let _ = region;

    let policies = vec![];
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: policies.len(),
        resources: policies,
        next_token: None,
    }))
}

/// POST /api/v1/cloud/{provider}/iam/attach-policy
pub async fn attach_policy(
    path: web::Path<ProviderPath>,
    body: web::Json<AttachPolicyRequest>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    let _config = body.into_inner();
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "policy_attached"})))
}

/// POST /api/v1/cloud/{provider}/iam/detach-policy
pub async fn detach_policy(
    path: web::Path<ProviderPath>,
    body: web::Json<AttachPolicyRequest>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    let _config = body.into_inner();
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "policy_detached"})))
}

use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::sync::Arc;

use crate::error::CloudError;
use crate::models::{CloudProvider, CreateBucketRequest, ResourceListResponse, UploadObjectRequest};
use crate::providers;
use crate::providers::ProviderContext;

#[derive(Debug, Deserialize)]
pub struct PolicyBody {
    pub policy: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct LifecycleBody {
    pub rules: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct EncryptionBody {
    pub enabled: bool,
}

#[derive(Debug, Deserialize)]
pub struct CorsBody {
    pub rules: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct ProviderPath {
    pub provider: String,
}

#[derive(Debug, Deserialize)]
pub struct BucketPath {
    pub provider: String,
    pub id: String,
}

#[derive(Debug, Deserialize)]
pub struct ObjectPath {
    pub provider: String,
    pub bucket: String,
    pub key: String,
}

#[derive(Debug, Deserialize)]
pub struct RegionQuery {
    pub region: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListObjectsQuery {
    pub region: Option<String>,
    pub prefix: Option<String>,
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

/// GET /api/v1/cloud/{provider}/storage/buckets
pub async fn list_buckets(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let storage = providers::get_storage_provider(provider, ctx.get_ref());

    let buckets = storage.list_buckets(&region).await?;
    let response = ResourceListResponse {
        total: buckets.len(),
        resources: buckets,
        next_token: None,
    };

    Ok(HttpResponse::Ok().json(response))
}

/// GET /api/v1/cloud/{provider}/storage/buckets/{id}
pub async fn get_bucket(
    path: web::Path<BucketPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let storage = providers::get_storage_provider(provider, ctx.get_ref());

    let bucket = storage.get_bucket(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(bucket))
}

/// POST /api/v1/cloud/{provider}/storage/buckets
pub async fn create_bucket(
    path: web::Path<ProviderPath>,
    body: web::Json<CreateBucketRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = config.region.clone();
    let storage = providers::get_storage_provider(provider, ctx.get_ref());

    let bucket = storage.create_bucket(&region, config).await?;
    Ok(HttpResponse::Created().json(bucket))
}

/// DELETE /api/v1/cloud/{provider}/storage/buckets/{id}
pub async fn delete_bucket(
    path: web::Path<BucketPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let storage = providers::get_storage_provider(provider, ctx.get_ref());

    storage.delete_bucket(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// GET /api/v1/cloud/{provider}/storage/buckets/{bucket}/objects
pub async fn list_objects(
    path: web::Path<BucketPath>,
    query: web::Query<ListObjectsQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let storage = providers::get_storage_provider(provider, ctx.get_ref());

    let objects = storage
        .list_objects(&region, &path.id, query.prefix.as_deref())
        .await?;
    let response = ResourceListResponse {
        total: objects.len(),
        resources: objects,
        next_token: None,
    };

    Ok(HttpResponse::Ok().json(response))
}

/// POST /api/v1/cloud/{provider}/storage/buckets/{bucket}/objects
pub async fn upload_object(
    path: web::Path<BucketPath>,
    query: web::Query<RegionQuery>,
    body: web::Json<UploadObjectRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let storage = providers::get_storage_provider(provider, ctx.get_ref());

    // In production, this would handle multipart upload with actual file data
    let request = body.into_inner();
    let object = storage
        .upload_object(&region, &path.id, request, vec![])
        .await?;
    Ok(HttpResponse::Created().json(object))
}

/// DELETE /api/v1/cloud/{provider}/storage/buckets/{bucket}/objects/{key}
pub async fn delete_object(
    path: web::Path<ObjectPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let storage = providers::get_storage_provider(provider, ctx.get_ref());

    storage
        .delete_object(&region, &path.bucket, &path.key)
        .await?;
    Ok(HttpResponse::NoContent().finish())
}

/// GET /api/v1/cloud/{provider}/storage/buckets/{id}/policy
pub async fn get_bucket_policy(
    path: web::Path<BucketPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let storage = providers::get_storage_provider(provider, ctx.get_ref());
    let policy = storage.get_bucket_policy(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(policy))
}

/// PUT /api/v1/cloud/{provider}/storage/buckets/{id}/policy
pub async fn put_bucket_policy(
    path: web::Path<BucketPath>,
    query: web::Query<RegionQuery>,
    body: web::Json<PolicyBody>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let storage = providers::get_storage_provider(provider, ctx.get_ref());
    let policy_str = serde_json::to_string(&body.policy)
        .map_err(|e| CloudError::BadRequest(e.to_string()))?;
    storage.put_bucket_policy(&region, &path.id, &policy_str).await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "updated"})))
}

/// DELETE /api/v1/cloud/{provider}/storage/buckets/{id}/policy
pub async fn delete_bucket_policy(
    path: web::Path<BucketPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let storage = providers::get_storage_provider(provider, ctx.get_ref());
    storage.delete_bucket_policy(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// GET /api/v1/cloud/{provider}/storage/buckets/{id}/lifecycle
pub async fn get_lifecycle_rules(
    path: web::Path<BucketPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let storage = providers::get_storage_provider(provider, ctx.get_ref());
    let rules = storage.get_lifecycle_rules(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({"rules": rules})))
}

/// PUT /api/v1/cloud/{provider}/storage/buckets/{id}/lifecycle
pub async fn put_lifecycle_rules(
    path: web::Path<BucketPath>,
    query: web::Query<RegionQuery>,
    body: web::Json<LifecycleBody>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let storage = providers::get_storage_provider(provider, ctx.get_ref());
    storage.put_lifecycle_rules(&region, &path.id, body.into_inner().rules).await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "updated"})))
}

/// GET /api/v1/cloud/{provider}/storage/buckets/{id}/encryption
pub async fn get_bucket_encryption(
    path: web::Path<BucketPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let storage = providers::get_storage_provider(provider, ctx.get_ref());
    let encryption = storage.get_bucket_encryption(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(encryption))
}

/// PUT /api/v1/cloud/{provider}/storage/buckets/{id}/encryption
pub async fn put_bucket_encryption(
    path: web::Path<BucketPath>,
    query: web::Query<RegionQuery>,
    body: web::Json<EncryptionBody>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let storage = providers::get_storage_provider(provider, ctx.get_ref());
    storage.put_bucket_encryption(&region, &path.id, body.enabled).await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "updated"})))
}

/// GET /api/v1/cloud/{provider}/storage/buckets/{id}/cors
pub async fn get_cors_rules(
    path: web::Path<BucketPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let storage = providers::get_storage_provider(provider, ctx.get_ref());
    let cors = storage.get_cors_rules(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(cors))
}

/// PUT /api/v1/cloud/{provider}/storage/buckets/{id}/cors
pub async fn put_cors_rules(
    path: web::Path<BucketPath>,
    query: web::Query<RegionQuery>,
    body: web::Json<CorsBody>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let storage = providers::get_storage_provider(provider, ctx.get_ref());
    storage.put_cors_rules(&region, &path.id, body.into_inner().rules).await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "updated"})))
}

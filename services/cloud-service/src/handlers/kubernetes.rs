use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::sync::Arc;

use crate::error::CloudError;
use crate::models::{CloudProvider, CreateClusterRequest, CreateNodeGroupRequest, ResourceListResponse, ScaleNodeGroupRequest};
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
pub struct ClusterResPath {
    pub provider: String,
    pub cluster: String,
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

/// GET /api/v1/cloud/{provider}/kubernetes/clusters
pub async fn list_clusters(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let k8s = providers::get_kubernetes_provider(provider, ctx.get_ref());

    let clusters = k8s.list_clusters(&region).await?;
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: clusters.len(),
        resources: clusters,
        next_token: None,
    }))
}

/// GET /api/v1/cloud/{provider}/kubernetes/clusters/{id}
pub async fn get_cluster(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let k8s = providers::get_kubernetes_provider(provider, ctx.get_ref());

    let cluster = k8s.get_cluster(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(cluster))
}

/// POST /api/v1/cloud/{provider}/kubernetes/clusters
pub async fn create_cluster(
    path: web::Path<ProviderPath>,
    body: web::Json<CreateClusterRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = "us-east-1".to_string();
    let k8s = providers::get_kubernetes_provider(provider, ctx.get_ref());

    let cluster = k8s.create_cluster(&region, config).await?;
    Ok(HttpResponse::Created().json(cluster))
}

/// DELETE /api/v1/cloud/{provider}/kubernetes/clusters/{id}
pub async fn delete_cluster(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let k8s = providers::get_kubernetes_provider(provider, ctx.get_ref());

    k8s.delete_cluster(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// GET /api/v1/cloud/{provider}/kubernetes/clusters/{id}/node-groups
pub async fn list_node_groups(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let k8s = providers::get_kubernetes_provider(provider, ctx.get_ref());

    let groups = k8s.list_node_groups(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        total: groups.len(),
        resources: groups,
        next_token: None,
    }))
}

/// POST /api/v1/cloud/{provider}/kubernetes/clusters/{id}/node-groups
pub async fn create_node_group(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    body: web::Json<CreateNodeGroupRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let k8s = providers::get_kubernetes_provider(provider, ctx.get_ref());
    let config = body.into_inner();

    let group = k8s.create_node_group(&region, &path.id, config).await?;
    Ok(HttpResponse::Created().json(group))
}

/// DELETE /api/v1/cloud/{provider}/kubernetes/clusters/{cluster}/node-groups/{name}
pub async fn delete_node_group(
    path: web::Path<ClusterResPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let k8s = providers::get_kubernetes_provider(provider, ctx.get_ref());

    k8s.delete_node_group(&region, &path.cluster, &path.name).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// POST /api/v1/cloud/{provider}/kubernetes/clusters/{cluster}/node-groups/{name}/scale
pub async fn scale_node_group(
    path: web::Path<ClusterResPath>,
    query: web::Query<RegionQuery>,
    body: web::Json<ScaleNodeGroupRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let k8s = providers::get_kubernetes_provider(provider, ctx.get_ref());
    let config = body.into_inner();

    k8s.scale_node_group(&region, &path.cluster, &path.name, config.desired).await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "status": "scaling",
        "cluster": path.cluster,
        "node_group": path.name,
        "desired": config.desired,
    })))
}

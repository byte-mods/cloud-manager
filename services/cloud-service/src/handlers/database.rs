use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::sync::Arc;

use crate::error::CloudError;
use crate::models::{CloudProvider, CreateDatabaseRequest, ResourceListResponse};
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
pub struct ActionPath {
    pub provider: String,
    pub id: String,
    pub action: String,
}

#[derive(Debug, Deserialize)]
pub struct RegionQuery {
    pub region: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SnapshotRequest {
    pub snapshot_name: String,
}

#[derive(Debug, Deserialize)]
pub struct ReadReplicaRequest {
    pub replica_name: String,
}

#[derive(Debug, Deserialize)]
pub struct RestoreRequest {
    pub target_name: String,
    pub restore_time: String,
}

#[derive(Debug, Deserialize)]
pub struct ParameterGroupPath {
    pub provider: String,
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

/// GET /api/v1/cloud/{provider}/database/instances
pub async fn list_databases(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let db_provider = providers::get_database_provider(provider, ctx.get_ref());

    let databases = db_provider.list_databases(&region).await?;
    let response = ResourceListResponse {
        total: databases.len(),
        resources: databases,
        next_token: None,
    };

    Ok(HttpResponse::Ok().json(response))
}

/// GET /api/v1/cloud/{provider}/database/instances/{id}
pub async fn get_database(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let db_provider = providers::get_database_provider(provider, ctx.get_ref());

    let database = db_provider.get_database(&region, &path.id).await?;
    Ok(HttpResponse::Ok().json(database))
}

/// POST /api/v1/cloud/{provider}/database/instances
pub async fn create_database(
    path: web::Path<ProviderPath>,
    body: web::Json<CreateDatabaseRequest>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let config = body.into_inner();
    let region = config.region.clone();
    let db_provider = providers::get_database_provider(provider, ctx.get_ref());

    let database = db_provider.create_database(&region, config).await?;
    Ok(HttpResponse::Created().json(database))
}

/// DELETE /api/v1/cloud/{provider}/database/instances/{id}
pub async fn delete_database(
    path: web::Path<ResourcePath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let db_provider = providers::get_database_provider(provider, ctx.get_ref());

    db_provider.delete_database(&region, &path.id).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// POST /api/v1/cloud/{provider}/database/instances/{id}/actions/{action}
pub async fn database_action(
    path: web::Path<ActionPath>,
    query: web::Query<RegionQuery>,
    body: web::Json<serde_json::Value>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let db_provider = providers::get_database_provider(provider, ctx.get_ref());

    match path.action.as_str() {
        "restart" => {
            db_provider.restart_database(&region, &path.id).await?;
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "status": "accepted",
                "action": "restart",
                "database_id": path.id,
            })))
        }
        "snapshot" => {
            let snapshot_req: SnapshotRequest =
                serde_json::from_value(body.into_inner()).map_err(|e| {
                    CloudError::BadRequest(format!("Invalid snapshot request: {}", e))
                })?;
            let snapshot = db_provider
                .create_snapshot(&region, &path.id, &snapshot_req.snapshot_name)
                .await?;
            Ok(HttpResponse::Created().json(snapshot))
        }
        "read-replica" => {
            let req: ReadReplicaRequest =
                serde_json::from_value(body.into_inner()).map_err(|e| {
                    CloudError::BadRequest(format!("Invalid read-replica request: {}", e))
                })?;
            let replica = db_provider
                .create_read_replica(&region, &path.id, &req.replica_name)
                .await?;
            Ok(HttpResponse::Created().json(replica))
        }
        "restore" => {
            let req: RestoreRequest =
                serde_json::from_value(body.into_inner()).map_err(|e| {
                    CloudError::BadRequest(format!("Invalid restore request: {}", e))
                })?;
            let restored = db_provider
                .restore_to_point_in_time(&region, &path.id, &req.target_name, &req.restore_time)
                .await?;
            Ok(HttpResponse::Created().json(restored))
        }
        action => Err(CloudError::BadRequest(format!(
            "Unknown database action: {}",
            action
        ))),
    }
}

/// GET /api/v1/cloud/{provider}/database/parameter-groups
pub async fn list_parameter_groups(
    path: web::Path<ProviderPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let db_provider = providers::get_database_provider(provider, ctx.get_ref());

    let groups = db_provider.list_parameter_groups(&region).await?;
    let response = ResourceListResponse {
        total: groups.len(),
        resources: groups,
        next_token: None,
    };
    Ok(HttpResponse::Ok().json(response))
}

/// GET /api/v1/cloud/{provider}/database/parameter-groups/{name}
pub async fn get_parameter_group(
    path: web::Path<ParameterGroupPath>,
    query: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&path.provider)?;
    let region = default_region(provider, query.region.as_deref());
    let db_provider = providers::get_database_provider(provider, ctx.get_ref());

    let group = db_provider.get_parameter_group(&region, &path.name).await?;
    Ok(HttpResponse::Ok().json(group))
}

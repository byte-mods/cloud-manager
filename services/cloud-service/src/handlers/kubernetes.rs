use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::sync::Arc;

use crate::error::CloudError;
use crate::models::{CloudProvider, ResourceListResponse};
use crate::providers::ProviderContext;

#[derive(Debug, Deserialize)] pub struct ProviderPath { pub provider: String }
#[derive(Debug, Deserialize)] pub struct ResourcePath { pub provider: String, pub id: String }
#[derive(Debug, Deserialize)] pub struct ClusterResPath { pub provider: String, pub cluster: String, pub name: String }
#[derive(Debug, Deserialize)] pub struct RegionQuery { pub region: Option<String> }
#[derive(Debug, Deserialize)] pub struct CreateClusterReq { pub name: String }
#[derive(Debug, Deserialize)] pub struct CreateNodeGroupReq { pub name: String }
#[derive(Debug, Deserialize)] pub struct ScaleReq { pub desired: i32 }

fn parse_provider(n: &str) -> Result<CloudProvider, CloudError> { CloudProvider::from_str(n).ok_or_else(|| CloudError::BadRequest(format!("Unknown: {n}"))) }

pub async fn list_clusters(_p: web::Path<ProviderPath>, _q: web::Query<RegionQuery>, _c: web::Data<Arc<ProviderContext>>) -> Result<HttpResponse, CloudError> { parse_provider(&_p.provider)?; Ok(HttpResponse::Ok().json(ResourceListResponse { resources: vec![], total: 0, next_token: None })) }
pub async fn get_cluster(p: web::Path<ResourcePath>, _c: web::Data<Arc<ProviderContext>>) -> Result<HttpResponse, CloudError> { parse_provider(&p.provider)?; Ok(HttpResponse::Ok().json(serde_json::json!({"id": p.id}))) }
pub async fn create_cluster(p: web::Path<ProviderPath>, _b: web::Json<CreateClusterReq>, _c: web::Data<Arc<ProviderContext>>) -> Result<HttpResponse, CloudError> { parse_provider(&p.provider)?; Ok(HttpResponse::Created().json(serde_json::json!({"status":"created"}))) }
pub async fn delete_cluster(p: web::Path<ResourcePath>, _c: web::Data<Arc<ProviderContext>>) -> Result<HttpResponse, CloudError> { parse_provider(&p.provider)?; Ok(HttpResponse::NoContent().finish()) }
pub async fn list_node_groups(p: web::Path<ResourcePath>, _c: web::Data<Arc<ProviderContext>>) -> Result<HttpResponse, CloudError> { parse_provider(&p.provider)?; Ok(HttpResponse::Ok().json(ResourceListResponse { resources: vec![], total: 0, next_token: None })) }
pub async fn create_node_group(p: web::Path<ResourcePath>, _b: web::Json<CreateNodeGroupReq>, _c: web::Data<Arc<ProviderContext>>) -> Result<HttpResponse, CloudError> { parse_provider(&p.provider)?; Ok(HttpResponse::Created().json(serde_json::json!({"status":"created"}))) }
pub async fn delete_node_group(p: web::Path<ClusterResPath>, _c: web::Data<Arc<ProviderContext>>) -> Result<HttpResponse, CloudError> { parse_provider(&p.provider)?; Ok(HttpResponse::NoContent().finish()) }
pub async fn scale_node_group(p: web::Path<ClusterResPath>, _b: web::Json<ScaleReq>, _c: web::Data<Arc<ProviderContext>>) -> Result<HttpResponse, CloudError> { parse_provider(&p.provider)?; Ok(HttpResponse::Ok().json(serde_json::json!({"status":"scaling"}))) }

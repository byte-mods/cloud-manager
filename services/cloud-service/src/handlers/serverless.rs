use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::sync::Arc;

use crate::error::CloudError;
use crate::models::{CloudProvider, ResourceListResponse};
use crate::providers::ProviderContext;

#[derive(Debug, Deserialize)] pub struct ProviderPath { pub provider: String }
#[derive(Debug, Deserialize)] pub struct ResourcePath { pub provider: String, pub name: String }
#[derive(Debug, Deserialize)] pub struct RegionQuery { pub region: Option<String> }
#[derive(Debug, Deserialize)] pub struct CreateFunctionReq { pub name: String, pub runtime: Option<String>, pub handler: Option<String> }
#[derive(Debug, Deserialize)] pub struct InvokeReq { pub payload: Option<serde_json::Value> }

fn parse_provider(n: &str) -> Result<CloudProvider, CloudError> { CloudProvider::from_str(n).ok_or_else(|| CloudError::BadRequest(format!("Unknown: {n}"))) }

pub async fn list_functions(_p: web::Path<ProviderPath>, _q: web::Query<RegionQuery>, _c: web::Data<Arc<ProviderContext>>) -> Result<HttpResponse, CloudError> { parse_provider(&_p.provider)?; Ok(HttpResponse::Ok().json(ResourceListResponse { resources: vec![], total: 0, next_token: None })) }
pub async fn get_function(p: web::Path<ResourcePath>, _c: web::Data<Arc<ProviderContext>>) -> Result<HttpResponse, CloudError> { parse_provider(&p.provider)?; Ok(HttpResponse::Ok().json(serde_json::json!({"name": p.name}))) }
pub async fn create_function(p: web::Path<ProviderPath>, _b: web::Json<CreateFunctionReq>, _c: web::Data<Arc<ProviderContext>>) -> Result<HttpResponse, CloudError> { parse_provider(&p.provider)?; Ok(HttpResponse::Created().json(serde_json::json!({"status":"created"}))) }
pub async fn update_code(p: web::Path<ResourcePath>, _c: web::Data<Arc<ProviderContext>>) -> Result<HttpResponse, CloudError> { parse_provider(&p.provider)?; Ok(HttpResponse::Ok().json(serde_json::json!({"status":"updated"}))) }
pub async fn delete_function(p: web::Path<ResourcePath>, _c: web::Data<Arc<ProviderContext>>) -> Result<HttpResponse, CloudError> { parse_provider(&p.provider)?; Ok(HttpResponse::NoContent().finish()) }
pub async fn invoke_function(p: web::Path<ResourcePath>, _b: web::Json<InvokeReq>, _c: web::Data<Arc<ProviderContext>>) -> Result<HttpResponse, CloudError> { parse_provider(&p.provider)?; Ok(HttpResponse::Ok().json(serde_json::json!({"status":"invoked","result":null}))) }
pub async fn list_versions(p: web::Path<ResourcePath>, _c: web::Data<Arc<ProviderContext>>) -> Result<HttpResponse, CloudError> { parse_provider(&p.provider)?; Ok(HttpResponse::Ok().json(ResourceListResponse { resources: vec![], total: 0, next_token: None })) }

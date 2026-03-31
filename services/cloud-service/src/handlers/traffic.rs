use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::sync::Arc;

use crate::error::CloudError;
use crate::models::CloudProvider;
use crate::providers::ProviderContext;

#[derive(Debug, Deserialize)] pub struct ProviderPath { pub provider: String }
#[derive(Debug, Deserialize)] pub struct RegionQuery { pub region: Option<String> }

fn parse_provider(n: &str) -> Result<CloudProvider, CloudError> { CloudProvider::from_str(n).ok_or_else(|| CloudError::BadRequest(format!("Unknown: {n}"))) }

pub async fn list_flow_logs(_p: web::Path<ProviderPath>, _q: web::Query<RegionQuery>, _c: web::Data<Arc<ProviderContext>>) -> Result<HttpResponse, CloudError> {
    parse_provider(&_p.provider)?;
    Ok(HttpResponse::Ok().json(serde_json::json!({"flow_logs": [], "total": 0})))
}

pub async fn get_traffic_summary(_p: web::Path<ProviderPath>, _q: web::Query<RegionQuery>, _c: web::Data<Arc<ProviderContext>>) -> Result<HttpResponse, CloudError> {
    parse_provider(&_p.provider)?;
    Ok(HttpResponse::Ok().json(serde_json::json!({"summary": {"total_bytes_in": 0, "total_bytes_out": 0, "top_talkers": [], "services": []}})))
}

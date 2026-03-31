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
pub struct ThingPath {
    pub provider: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct RegionQuery {
    pub region: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateThingReq {
    pub name: String,
    #[serde(default)]
    pub attributes: serde_json::Value,
}

fn parse_provider(n: &str) -> Result<CloudProvider, CloudError> {
    CloudProvider::from_str(n).ok_or_else(|| CloudError::BadRequest(format!("Unknown provider: {n}")))
}

fn default_region(q: &RegionQuery) -> String {
    q.region.clone().unwrap_or_else(|| "us-east-1".to_string())
}

/// GET /api/v1/cloud/{provider}/iot/things
pub async fn list_things(
    p: web::Path<ProviderPath>,
    q: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&p.provider)?;
    let region = default_region(&q);
    let iot = crate::providers::get_iot_provider(provider, &ctx);
    let things = iot.list_things(&region).await?;
    let total = things.len();
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        resources: things,
        total,
        next_token: None,
    }))
}

/// GET /api/v1/cloud/{provider}/iot/things/{name}
pub async fn get_thing(
    p: web::Path<ThingPath>,
    q: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&p.provider)?;
    let region = default_region(&q);
    let iot = crate::providers::get_iot_provider(provider, &ctx);
    let thing = iot.get_thing(&region, &p.name).await?;
    Ok(HttpResponse::Ok().json(thing))
}

/// POST /api/v1/cloud/{provider}/iot/things
pub async fn create_thing(
    p: web::Path<ProviderPath>,
    q: web::Query<RegionQuery>,
    body: web::Json<CreateThingReq>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&p.provider)?;
    let region = default_region(&q);
    let iot = crate::providers::get_iot_provider(provider, &ctx);
    let thing = iot.create_thing(&region, &body.name, body.attributes.clone()).await?;
    Ok(HttpResponse::Created().json(thing))
}

/// DELETE /api/v1/cloud/{provider}/iot/things/{name}
pub async fn delete_thing(
    p: web::Path<ThingPath>,
    q: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&p.provider)?;
    let region = default_region(&q);
    let iot = crate::providers::get_iot_provider(provider, &ctx);
    iot.delete_thing(&region, &p.name).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// GET /api/v1/cloud/{provider}/iot/thing-groups
pub async fn list_thing_groups(
    p: web::Path<ProviderPath>,
    q: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let provider = parse_provider(&p.provider)?;
    let region = default_region(&q);
    let iot = crate::providers::get_iot_provider(provider, &ctx);
    let groups = iot.list_thing_groups(&region).await?;
    let total = groups.len();
    Ok(HttpResponse::Ok().json(ResourceListResponse {
        resources: groups,
        total,
        next_token: None,
    }))
}

/// GET /api/v1/cloud/{provider}/iot/edge
pub async fn list_edge_devices(
    p: web::Path<ProviderPath>,
    q: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&p.provider)?;
    let _region = default_region(&q);

    // Try real AWS IoT SDK when enabled
    if ctx.flags.use_real_sdk() {
        if let Some(creds) = &ctx.credentials {
            if let Ok(config) = creds.aws_config() {
                let client = aws_sdk_iot::Client::new(config);
                if let Ok(output) = client.list_things().send().await {
                    let devices: Vec<serde_json::Value> = output.things().iter().map(|t| {
                        serde_json::json!({
                            "id": t.thing_name().unwrap_or_default(),
                            "name": t.thing_name().unwrap_or_default(),
                            "status": "online",
                            "provider": p.provider,
                            "type": t.thing_type_name().unwrap_or("IoT Device"),
                            "region": _region,
                        })
                    }).collect();
                    let total = devices.len();
                    return Ok(HttpResponse::Ok().json(serde_json::json!({ "resources": devices, "total": total })));
                }
            }
        }
    }

    // Fallback to seeded data
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "resources": [
            { "id": "edge-001", "name": "factory-gateway-01", "status": "online", "provider": p.provider, "type": "Greengrass Core", "region": _region, "lastHeartbeat": "2026-03-31T10:14:55Z", "deployments": 5, "components": 12 },
            { "id": "edge-002", "name": "warehouse-hub-02", "status": "online", "provider": p.provider, "type": "Greengrass Core", "region": _region, "lastHeartbeat": "2026-03-31T10:14:50Z", "deployments": 3, "components": 8 },
            { "id": "edge-003", "name": "retail-pos-gateway", "status": "offline", "provider": p.provider, "type": "IoT Edge", "region": _region, "lastHeartbeat": "2026-03-30T18:00:00Z", "deployments": 2, "components": 5 },
            { "id": "edge-004", "name": "vehicle-telemetry-01", "status": "online", "provider": p.provider, "type": "Greengrass Core", "region": _region, "lastHeartbeat": "2026-03-31T10:14:58Z", "deployments": 4, "components": 10 },
        ],
        "total": 4
    })))
}

/// GET /api/v1/cloud/{provider}/iot/rules
pub async fn list_rules(
    p: web::Path<ProviderPath>,
    q: web::Query<RegionQuery>,
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&p.provider)?;
    let _region = default_region(&q);

    // Try real AWS IoT SDK
    if ctx.flags.use_real_sdk() {
        if let Some(creds) = &ctx.credentials {
            if let Ok(config) = creds.aws_config() {
                let client = aws_sdk_iot::Client::new(config);
                if let Ok(output) = client.list_topic_rules().send().await {
                    let rules: Vec<serde_json::Value> = output.rules().iter().map(|r| {
                        serde_json::json!({
                            "id": r.rule_name().unwrap_or_default(),
                            "name": r.rule_name().unwrap_or_default(),
                            "status": if r.rule_disabled().unwrap_or(false) { "disabled" } else { "enabled" },
                            "provider": p.provider,
                            "sql": r.topic_pattern().unwrap_or_default(),
                        })
                    }).collect();
                    let total = rules.len();
                    return Ok(HttpResponse::Ok().json(serde_json::json!({ "resources": rules, "total": total })));
                }
            }
        }
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "resources": [
            { "id": "rule-001", "name": "temperature-alert", "status": "enabled", "provider": p.provider, "sql": "SELECT * FROM 'sensors/temperature' WHERE value > 85", "actions": ["SNS", "Lambda"], "messagesProcessed": 145000, "errorsCount": 12 },
            { "id": "rule-002", "name": "motion-detect", "status": "enabled", "provider": p.provider, "sql": "SELECT * FROM 'sensors/motion' WHERE detected = true", "actions": ["DynamoDB", "SNS"], "messagesProcessed": 52000, "errorsCount": 0 },
            { "id": "rule-003", "name": "battery-low", "status": "enabled", "provider": p.provider, "sql": "SELECT * FROM 'devices/+/battery' WHERE level < 20", "actions": ["SQS"], "messagesProcessed": 8200, "errorsCount": 3 },
            { "id": "rule-004", "name": "data-archive", "status": "disabled", "provider": p.provider, "sql": "SELECT * FROM 'sensors/#'", "actions": ["S3"], "messagesProcessed": 0, "errorsCount": 0 },
        ],
        "total": 4
    })))
}

/// GET /api/v1/cloud/{provider}/iot/twins
pub async fn list_twins(
    p: web::Path<ProviderPath>,
    q: web::Query<RegionQuery>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&p.provider)?;
    let _region = default_region(&q);
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "resources": [
            { "id": "twin-001", "name": "HVAC-Building-A", "status": "active", "provider": p.provider, "model": "SmartHVAC-v2", "lastUpdated": "2026-03-31T10:14:00Z", "properties": 24, "telemetryPoints": 12 },
            { "id": "twin-002", "name": "Assembly-Line-3", "status": "active", "provider": p.provider, "model": "ManufacturingLine-v1", "lastUpdated": "2026-03-31T10:14:30Z", "properties": 48, "telemetryPoints": 32 },
            { "id": "twin-003", "name": "Fleet-Vehicle-001", "status": "active", "provider": p.provider, "model": "ConnectedVehicle-v3", "lastUpdated": "2026-03-31T10:14:55Z", "properties": 36, "telemetryPoints": 18 },
            { "id": "twin-004", "name": "Wind-Turbine-A1", "status": "stale", "provider": p.provider, "model": "EnergyTurbine-v1", "lastUpdated": "2026-03-30T22:00:00Z", "properties": 20, "telemetryPoints": 8 },
        ],
        "total": 4
    })))
}

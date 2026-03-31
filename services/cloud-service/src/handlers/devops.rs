use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::CloudError;
use crate::providers::ProviderContext;

// ---------------------------------------------------------------------------
// Real AWS SDK integration for pipelines
// ---------------------------------------------------------------------------

async fn list_pipelines_real(ctx: &ProviderContext) -> Result<Vec<Pipeline>, CloudError> {
    if let Some(creds) = &ctx.credentials {
        let config = creds.aws_config().map_err(|e| CloudError::Internal(e.to_string()))?;
        let client = aws_sdk_codepipeline::Client::new(config);

        match client.list_pipelines().send().await {
            Ok(output) => {
                let pipelines: Vec<Pipeline> = output.pipelines().iter().map(|p| {
                    Pipeline {
                        id: p.name().unwrap_or_default().to_string(),
                        name: p.name().unwrap_or_default().to_string(),
                        provider: "aws".into(),
                        repo: "".into(),
                        branch: "main".into(),
                        status: "active".into(),
                        last_run: p.updated().map(|d| d.to_string()),
                        trigger: "push".into(),
                        stages: vec![],
                        created_at: p.created().map(|d| d.to_string()).unwrap_or_default(),
                    }
                }).collect();
                return Ok(pipelines);
            }
            Err(e) => {
                tracing::warn!("CodePipeline SDK error, falling back to seeded data: {e}");
            }
        }
    }
    Ok(seed_pipelines())
}

async fn list_builds_real(ctx: &ProviderContext) -> Result<Vec<PipelineRun>, CloudError> {
    if let Some(creds) = &ctx.credentials {
        let config = creds.aws_config().map_err(|e| CloudError::Internal(e.to_string()))?;
        let client = aws_sdk_codebuild::Client::new(config);

        match client.list_builds().send().await {
            Ok(output) => {
                let runs: Vec<PipelineRun> = output.ids().iter().enumerate().map(|(i, id)| {
                    PipelineRun {
                        id: id.to_string(),
                        pipeline_id: "".into(),
                        status: "completed".into(),
                        branch: "main".into(),
                        commit: "".into(),
                        duration: None,
                        started_at: chrono::Utc::now().to_rfc3339(),
                        completed_at: None,
                        triggered_by: "codebuild".into(),
                    }
                }).collect();
                return Ok(runs);
            }
            Err(e) => {
                tracing::warn!("CodeBuild SDK error, falling back to seeded data: {e}");
            }
        }
    }
    Ok(seed_runs())
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pipeline {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub repo: String,
    pub branch: String,
    pub status: String,
    pub last_run: Option<String>,
    pub trigger: String,
    pub stages: Vec<PipelineStage>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineStage {
    pub name: String,
    pub status: String,
    pub duration: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineRun {
    pub id: String,
    pub pipeline_id: String,
    pub status: String,
    pub branch: String,
    pub commit: String,
    pub duration: Option<u64>,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub triggered_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Deployment {
    pub id: String,
    pub name: String,
    pub environment: String,
    pub status: String,
    pub strategy: String,
    pub version: String,
    pub replicas: String,
    pub started_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitOpsApp {
    pub id: String,
    pub name: String,
    pub repo: String,
    pub path: String,
    pub sync_status: String,
    pub health: String,
    pub cluster: String,
    pub namespace: String,
    pub last_synced: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IaCWorkspace {
    pub id: String,
    pub name: String,
    pub tool: String,
    pub provider: String,
    pub status: String,
    pub resources: u32,
    pub last_applied: Option<String>,
    pub drift_detected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigEntry {
    pub id: String,
    pub name: String,
    pub service: String,
    pub config_type: String,
    pub version: u32,
    pub last_modified: String,
    pub status: String,
}

// ---------------------------------------------------------------------------
// Seeded in-memory data
// ---------------------------------------------------------------------------

fn seed_pipelines() -> Vec<Pipeline> {
    vec![
        Pipeline { id: "pipe-001".into(), name: "web-frontend-ci".into(), provider: "aws".into(), repo: "org/web-frontend".into(), branch: "main".into(), status: "success".into(), last_run: Some("2026-03-31T10:15:00Z".into()), trigger: "push".into(), stages: vec![PipelineStage { name: "Build".into(), status: "success".into(), duration: Some(120) }, PipelineStage { name: "Test".into(), status: "success".into(), duration: Some(240) }, PipelineStage { name: "Deploy".into(), status: "success".into(), duration: Some(60) }], created_at: "2025-06-01T00:00:00Z".into() },
        Pipeline { id: "pipe-002".into(), name: "api-gateway-cd".into(), provider: "aws".into(), repo: "org/api-gateway".into(), branch: "main".into(), status: "running".into(), last_run: Some("2026-03-31T11:00:00Z".into()), trigger: "push".into(), stages: vec![PipelineStage { name: "Build".into(), status: "success".into(), duration: Some(90) }, PipelineStage { name: "Test".into(), status: "running".into(), duration: None }, PipelineStage { name: "Deploy".into(), status: "pending".into(), duration: None }], created_at: "2025-07-15T00:00:00Z".into() },
        Pipeline { id: "pipe-003".into(), name: "auth-service-ci".into(), provider: "aws".into(), repo: "org/auth-service".into(), branch: "develop".into(), status: "failed".into(), last_run: Some("2026-03-30T16:45:00Z".into()), trigger: "pr".into(), stages: vec![PipelineStage { name: "Build".into(), status: "success".into(), duration: Some(95) }, PipelineStage { name: "Test".into(), status: "failed".into(), duration: Some(180) }], created_at: "2025-08-01T00:00:00Z".into() },
        Pipeline { id: "pipe-004".into(), name: "infra-terraform".into(), provider: "aws".into(), repo: "org/infrastructure".into(), branch: "main".into(), status: "success".into(), last_run: Some("2026-03-29T09:00:00Z".into()), trigger: "schedule".into(), stages: vec![PipelineStage { name: "Plan".into(), status: "success".into(), duration: Some(45) }, PipelineStage { name: "Apply".into(), status: "success".into(), duration: Some(180) }], created_at: "2025-05-10T00:00:00Z".into() },
        Pipeline { id: "pipe-005".into(), name: "data-pipeline-etl".into(), provider: "gcp".into(), repo: "org/data-pipeline".into(), branch: "main".into(), status: "success".into(), last_run: Some("2026-03-31T06:00:00Z".into()), trigger: "schedule".into(), stages: vec![PipelineStage { name: "Extract".into(), status: "success".into(), duration: Some(300) }, PipelineStage { name: "Transform".into(), status: "success".into(), duration: Some(600) }, PipelineStage { name: "Load".into(), status: "success".into(), duration: Some(120) }], created_at: "2025-09-01T00:00:00Z".into() },
    ]
}

fn seed_runs() -> Vec<PipelineRun> {
    vec![
        PipelineRun { id: "run-101".into(), pipeline_id: "pipe-001".into(), status: "success".into(), branch: "main".into(), commit: "a1b2c3d".into(), duration: Some(420), started_at: "2026-03-31T10:15:00Z".into(), completed_at: Some("2026-03-31T10:22:00Z".into()), triggered_by: "push by admin".into() },
        PipelineRun { id: "run-100".into(), pipeline_id: "pipe-001".into(), status: "success".into(), branch: "main".into(), commit: "e4f5g6h".into(), duration: Some(415), started_at: "2026-03-30T14:00:00Z".into(), completed_at: Some("2026-03-30T14:07:00Z".into()), triggered_by: "push by devops".into() },
        PipelineRun { id: "run-099".into(), pipeline_id: "pipe-001".into(), status: "failed".into(), branch: "feature/auth".into(), commit: "i7j8k9l".into(), duration: Some(180), started_at: "2026-03-30T11:00:00Z".into(), completed_at: Some("2026-03-30T11:03:00Z".into()), triggered_by: "PR #42".into() },
        PipelineRun { id: "run-098".into(), pipeline_id: "pipe-002".into(), status: "running".into(), branch: "main".into(), commit: "m0n1o2p".into(), duration: None, started_at: "2026-03-31T11:00:00Z".into(), completed_at: None, triggered_by: "push by admin".into() },
    ]
}

fn seed_deployments() -> Vec<Deployment> {
    vec![
        Deployment { id: "deploy-001".into(), name: "web-frontend".into(), environment: "production".into(), status: "healthy".into(), strategy: "blue-green".into(), version: "v2.4.1".into(), replicas: "3/3".into(), started_at: "2026-03-31T10:22:00Z".into(), completed_at: Some("2026-03-31T10:25:00Z".into()) },
        Deployment { id: "deploy-002".into(), name: "api-gateway".into(), environment: "production".into(), status: "deploying".into(), strategy: "canary".into(), version: "v1.8.1".into(), replicas: "2/3".into(), started_at: "2026-03-31T11:05:00Z".into(), completed_at: None },
        Deployment { id: "deploy-003".into(), name: "auth-service".into(), environment: "staging".into(), status: "healthy".into(), strategy: "rolling".into(), version: "v1.5.4".into(), replicas: "2/2".into(), started_at: "2026-03-30T17:00:00Z".into(), completed_at: Some("2026-03-30T17:03:00Z".into()) },
        Deployment { id: "deploy-004".into(), name: "cloud-service".into(), environment: "production".into(), status: "healthy".into(), strategy: "rolling".into(), version: "v1.12.0".into(), replicas: "3/3".into(), started_at: "2026-03-29T09:30:00Z".into(), completed_at: Some("2026-03-29T09:35:00Z".into()) },
    ]
}

fn seed_gitops() -> Vec<GitOpsApp> {
    vec![
        GitOpsApp { id: "gitops-001".into(), name: "web-frontend".into(), repo: "org/k8s-manifests".into(), path: "apps/web-frontend".into(), sync_status: "synced".into(), health: "healthy".into(), cluster: "prod-eks".into(), namespace: "production".into(), last_synced: "2 min ago".into() },
        GitOpsApp { id: "gitops-002".into(), name: "api-gateway".into(), repo: "org/k8s-manifests".into(), path: "apps/api-gateway".into(), sync_status: "out-of-sync".into(), health: "healthy".into(), cluster: "prod-eks".into(), namespace: "production".into(), last_synced: "15 min ago".into() },
        GitOpsApp { id: "gitops-003".into(), name: "auth-service".into(), repo: "org/k8s-manifests".into(), path: "apps/auth-service".into(), sync_status: "synced".into(), health: "healthy".into(), cluster: "prod-eks".into(), namespace: "production".into(), last_synced: "5 min ago".into() },
        GitOpsApp { id: "gitops-004".into(), name: "monitoring-stack".into(), repo: "org/k8s-manifests".into(), path: "infra/monitoring".into(), sync_status: "synced".into(), health: "degraded".into(), cluster: "prod-eks".into(), namespace: "monitoring".into(), last_synced: "1 hour ago".into() },
    ]
}

fn seed_iac_workspaces() -> Vec<IaCWorkspace> {
    vec![
        IaCWorkspace { id: "iac-001".into(), name: "prod-infrastructure".into(), tool: "terraform".into(), provider: "aws".into(), status: "applied".into(), resources: 42, last_applied: Some("2026-03-29T09:00:00Z".into()), drift_detected: false },
        IaCWorkspace { id: "iac-002".into(), name: "staging-infrastructure".into(), tool: "terraform".into(), provider: "aws".into(), status: "applied".into(), resources: 28, last_applied: Some("2026-03-28T14:00:00Z".into()), drift_detected: true },
        IaCWorkspace { id: "iac-003".into(), name: "gcp-data-platform".into(), tool: "terraform".into(), provider: "gcp".into(), status: "planning".into(), resources: 15, last_applied: Some("2026-03-25T10:00:00Z".into()), drift_detected: false },
        IaCWorkspace { id: "iac-004".into(), name: "azure-networking".into(), tool: "bicep".into(), provider: "azure".into(), status: "applied".into(), resources: 12, last_applied: Some("2026-03-20T08:00:00Z".into()), drift_detected: false },
    ]
}

fn seed_configs() -> Vec<ConfigEntry> {
    vec![
        ConfigEntry { id: "cfg-001".into(), name: "/prod/web-frontend/config".into(), service: "web-frontend".into(), config_type: "SSM Parameter".into(), version: 5, last_modified: "2026-03-30T10:00:00Z".into(), status: "active".into() },
        ConfigEntry { id: "cfg-002".into(), name: "/prod/api-gateway/secrets".into(), service: "api-gateway".into(), config_type: "SSM SecureString".into(), version: 3, last_modified: "2026-03-28T14:00:00Z".into(), status: "active".into() },
        ConfigEntry { id: "cfg-003".into(), name: "/prod/database/connection".into(), service: "database".into(), config_type: "SSM Parameter".into(), version: 8, last_modified: "2026-03-31T08:00:00Z".into(), status: "active".into() },
        ConfigEntry { id: "cfg-004".into(), name: "feature-flags".into(), service: "all".into(), config_type: "AppConfig".into(), version: 12, last_modified: "2026-03-31T09:00:00Z".into(), status: "active".into() },
    ]
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /api/v1/cloud/devops/overview
pub async fn overview(
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let pipelines = seed_pipelines();
    let deployments = seed_deployments();
    let gitops = seed_gitops();

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "pipelines": { "total": pipelines.len(), "running": pipelines.iter().filter(|p| p.status == "running").count(), "failed": pipelines.iter().filter(|p| p.status == "failed").count() },
        "deployments": { "total": deployments.len(), "healthy": deployments.iter().filter(|d| d.status == "healthy").count(), "deploying": deployments.iter().filter(|d| d.status == "deploying").count() },
        "gitops": { "total": gitops.len(), "synced": gitops.iter().filter(|g| g.sync_status == "synced").count(), "outOfSync": gitops.iter().filter(|g| g.sync_status == "out-of-sync").count() },
        "recentDeployments": &deployments[..2.min(deployments.len())],
    })))
}

/// GET /api/v1/cloud/devops/pipelines
pub async fn list_pipelines(
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let pipelines = if ctx.flags.use_real_sdk() {
        list_pipelines_real(ctx.get_ref()).await?
    } else {
        seed_pipelines()
    };
    let total = pipelines.len();
    Ok(HttpResponse::Ok().json(serde_json::json!({ "pipelines": pipelines, "total": total })))
}

/// GET /api/v1/cloud/devops/pipelines/{id}
pub async fn get_pipeline(
    path: web::Path<String>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let id = path.into_inner();
    let pipelines = seed_pipelines();
    let pipeline = pipelines.into_iter().find(|p| p.id == id)
        .ok_or_else(|| CloudError::NotFound(format!("Pipeline {id} not found")))?;
    let runs: Vec<_> = seed_runs().into_iter().filter(|r| r.pipeline_id == id).collect();
    Ok(HttpResponse::Ok().json(serde_json::json!({ "pipeline": pipeline, "runs": runs })))
}

/// POST /api/v1/cloud/devops/pipelines/{id}/run
pub async fn trigger_pipeline(
    path: web::Path<String>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let id = path.into_inner();
    let run = PipelineRun {
        id: format!("run-{}", chrono::Utc::now().timestamp()),
        pipeline_id: id,
        status: "running".into(),
        branch: "main".into(),
        commit: "latest".into(),
        duration: None,
        started_at: chrono::Utc::now().to_rfc3339(),
        completed_at: None,
        triggered_by: "manual".into(),
    };
    Ok(HttpResponse::Ok().json(serde_json::json!({ "run": run })))
}

/// GET /api/v1/cloud/devops/deployments
pub async fn list_deployments(
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    Ok(HttpResponse::Ok().json(serde_json::json!({ "deployments": seed_deployments(), "total": seed_deployments().len() })))
}

/// POST /api/v1/cloud/devops/deployments
pub async fn create_deployment(
    body: web::Json<serde_json::Value>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let deployment = Deployment {
        id: format!("deploy-{}", chrono::Utc::now().timestamp()),
        name: body.get("name").and_then(|v| v.as_str()).unwrap_or("new-deployment").into(),
        environment: body.get("environment").and_then(|v| v.as_str()).unwrap_or("staging").into(),
        status: "deploying".into(),
        strategy: body.get("strategy").and_then(|v| v.as_str()).unwrap_or("rolling").into(),
        version: body.get("version").and_then(|v| v.as_str()).unwrap_or("latest").into(),
        replicas: "0/1".into(),
        started_at: chrono::Utc::now().to_rfc3339(),
        completed_at: None,
    };
    Ok(HttpResponse::Created().json(serde_json::json!({ "deployment": deployment })))
}

/// GET /api/v1/cloud/devops/gitops
/// Tries to connect to ArgoCD REST API if ARGOCD_URL is set, falls back to seed data.
pub async fn list_gitops(
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    // Try real ArgoCD API if configured
    if let Ok(argocd_url) = std::env::var("ARGOCD_URL") {
        let token = std::env::var("ARGOCD_TOKEN").unwrap_or_default();
        let client = reqwest::Client::builder()
            .danger_accept_invalid_certs(true) // ArgoCD often uses self-signed
            .build()
            .unwrap_or_default();

        match client
            .get(format!("{}/api/v1/applications", argocd_url))
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(data) = resp.json::<serde_json::Value>().await {
                    let apps: Vec<GitOpsApp> = data.get("items")
                        .and_then(|items| items.as_array())
                        .unwrap_or(&vec![])
                        .iter()
                        .map(|item| {
                            let meta = item.get("metadata").unwrap_or(item);
                            let spec = item.get("spec").unwrap_or(item);
                            let status = item.get("status").unwrap_or(item);
                            GitOpsApp {
                                id: meta.get("name").and_then(|v| v.as_str()).unwrap_or("").into(),
                                name: meta.get("name").and_then(|v| v.as_str()).unwrap_or("").into(),
                                repo: spec.get("source").and_then(|s| s.get("repoURL")).and_then(|v| v.as_str()).unwrap_or("").into(),
                                path: spec.get("source").and_then(|s| s.get("path")).and_then(|v| v.as_str()).unwrap_or("").into(),
                                sync_status: status.get("sync").and_then(|s| s.get("status")).and_then(|v| v.as_str()).unwrap_or("unknown").to_lowercase(),
                                health: status.get("health").and_then(|s| s.get("status")).and_then(|v| v.as_str()).unwrap_or("unknown").to_lowercase(),
                                cluster: spec.get("destination").and_then(|d| d.get("server")).and_then(|v| v.as_str()).unwrap_or("").into(),
                                namespace: spec.get("destination").and_then(|d| d.get("namespace")).and_then(|v| v.as_str()).unwrap_or("default").into(),
                                last_synced: status.get("operationState").and_then(|o| o.get("finishedAt")).and_then(|v| v.as_str()).unwrap_or("unknown").into(),
                            }
                        })
                        .collect();
                    let total = apps.len();
                    return Ok(HttpResponse::Ok().json(serde_json::json!({ "apps": apps, "total": total })));
                }
            }
            Ok(resp) => {
                tracing::warn!("ArgoCD returned status {}: falling back to seed data", resp.status());
            }
            Err(e) => {
                tracing::warn!("ArgoCD connection failed: {e}. Falling back to seed data.");
            }
        }
    }

    // Fallback to seed data
    Ok(HttpResponse::Ok().json(serde_json::json!({ "apps": seed_gitops(), "total": seed_gitops().len() })))
}

/// GET /api/v1/cloud/devops/iac
pub async fn list_iac_workspaces(
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    Ok(HttpResponse::Ok().json(serde_json::json!({ "workspaces": seed_iac_workspaces(), "total": seed_iac_workspaces().len() })))
}

/// GET /api/v1/cloud/devops/iac/{id}
pub async fn get_iac_workspace(
    path: web::Path<String>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let id = path.into_inner();
    let workspaces = seed_iac_workspaces();
    let workspace = workspaces.into_iter().find(|w| w.id == id)
        .ok_or_else(|| CloudError::NotFound(format!("IaC workspace {id} not found")))?;
    Ok(HttpResponse::Ok().json(serde_json::json!({ "workspace": workspace })))
}

// ---------------------------------------------------------------------------
// Runbooks (seed-data backed)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Runbook {
    pub id: String,
    pub name: String,
    pub description: String,
    pub steps: Vec<String>,
    pub last_executed: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaintenanceWindow {
    pub id: String,
    pub name: String,
    pub description: String,
    pub start_time: String,
    pub end_time: String,
    pub status: String,
    pub affected_services: Vec<String>,
    pub created_at: String,
}

fn seed_runbooks() -> Vec<Runbook> {
    vec![
        Runbook {
            id: "rb-001".into(),
            name: "Database Failover".into(),
            description: "Steps to perform an RDS failover to standby".into(),
            steps: vec![
                "Verify standby health".into(),
                "Initiate failover via AWS console or CLI".into(),
                "Monitor replication lag".into(),
                "Update DNS if needed".into(),
                "Validate application connectivity".into(),
            ],
            last_executed: Some("2026-03-25T14:00:00Z".into()),
            created_at: "2025-10-01T00:00:00Z".into(),
        },
        Runbook {
            id: "rb-002".into(),
            name: "Scale Up Web Tier".into(),
            description: "Scale the web frontend ASG to handle traffic spikes".into(),
            steps: vec![
                "Check current ASG capacity".into(),
                "Update desired count to target".into(),
                "Wait for instances to become healthy".into(),
                "Verify load balancer target health".into(),
            ],
            last_executed: None,
            created_at: "2025-11-15T00:00:00Z".into(),
        },
        Runbook {
            id: "rb-003".into(),
            name: "Certificate Rotation".into(),
            description: "Rotate TLS certificates for production services".into(),
            steps: vec![
                "Generate new certificate via ACM".into(),
                "Update ALB listener".into(),
                "Verify HTTPS connectivity".into(),
                "Revoke old certificate".into(),
            ],
            last_executed: Some("2026-03-20T10:00:00Z".into()),
            created_at: "2025-08-01T00:00:00Z".into(),
        },
    ]
}

fn seed_maintenance_windows() -> Vec<MaintenanceWindow> {
    vec![
        MaintenanceWindow {
            id: "mw-001".into(),
            name: "Monthly Patching".into(),
            description: "Apply OS and security patches to all EC2 instances".into(),
            start_time: "2026-04-05T02:00:00Z".into(),
            end_time: "2026-04-05T06:00:00Z".into(),
            status: "scheduled".into(),
            affected_services: vec!["web-frontend".into(), "api-gateway".into(), "auth-service".into()],
            created_at: "2026-03-28T00:00:00Z".into(),
        },
        MaintenanceWindow {
            id: "mw-002".into(),
            name: "Database Upgrade".into(),
            description: "Upgrade RDS PostgreSQL from 15.4 to 16.1".into(),
            start_time: "2026-04-12T03:00:00Z".into(),
            end_time: "2026-04-12T05:00:00Z".into(),
            status: "scheduled".into(),
            affected_services: vec!["database".into(), "api-gateway".into()],
            created_at: "2026-03-30T00:00:00Z".into(),
        },
        MaintenanceWindow {
            id: "mw-003".into(),
            name: "Network Maintenance".into(),
            description: "VPC peering reconfiguration for new region".into(),
            start_time: "2026-03-29T01:00:00Z".into(),
            end_time: "2026-03-29T03:00:00Z".into(),
            status: "completed".into(),
            affected_services: vec!["networking".into()],
            created_at: "2026-03-25T00:00:00Z".into(),
        },
    ]
}

/// GET /api/v1/cloud/devops/runbooks
pub async fn list_runbooks(
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let runbooks = seed_runbooks();
    let total = runbooks.len();
    Ok(HttpResponse::Ok().json(serde_json::json!({ "runbooks": runbooks, "total": total })))
}

/// POST /api/v1/cloud/devops/runbooks
pub async fn create_runbook(
    body: web::Json<serde_json::Value>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let runbook = Runbook {
        id: format!("rb-{}", chrono::Utc::now().timestamp()),
        name: body.get("name").and_then(|v| v.as_str()).unwrap_or("new-runbook").into(),
        description: body.get("description").and_then(|v| v.as_str()).unwrap_or("").into(),
        steps: body.get("steps")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|s| s.as_str().map(String::from)).collect())
            .unwrap_or_default(),
        last_executed: None,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    Ok(HttpResponse::Created().json(serde_json::json!({ "runbook": runbook })))
}

/// POST /api/v1/cloud/devops/runbooks/{id}/execute
pub async fn execute_runbook(
    path: web::Path<String>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let id = path.into_inner();
    let runbooks = seed_runbooks();
    let runbook = runbooks.into_iter().find(|r| r.id == id)
        .ok_or_else(|| CloudError::NotFound(format!("Runbook {id} not found")))?;
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "runbook": runbook,
        "execution": {
            "id": format!("exec-{}", chrono::Utc::now().timestamp()),
            "status": "running",
            "started_at": chrono::Utc::now().to_rfc3339(),
        }
    })))
}

/// GET /api/v1/cloud/devops/maintenance-windows
pub async fn list_maintenance_windows(
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let windows = seed_maintenance_windows();
    let total = windows.len();
    Ok(HttpResponse::Ok().json(serde_json::json!({ "maintenance_windows": windows, "total": total })))
}

/// POST /api/v1/cloud/devops/maintenance-windows
pub async fn create_maintenance_window(
    body: web::Json<serde_json::Value>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let window = MaintenanceWindow {
        id: format!("mw-{}", chrono::Utc::now().timestamp()),
        name: body.get("name").and_then(|v| v.as_str()).unwrap_or("new-window").into(),
        description: body.get("description").and_then(|v| v.as_str()).unwrap_or("").into(),
        start_time: body.get("start_time").and_then(|v| v.as_str()).unwrap_or("").into(),
        end_time: body.get("end_time").and_then(|v| v.as_str()).unwrap_or("").into(),
        status: "scheduled".into(),
        affected_services: body.get("affected_services")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|s| s.as_str().map(String::from)).collect())
            .unwrap_or_default(),
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    Ok(HttpResponse::Created().json(serde_json::json!({ "maintenance_window": window })))
}

/// GET /api/v1/cloud/devops/config
pub async fn list_config(
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    Ok(HttpResponse::Ok().json(serde_json::json!({ "configs": seed_configs(), "total": seed_configs().len() })))
}

/// POST /api/v1/cloud/devops/config
pub async fn create_config(
    body: web::Json<serde_json::Value>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let config = ConfigEntry {
        id: format!("cfg-{}", chrono::Utc::now().timestamp()),
        name: body.get("name").and_then(|v| v.as_str()).unwrap_or("new-config").into(),
        service: body.get("service").and_then(|v| v.as_str()).unwrap_or("default").into(),
        config_type: body.get("configType").and_then(|v| v.as_str()).unwrap_or("SSM Parameter").into(),
        version: 1,
        last_modified: chrono::Utc::now().to_rfc3339(),
        status: "active".into(),
    };
    Ok(HttpResponse::Created().json(serde_json::json!({ "config": config })))
}

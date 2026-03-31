use actix_web::{web, HttpResponse};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::CloudError;
use crate::models::CloudProvider;
use crate::providers::ProviderContext;

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ChaosPath {
    pub provider: String,
    pub id: String,
}

#[derive(Debug, Deserialize)]
pub struct RunExperimentReq {
    /// The chaos action to perform.
    pub action: ChaosAction,
    /// Target resource identifier.
    pub target: String,
    /// Parameters for the action.
    #[serde(default)]
    pub parameters: serde_json::Value,
    /// If true, only validate but do not execute.
    #[serde(default)]
    pub dry_run: bool,
    /// Auto-rollback timeout in seconds (default 300).
    #[serde(default = "default_rollback_timeout")]
    pub rollback_timeout_seconds: u64,
}

fn default_rollback_timeout() -> u64 {
    300
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ChaosAction {
    InstanceTerminate,
    NetworkLatency,
    CpuStress,
    DiskFill,
    ProcessKill,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionStatus {
    DryRun,
    Running,
    Completed,
    Failed,
    RolledBack,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChaosExecutionResult {
    pub execution_id: String,
    pub experiment_id: String,
    pub action: ChaosAction,
    pub target: String,
    pub status: ExecutionStatus,
    pub dry_run: bool,
    pub started_at: chrono::DateTime<Utc>,
    pub completed_at: Option<chrono::DateTime<Utc>>,
    pub rollback_timeout_seconds: u64,
    pub output: serde_json::Value,
    pub timeline: Vec<TimelineEvent>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TimelineEvent {
    pub time: String,
    pub event: String,
}

// ---------------------------------------------------------------------------
// Safety helpers
// ---------------------------------------------------------------------------

/// Resources that must never be targeted.
const EXCLUDED_RESOURCES: &[&str] = &[
    "production-db-primary",
    "production-db-replica",
    "payment-gateway-prod",
];

fn validate_safety(target: &str) -> Result<(), CloudError> {
    for excluded in EXCLUDED_RESOURCES {
        if target.contains(excluded) {
            return Err(CloudError::BadRequest(format!(
                "Target '{}' is excluded from chaos experiments (matches '{}')",
                target, excluded
            )));
        }
    }
    Ok(())
}

fn parse_provider(n: &str) -> Result<CloudProvider, CloudError> {
    CloudProvider::from_str(n).ok_or_else(|| CloudError::BadRequest(format!("Unknown provider: {n}")))
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/// POST /api/v1/cloud/{provider}/chaos/experiments/{id}/run
pub async fn run_experiment(
    path: web::Path<ChaosPath>,
    body: web::Json<RunExperimentReq>,
    _ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let _provider = parse_provider(&path.provider)?;
    let experiment_id = path.id.clone();
    let req = body.into_inner();

    // Safety check
    validate_safety(&req.target)?;

    let execution_id = Uuid::new_v4().to_string();
    let started_at = Utc::now();

    // Dry-run mode: validate only
    if req.dry_run {
        let result = ChaosExecutionResult {
            execution_id,
            experiment_id,
            action: req.action,
            target: req.target,
            status: ExecutionStatus::DryRun,
            dry_run: true,
            started_at,
            completed_at: Some(Utc::now()),
            rollback_timeout_seconds: req.rollback_timeout_seconds,
            output: serde_json::json!({ "message": "Dry run completed — no changes made" }),
            timeline: vec![TimelineEvent {
                time: "0s".to_string(),
                event: "Dry run validation passed".to_string(),
            }],
        };
        return Ok(HttpResponse::Ok().json(result));
    }

    // Execute the chaos action (mock execution — real actions would use
    // tokio::process::Command or AWS SDK calls depending on the action type)
    let (status, output, timeline) = execute_action(&req.action, &req.target, &req.parameters);

    let result = ChaosExecutionResult {
        execution_id,
        experiment_id,
        action: req.action,
        target: req.target,
        status,
        dry_run: false,
        started_at,
        completed_at: Some(Utc::now()),
        rollback_timeout_seconds: req.rollback_timeout_seconds,
        output,
        timeline,
    };

    Ok(HttpResponse::Ok().json(result))
}

/// Simulate chaos action execution. In a real deployment these would shell out
/// to system tools or call cloud-provider SDK methods.
fn execute_action(
    action: &ChaosAction,
    target: &str,
    params: &serde_json::Value,
) -> (ExecutionStatus, serde_json::Value, Vec<TimelineEvent>) {
    match action {
        ChaosAction::InstanceTerminate => {
            // Real: ec2_client.terminate_instances().instance_ids(target).send().await
            let count = params.get("count").and_then(|v| v.as_u64()).unwrap_or(1);
            let timeline = vec![
                TimelineEvent { time: "0s".into(), event: format!("Terminating {} instance(s) on {}", count, target) },
                TimelineEvent { time: "2s".into(), event: "Terminate API call succeeded".into() },
                TimelineEvent { time: "5s".into(), event: "Instance(s) entering shutting-down state".into() },
                TimelineEvent { time: "30s".into(), event: "Instance(s) terminated".into() },
            ];
            (
                ExecutionStatus::Completed,
                serde_json::json!({
                    "terminated_count": count,
                    "target": target,
                    "command": format!("ec2.terminate_instances(instance_ids=[\"{}\"])", target),
                }),
                timeline,
            )
        }

        ChaosAction::NetworkLatency => {
            // Real: tokio::process::Command::new("tc") with qdisc netem delay
            let delay_ms = params.get("delay_ms").and_then(|v| v.as_u64()).unwrap_or(300);
            let jitter_ms = params.get("jitter_ms").and_then(|v| v.as_u64()).unwrap_or(50);
            let duration = params.get("duration_seconds").and_then(|v| v.as_u64()).unwrap_or(60);
            let timeline = vec![
                TimelineEvent { time: "0s".into(), event: format!("Injecting {}ms +/- {}ms latency on {}", delay_ms, jitter_ms, target) },
                TimelineEvent { time: "1s".into(), event: "tc qdisc rule applied".into() },
                TimelineEvent { time: format!("{}s", duration), event: "Latency injection removed".into() },
            ];
            (
                ExecutionStatus::Completed,
                serde_json::json!({
                    "delay_ms": delay_ms,
                    "jitter_ms": jitter_ms,
                    "duration_seconds": duration,
                    "command": format!("tc qdisc add dev eth0 root netem delay {}ms {}ms", delay_ms, jitter_ms),
                }),
                timeline,
            )
        }

        ChaosAction::CpuStress => {
            // Real: tokio::process::Command::new("stress-ng").args(["--cpu", "4", "--timeout", "60s"])
            let cpu_count = params.get("cpu_count").and_then(|v| v.as_u64()).unwrap_or(4);
            let duration = params.get("duration_seconds").and_then(|v| v.as_u64()).unwrap_or(60);
            let timeline = vec![
                TimelineEvent { time: "0s".into(), event: format!("Starting CPU stress on {} ({} cores)", target, cpu_count) },
                TimelineEvent { time: "5s".into(), event: "CPU utilization reached target".into() },
                TimelineEvent { time: format!("{}s", duration), event: "Stress test completed".into() },
            ];
            (
                ExecutionStatus::Completed,
                serde_json::json!({
                    "cpu_cores": cpu_count,
                    "duration_seconds": duration,
                    "command": format!("stress-ng --cpu {} --timeout {}s", cpu_count, duration),
                }),
                timeline,
            )
        }

        ChaosAction::DiskFill => {
            // Real: create temp files via tokio::fs
            let fill_percent = params.get("fill_percent").and_then(|v| v.as_u64()).unwrap_or(90);
            let duration = params.get("duration_seconds").and_then(|v| v.as_u64()).unwrap_or(120);
            let timeline = vec![
                TimelineEvent { time: "0s".into(), event: format!("Filling disk to {}% on {}", fill_percent, target) },
                TimelineEvent { time: "10s".into(), event: format!("Disk at {}% capacity", fill_percent) },
                TimelineEvent { time: format!("{}s", duration), event: "Temp files removed, disk restored".into() },
            ];
            (
                ExecutionStatus::Completed,
                serde_json::json!({
                    "fill_percent": fill_percent,
                    "duration_seconds": duration,
                    "command": format!("fallocate -l $(df --output=avail / | tail -1 | awk '{{print int($1*{}/100)}}')K /tmp/chaos-fill", fill_percent),
                }),
                timeline,
            )
        }

        ChaosAction::ProcessKill => {
            // Real: tokio::process::Command::new("kill").args(["-SIGKILL", &pid])
            let signal = params.get("signal").and_then(|v| v.as_str()).unwrap_or("SIGTERM");
            let process_name = params.get("process_name").and_then(|v| v.as_str()).unwrap_or("target-process");
            let timeline = vec![
                TimelineEvent { time: "0s".into(), event: format!("Sending {} to '{}' on {}", signal, process_name, target) },
                TimelineEvent { time: "1s".into(), event: "Signal delivered".into() },
                TimelineEvent { time: "5s".into(), event: "Process confirmed terminated".into() },
            ];
            (
                ExecutionStatus::Completed,
                serde_json::json!({
                    "signal": signal,
                    "process_name": process_name,
                    "command": format!("kill -{} $(pgrep -f {})", signal, process_name),
                }),
                timeline,
            )
        }
    }
}

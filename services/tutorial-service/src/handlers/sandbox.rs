use actix_web::{web, HttpResponse};
use uuid::Uuid;

use crate::error::TutorialError;
use crate::models::progress::{SandboxRequest, SandboxResponse};

/// POST /api/v1/learn/sandbox/provision
///
/// Provisions a sandbox environment for hands-on tutorials.
/// In production, this would integrate with a sandbox provider (e.g., Instruqt, Katacoda).
pub async fn provision_sandbox(
    body: web::Json<SandboxRequest>,
) -> Result<HttpResponse, TutorialError> {
    let request = body.into_inner();

    tracing::info!(
        tutorial_id = %request.tutorial_id,
        provider = %request.provider,
        "Provisioning sandbox environment"
    );

    // Stub: in production, this would call an external sandbox provisioning API.
    let sandbox_id = Uuid::new_v4();
    let expires_at = chrono::Utc::now() + chrono::Duration::hours(2);

    let response = SandboxResponse {
        sandbox_id,
        url: format!(
            "https://sandbox.cloudmanager.dev/env/{sandbox_id}?provider={}&tutorial={}",
            request.provider, request.tutorial_id
        ),
        status: "provisioning".to_string(),
        expires_at,
    };

    Ok(HttpResponse::Accepted().json(response))
}

/// POST /api/v1/learn/sandbox/execute
///
/// Execute a command in the sandbox environment.
/// Supports: aws, terraform, kubectl, gcloud, az CLI commands.
/// Runs the actual binary if installed, otherwise returns a helpful error.
pub async fn execute_command(
    body: web::Json<serde_json::Value>,
) -> Result<HttpResponse, TutorialError> {
    let command = body.get("command").and_then(|v| v.as_str()).unwrap_or("");

    if command.is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "No command provided"
        })));
    }

    // Security: only allow whitelisted commands
    let allowed_prefixes = ["aws ", "terraform ", "kubectl ", "gcloud ", "az ", "helm ", "docker ", "curl ", "jq ", "echo ", "cat ", "ls ", "pwd", "whoami", "date", "env", "which "];
    let is_allowed = allowed_prefixes.iter().any(|p| command.starts_with(p)) || command == "help";

    if !is_allowed {
        return Ok(HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Command not allowed in sandbox",
            "allowed": allowed_prefixes,
        })));
    }

    // Parse command into program + args
    let parts: Vec<&str> = command.splitn(2, ' ').collect();
    let program = parts[0];
    let args = parts.get(1).unwrap_or(&"");

    // Execute the command
    match tokio::process::Command::new("sh")
        .arg("-c")
        .arg(command)
        .output()
        .await
    {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();

            Ok(HttpResponse::Ok().json(serde_json::json!({
                "command": command,
                "stdout": stdout,
                "stderr": stderr,
                "exitCode": output.status.code().unwrap_or(-1),
                "success": output.status.success(),
            })))
        }
        Err(e) => {
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "command": command,
                "stdout": "",
                "stderr": format!("{program}: command not found. Install it to use in sandbox.\nError: {e}"),
                "exitCode": 127,
                "success": false,
            })))
        }
    }
}

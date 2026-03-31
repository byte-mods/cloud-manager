use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::process::Command;

// ── Request / Response types ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct TerraformValidateRequest {
    pub hcl: String,
}

#[derive(Debug, Deserialize)]
pub struct TerraformPlanRequest {
    pub hcl: String,
}

#[derive(Debug, Deserialize)]
pub struct TerraformApplyRequest {
    pub hcl: String,
    /// Must be true to execute apply. Acts as a safety gate.
    pub confirmed: bool,
}

#[derive(Debug, Serialize)]
struct TerraformResponse {
    success: bool,
    stdout: String,
    stderr: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

// ── Helpers ──────────────────────────────────────────────────────────────

/// Write HCL content into a temporary directory and return the path.
async fn prepare_temp_dir(hcl: &str) -> Result<PathBuf, std::io::Error> {
    let dir = std::env::temp_dir().join(format!("tf-{}", uuid::Uuid::new_v4()));
    tokio::fs::create_dir_all(&dir).await?;
    tokio::fs::write(dir.join("main.tf"), hcl).await?;
    Ok(dir)
}

/// Remove the temporary directory after we are done.
async fn cleanup_temp_dir(dir: &PathBuf) {
    if let Err(e) = tokio::fs::remove_dir_all(dir).await {
        tracing::warn!("Failed to clean up temp terraform dir {:?}: {}", dir, e);
    }
}

/// Run a shell command inside the given directory and capture output.
async fn run_command(program: &str, args: &[&str], cwd: &PathBuf) -> (bool, String, String) {
    match Command::new(program)
        .args(args)
        .current_dir(cwd)
        .output()
        .await
    {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            (output.status.success(), stdout, stderr)
        }
        Err(e) => (
            false,
            String::new(),
            format!("Failed to execute {}: {}", program, e),
        ),
    }
}

// ── Handlers ─────────────────────────────────────────────────────────────

/// POST /api/v1/cloud/terraform/validate
///
/// Writes the supplied HCL to a temp directory, runs `terraform init -backend=false`
/// followed by `terraform validate`, and returns the validation result.
pub async fn validate(body: web::Json<TerraformValidateRequest>) -> HttpResponse {
    let dir = match prepare_temp_dir(&body.hcl).await {
        Ok(d) => d,
        Err(e) => {
            return HttpResponse::InternalServerError().json(TerraformResponse {
                success: false,
                stdout: String::new(),
                stderr: String::new(),
                error: Some(format!("Failed to create temp directory: {}", e)),
            });
        }
    };

    // terraform init -backend=false (only initializes providers, no remote state)
    let (init_ok, _init_stdout, init_stderr) =
        run_command("terraform", &["init", "-backend=false", "-no-color"], &dir).await;

    if !init_ok {
        let resp = TerraformResponse {
            success: false,
            stdout: String::new(),
            stderr: init_stderr,
            error: Some("terraform init failed".to_string()),
        };
        cleanup_temp_dir(&dir).await;
        return HttpResponse::UnprocessableEntity().json(resp);
    }

    // terraform validate
    let (ok, stdout, stderr) = run_command("terraform", &["validate", "-no-color"], &dir).await;

    cleanup_temp_dir(&dir).await;

    let mut status = if ok {
        HttpResponse::Ok()
    } else {
        HttpResponse::UnprocessableEntity()
    };

    status.json(TerraformResponse {
        success: ok,
        stdout,
        stderr,
        error: if ok {
            None
        } else {
            Some("Validation failed".to_string())
        },
    })
}

/// POST /api/v1/cloud/terraform/plan
///
/// Writes HCL to a temp directory, runs `terraform init` then `terraform plan`,
/// and returns the plan output. Does NOT apply anything.
pub async fn plan(body: web::Json<TerraformPlanRequest>) -> HttpResponse {
    let dir = match prepare_temp_dir(&body.hcl).await {
        Ok(d) => d,
        Err(e) => {
            return HttpResponse::InternalServerError().json(TerraformResponse {
                success: false,
                stdout: String::new(),
                stderr: String::new(),
                error: Some(format!("Failed to create temp directory: {}", e)),
            });
        }
    };

    // terraform init
    let (init_ok, _init_stdout, init_stderr) =
        run_command("terraform", &["init", "-no-color"], &dir).await;

    if !init_ok {
        let resp = TerraformResponse {
            success: false,
            stdout: String::new(),
            stderr: init_stderr,
            error: Some("terraform init failed".to_string()),
        };
        cleanup_temp_dir(&dir).await;
        return HttpResponse::UnprocessableEntity().json(resp);
    }

    // terraform plan
    let (ok, stdout, stderr) = run_command("terraform", &["plan", "-no-color"], &dir).await;

    cleanup_temp_dir(&dir).await;

    let mut status = if ok {
        HttpResponse::Ok()
    } else {
        HttpResponse::UnprocessableEntity()
    };

    status.json(TerraformResponse {
        success: ok,
        stdout,
        stderr,
        error: if ok {
            None
        } else {
            Some("terraform plan failed".to_string())
        },
    })
}

/// POST /api/v1/cloud/terraform/apply
///
/// Writes HCL to a temp directory, runs `terraform init` then
/// `terraform apply -auto-approve`. Requires `confirmed: true` in the request body.
pub async fn apply(body: web::Json<TerraformApplyRequest>) -> HttpResponse {
    if !body.confirmed {
        return HttpResponse::BadRequest().json(TerraformResponse {
            success: false,
            stdout: String::new(),
            stderr: String::new(),
            error: Some(
                "Apply requires explicit confirmation. Set \"confirmed\": true in the request body."
                    .to_string(),
            ),
        });
    }

    let dir = match prepare_temp_dir(&body.hcl).await {
        Ok(d) => d,
        Err(e) => {
            return HttpResponse::InternalServerError().json(TerraformResponse {
                success: false,
                stdout: String::new(),
                stderr: String::new(),
                error: Some(format!("Failed to create temp directory: {}", e)),
            });
        }
    };

    // terraform init
    let (init_ok, _init_stdout, init_stderr) =
        run_command("terraform", &["init", "-no-color"], &dir).await;

    if !init_ok {
        let resp = TerraformResponse {
            success: false,
            stdout: String::new(),
            stderr: init_stderr,
            error: Some("terraform init failed".to_string()),
        };
        cleanup_temp_dir(&dir).await;
        return HttpResponse::UnprocessableEntity().json(resp);
    }

    // terraform apply -auto-approve
    let (ok, stdout, stderr) =
        run_command("terraform", &["apply", "-auto-approve", "-no-color"], &dir).await;

    cleanup_temp_dir(&dir).await;

    let mut status = if ok {
        HttpResponse::Ok()
    } else {
        HttpResponse::UnprocessableEntity()
    };

    status.json(TerraformResponse {
        success: ok,
        stdout,
        stderr,
        error: if ok {
            None
        } else {
            Some("terraform apply failed".to_string())
        },
    })
}

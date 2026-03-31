use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::CloudError;
use crate::providers::ProviderContext;

#[derive(Debug, Deserialize)]
pub struct SaveCredentialsRequest {
    pub provider: String,
    pub name: String,
    pub credentials: ProviderCredentials,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum ProviderCredentials {
    #[serde(rename = "aws")]
    Aws {
        access_key_id: String,
        secret_access_key: String,
        region: Option<String>,
    },
    #[serde(rename = "gcp")]
    Gcp {
        project_id: String,
        service_account_json: String,
    },
    #[serde(rename = "azure")]
    Azure {
        tenant_id: String,
        client_id: String,
        client_secret: String,
        subscription_id: String,
    },
}

#[derive(Debug, Serialize)]
struct CredentialStatus {
    provider: String,
    configured: bool,
    status: String,
}

/// GET /api/v1/cloud/credentials/status
pub async fn get_credentials_status(
    ctx: web::Data<Arc<ProviderContext>>,
) -> Result<HttpResponse, CloudError> {
    let mut statuses = vec![
        CredentialStatus { provider: "aws".into(), configured: false, status: "not_configured".into() },
        CredentialStatus { provider: "gcp".into(), configured: false, status: "not_configured".into() },
        CredentialStatus { provider: "azure".into(), configured: false, status: "not_configured".into() },
    ];

    // Check credential manager
    if let Some(creds) = &ctx.credentials {
        for name in creds.available_providers() {
            if let Some(s) = statuses.iter_mut().find(|s| s.provider == name) {
                s.configured = true;
                s.status = "connected".into();
            }
        }
    }

    // Also check env vars
    if std::env::var("AWS_ACCESS_KEY_ID").is_ok() {
        statuses[0].configured = true;
        if statuses[0].status == "not_configured" {
            statuses[0].status = "configured".into();
        }
    }
    if std::env::var("GCP_PROJECT_ID").is_ok() {
        statuses[1].configured = true;
        if statuses[1].status == "not_configured" {
            statuses[1].status = "configured".into();
        }
    }
    if std::env::var("AZURE_SUBSCRIPTION_ID").is_ok() {
        statuses[2].configured = true;
        if statuses[2].status == "not_configured" {
            statuses[2].status = "configured".into();
        }
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "providers": statuses,
        "mock_mode": ctx.flags.use_mock_data,
    })))
}

/// POST /api/v1/cloud/credentials
/// Save cloud credentials to .env.cloud file. Requires service restart to take effect.
pub async fn save_credentials(
    body: web::Json<SaveCredentialsRequest>,
) -> Result<HttpResponse, CloudError> {
    let req = body.into_inner();

    // Find or create the .env.cloud file
    let env_path = find_env_cloud_file()
        .unwrap_or_else(|| {
            let path = std::env::current_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."))
                .parent()
                .unwrap_or(std::path::Path::new("."))
                .join(".env.cloud");
            path.to_string_lossy().to_string()
        });

    write_credentials_to_file(&env_path, &req)
        .map_err(|e| CloudError::Internal(format!("Failed to save credentials: {e}")))?;

    tracing::info!(provider = %req.provider, name = %req.name, file = %env_path, "Credentials saved");

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "status": "saved",
        "provider": req.provider,
        "name": req.name,
        "env_file": env_path,
        "message": "Credentials saved to .env.cloud. Restart services with ./start.sh to apply.",
        "restart_required": true,
    })))
}

/// DELETE /api/v1/cloud/credentials/{provider}
pub async fn delete_credentials(
    path: web::Path<String>,
) -> Result<HttpResponse, CloudError> {
    let provider = path.into_inner();

    let keys_to_remove = match provider.as_str() {
        "aws" => vec!["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_DEFAULT_REGION"],
        "gcp" => vec!["GCP_PROJECT_ID", "GOOGLE_APPLICATION_CREDENTIALS"],
        "azure" => vec!["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_SUBSCRIPTION_ID"],
        _ => return Err(CloudError::BadRequest(format!("Unknown provider: {provider}"))),
    };

    // Remove from .env.cloud file
    if let Some(env_path) = find_env_cloud_file() {
        if let Ok(content) = std::fs::read_to_string(&env_path) {
            let filtered: Vec<&str> = content
                .lines()
                .filter(|line| {
                    !keys_to_remove.iter().any(|key| line.starts_with(key))
                })
                .collect();
            let _ = std::fs::write(&env_path, filtered.join("\n"));
        }
    }

    tracing::info!(provider = %provider, "Credentials removed");

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "status": "removed",
        "provider": provider,
        "restart_required": true,
    })))
}

fn find_env_cloud_file() -> Option<String> {
    let mut dir = std::env::current_dir().ok()?;
    for _ in 0..5 {
        let candidate = dir.join(".env.cloud");
        if candidate.exists() {
            return candidate.to_str().map(|s| s.to_owned());
        }
        if !dir.pop() {
            break;
        }
    }
    None
}

fn write_credentials_to_file(path: &str, req: &SaveCredentialsRequest) -> Result<(), std::io::Error> {
    use std::io::Write;

    // Read existing content
    let existing = std::fs::read_to_string(path).unwrap_or_default();

    // Remove old entries for this provider
    let keys_to_remove = match req.provider.as_str() {
        "aws" => vec!["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_DEFAULT_REGION"],
        "gcp" => vec!["GCP_PROJECT_ID", "GOOGLE_APPLICATION_CREDENTIALS"],
        "azure" => vec!["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_SUBSCRIPTION_ID"],
        _ => vec![],
    };

    let mut filtered: Vec<&str> = existing
        .lines()
        .filter(|line| {
            let trimmed = line.trim();
            !keys_to_remove.iter().any(|key| trimmed.starts_with(key))
        })
        .collect();

    // Ensure mock mode is off
    filtered.retain(|line| !line.trim().starts_with("CLOUD_USE_MOCK_DATA"));
    filtered.push("CLOUD_USE_MOCK_DATA=false");

    let mut file = std::fs::File::create(path)?;

    for line in &filtered {
        writeln!(file, "{}", line)?;
    }

    writeln!(file, "\n# --- {} ({}) ---", req.name, req.provider)?;

    match &req.credentials {
        ProviderCredentials::Aws { access_key_id, secret_access_key, region } => {
            writeln!(file, "AWS_ACCESS_KEY_ID={}", access_key_id)?;
            writeln!(file, "AWS_SECRET_ACCESS_KEY={}", secret_access_key)?;
            if let Some(r) = region {
                writeln!(file, "AWS_DEFAULT_REGION={}", r)?;
            }
        }
        ProviderCredentials::Gcp { project_id, service_account_json } => {
            writeln!(file, "GCP_PROJECT_ID={}", project_id)?;
            // Write SA key to file
            let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
            let sa_path = format!("{}/.config/gcloud/cloud-manager-sa.json", home);
            if let Some(parent) = std::path::Path::new(&sa_path).parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            std::fs::write(&sa_path, service_account_json)?;
            writeln!(file, "GOOGLE_APPLICATION_CREDENTIALS={}", sa_path)?;
        }
        ProviderCredentials::Azure { tenant_id, client_id, client_secret, subscription_id } => {
            writeln!(file, "AZURE_TENANT_ID={}", tenant_id)?;
            writeln!(file, "AZURE_CLIENT_ID={}", client_id)?;
            writeln!(file, "AZURE_CLIENT_SECRET={}", client_secret)?;
            writeln!(file, "AZURE_SUBSCRIPTION_ID={}", subscription_id)?;
        }
    }

    Ok(())
}

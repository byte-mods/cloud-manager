use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub aws: AwsConfig,
    pub gcp: GcpConfig,
    pub azure: AzureConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseConfig {
    pub database_url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AwsConfig {
    pub credentials_path: String,
    pub default_region: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GcpConfig {
    pub credentials_path: String,
    pub project_id: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AzureConfig {
    pub credentials_path: String,
    pub subscription_id: String,
    pub tenant_id: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: "0.0.0.0".to_string(),
                port: 8082,
            },
            database: DatabaseConfig {
                database_url: "postgresql://localhost:5432/cloud_manager".to_string(),
            },
            aws: AwsConfig {
                credentials_path: "~/.aws/credentials".to_string(),
                default_region: "us-east-1".to_string(),
            },
            gcp: GcpConfig {
                credentials_path: "~/.config/gcloud/credentials.json".to_string(),
                project_id: String::new(),
            },
            azure: AzureConfig {
                credentials_path: "~/.azure/credentials".to_string(),
                subscription_id: String::new(),
                tenant_id: String::new(),
            },
        }
    }
}

impl AppConfig {
    pub fn from_env() -> Self {
        Self {
            server: ServerConfig {
                host: std::env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
                port: std::env::var("SERVER_PORT")
                    .ok()
                    .and_then(|p| p.parse().ok())
                    .unwrap_or(8082),
            },
            database: DatabaseConfig {
                database_url: std::env::var("DATABASE_URL")
                    .unwrap_or_else(|_| "postgresql://localhost:5432/cloud_manager".to_string()),
            },
            aws: AwsConfig {
                credentials_path: std::env::var("AWS_CREDENTIALS_PATH")
                    .unwrap_or_else(|_| "~/.aws/credentials".to_string()),
                default_region: std::env::var("AWS_DEFAULT_REGION")
                    .unwrap_or_else(|_| "us-east-1".to_string()),
            },
            gcp: GcpConfig {
                credentials_path: std::env::var("GCP_CREDENTIALS_PATH")
                    .unwrap_or_else(|_| "~/.config/gcloud/credentials.json".to_string()),
                project_id: std::env::var("GCP_PROJECT_ID").unwrap_or_default(),
            },
            azure: AzureConfig {
                credentials_path: std::env::var("AZURE_CREDENTIALS_PATH")
                    .unwrap_or_else(|_| "~/.azure/credentials".to_string()),
                subscription_id: std::env::var("AZURE_SUBSCRIPTION_ID").unwrap_or_default(),
                tenant_id: std::env::var("AZURE_TENANT_ID").unwrap_or_default(),
            },
        }
    }
}

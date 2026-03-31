use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub ddos: DdosConfig,
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
pub struct DdosConfig {
    /// Maximum allowed duration for DDoS tests in seconds.
    pub max_duration_seconds: u64,
    /// Whether DDoS testing is enabled at all.
    pub enabled: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: "0.0.0.0".to_string(),
                port: 8083,
            },
            database: DatabaseConfig {
                database_url: "postgresql://localhost:5432/cloud_manager".to_string(),
            },
            ddos: DdosConfig {
                max_duration_seconds: 3600,
                enabled: false,
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
                    .unwrap_or(8083),
            },
            database: DatabaseConfig {
                database_url: std::env::var("DATABASE_URL")
                    .unwrap_or_else(|_| "postgresql://localhost:5432/cloud_manager".to_string()),
            },
            ddos: DdosConfig {
                max_duration_seconds: std::env::var("DDOS_MAX_DURATION_SECONDS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(3600),
                enabled: std::env::var("DDOS_ENABLED")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(false),
            },
        }
    }
}

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub server_port: u16,
    pub aws_region: Option<String>,
    pub gcp_project_id: Option<String>,
    pub azure_subscription_id: Option<String>,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, config::ConfigError> {
        let cfg = config::Config::builder()
            .set_default("server_port", 8086)?
            .add_source(config::Environment::with_prefix("COST").separator("_"))
            .build()?;

        cfg.try_deserialize()
    }
}

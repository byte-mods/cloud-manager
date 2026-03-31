use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub server_port: u16,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, config::ConfigError> {
        let cfg = config::Config::builder()
            .set_default("server_port", 8088)?
            .add_source(config::Environment::with_prefix("ANALYTICS").separator("_"))
            .build()?;

        cfg.try_deserialize()
    }
}

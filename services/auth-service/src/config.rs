use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub server_port: u16,
    pub jwt_secret: String,
    pub jwt_expiry: u64,
    pub refresh_token_expiry: u64,
    pub surreal_db_path: String,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, config::ConfigError> {
        let cfg = config::Config::builder()
            .set_default("server_port", 8081)?
            .set_default("jwt_expiry", 900u64)?
            .set_default("refresh_token_expiry", 604800u64)?
            .set_default("surreal_db_path", "./data/auth")?
            .add_source(config::Environment::with_prefix("AUTH").separator("_"))
            .build()?;

        cfg.try_deserialize()
    }
}

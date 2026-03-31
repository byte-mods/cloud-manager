use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub server_port: u16,
    pub anthropic_api_key: String,
    pub anthropic_api_url: String,
    pub model: String,
    pub max_tokens: u32,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, config::ConfigError> {
        let cfg = config::Config::builder()
            .set_default("server_port", 8084)?
            .set_default("anthropic_api_url", "https://api.anthropic.com")?
            .set_default("model", "claude-sonnet-4-20250514")?
            .set_default("max_tokens", 4096u32)?
            .add_source(config::Environment::with_prefix("AI").separator("_"))
            .build()?;

        cfg.try_deserialize()
    }
}

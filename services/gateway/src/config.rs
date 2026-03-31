use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub server_port: u16,
    pub jwt_secret: String,
    pub auth_service_url: String,
    pub cloud_service_url: String,
    pub security_service_url: String,
    pub ai_service_url: String,
    pub tutorial_service_url: String,
    pub cost_service_url: String,
    pub monitoring_service_url: String,
    pub analytics_service_url: String,
    pub data_engineering_service_url: String,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, config::ConfigError> {
        let cfg = config::Config::builder()
            .set_default("server_port", 8080)?
            .set_default("auth_service_url", "http://127.0.0.1:8081")?
            .set_default("cloud_service_url", "http://127.0.0.1:8082")?
            .set_default("security_service_url", "http://127.0.0.1:8083")?
            .set_default("ai_service_url", "http://127.0.0.1:8084")?
            .set_default("tutorial_service_url", "http://127.0.0.1:8085")?
            .set_default("cost_service_url", "http://127.0.0.1:8086")?
            .set_default("monitoring_service_url", "http://127.0.0.1:8087")?
            .set_default("analytics_service_url", "http://127.0.0.1:8088")?
            .set_default("data_engineering_service_url", "http://127.0.0.1:8089")?
            .add_source(config::Environment::with_prefix("GATEWAY").separator("_"))
            .build()?;

        cfg.try_deserialize()
    }

    /// Resolve a service name to its base URL.
    pub fn service_url(&self, service: &str) -> Option<&str> {
        match service {
            "auth" => Some(&self.auth_service_url),
            "cloud" => Some(&self.cloud_service_url),
            "security" => Some(&self.security_service_url),
            "ai" => Some(&self.ai_service_url),
            "tutorial" | "learn" => Some(&self.tutorial_service_url),
            "cost" => Some(&self.cost_service_url),
            "monitoring" => Some(&self.monitoring_service_url),
            "analytics" => Some(&self.analytics_service_url),
            "data-engineering" => Some(&self.data_engineering_service_url),
            _ => None,
        }
    }
}

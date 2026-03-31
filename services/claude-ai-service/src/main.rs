mod anthropic;
mod config;
mod context;
mod error;
mod handlers;
mod models;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer};
use tracing_subscriber::EnvFilter;

use crate::anthropic::AnthropicClient;
use crate::config::AppConfig;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("claude_ai_service=info".parse().unwrap()),
        )
        .json()
        .init();

    let config = AppConfig::from_env().expect("Failed to load configuration");
    let port = config.server_port;

    let anthropic_client = AnthropicClient::new(&config);

    tracing::info!("Starting Claude AI Service on port {port}");

    let client_data = web::Data::new(anthropic_client);
    let config_data = web::Data::new(config);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .app_data(client_data.clone())
            .app_data(config_data.clone())
            .route("/health", web::get().to(health))
            // Chat endpoint (SSE streaming)
            .route("/api/v1/ai/chat", web::post().to(handlers::chat::chat))
            // IaC generation
            .route(
                "/api/v1/ai/generate-iac",
                web::post().to(handlers::iac::generate_iac),
            )
            // Policy generation
            .route(
                "/api/v1/ai/generate-policy",
                web::post().to(handlers::policy::generate_policy),
            )
            // Cost recommendations
            .route(
                "/api/v1/ai/cost-recommendations",
                web::post().to(handlers::cost::cost_recommendations),
            )
            // Security remediation
            .route(
                "/api/v1/ai/security-remediation",
                web::post().to(handlers::security::security_remediation),
            )
            // Query assistant
            .route(
                "/api/v1/ai/query-assistant",
                web::post().to(handlers::query_assistant),
            )
            // WebSocket AI terminal
            .route(
                "/ws/ai/terminal",
                web::get().to(handlers::terminal::ws_terminal),
            )
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

async fn health() -> actix_web::HttpResponse {
    actix_web::HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "claude-ai-service",
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

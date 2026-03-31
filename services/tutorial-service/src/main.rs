mod config;
mod data;
mod error;
mod handlers;
mod models;

use std::collections::HashMap;
use std::sync::Mutex;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer};
use tracing_subscriber::EnvFilter;

use crate::config::AppConfig;
use crate::handlers::progress::ProgressStore;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("tutorial_service=info".parse().unwrap()),
        )
        .json()
        .init();

    let config = AppConfig::from_env().expect("Failed to load configuration");
    let port = config.server_port;

    // In-memory progress store (replace with database in production).
    let progress_store: web::Data<ProgressStore> = web::Data::new(Mutex::new(HashMap::new()));

    tracing::info!("Starting Tutorial Service on port {port}");

    let config_data = web::Data::new(config);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .app_data(config_data.clone())
            .app_data(progress_store.clone())
            .route("/health", web::get().to(health))
            // Learning paths
            .route(
                "/api/v1/learn/paths",
                web::get().to(handlers::paths::list_paths),
            )
            .route(
                "/api/v1/learn/paths/{role}",
                web::get().to(handlers::paths::get_path_by_role),
            )
            // Tutorials
            .route(
                "/api/v1/learn/tutorials",
                web::get().to(handlers::tutorials::list_tutorials),
            )
            .route(
                "/api/v1/learn/tutorials/{id}",
                web::get().to(handlers::tutorials::get_tutorial),
            )
            // Progress
            .route(
                "/api/v1/learn/progress/{user_id}",
                web::get().to(handlers::progress::get_progress),
            )
            .route(
                "/api/v1/learn/progress/{user_id}",
                web::put().to(handlers::progress::update_progress),
            )
            .route(
                "/api/v1/learn/progress/{user_id}/complete-step",
                web::post().to(handlers::progress::complete_step),
            )
            // Sandbox
            .route(
                "/api/v1/learn/sandbox/provision",
                web::post().to(handlers::sandbox::provision_sandbox),
            )
            .route(
                "/api/v1/learn/sandbox/execute",
                web::post().to(handlers::sandbox::execute_command),
            )
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

async fn health() -> actix_web::HttpResponse {
    actix_web::HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "tutorial-service",
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

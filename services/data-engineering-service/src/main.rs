mod config;
mod error;
mod handlers;
mod models;
mod providers;
mod store;
mod traits;

use std::sync::Arc;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer};
use tracing_subscriber::EnvFilter;

use crate::config::AppConfig;
use crate::providers::ProviderContext;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("data_engineering_service=info".parse().unwrap()),
        )
        .init();

    let config = AppConfig::from_env().expect("Failed to load configuration");
    let port = config.server_port;
    let flags = cloud_common::FeatureFlags::from_env();

    // Initialize embedded SurrealDB for persistent storage
    let db = cloud_common::Database::new("./data/data-engineering").await.unwrap();
    db.init_schema().await.ok();
    store::seed_if_empty(&db).await;
    tracing::info!("SurrealDB initialized and seeded for data-engineering-service");

    let db_arc = Arc::new(db);

    // Initialize real cloud credentials if not in mock mode
    let (credentials, cache) = if flags.use_real_sdk() {
        tracing::info!("Real SDK mode enabled — initializing cloud credentials");

        let creds = Arc::new(cloud_common::CredentialManager::new().await);
        let available = creds.available_providers();
        tracing::info!(providers = ?available, "Cloud credentials loaded");

        let redis_url =
            std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_owned());
        let cache = cloud_common::RedisCache::new(&redis_url, "data-engineering-service")
            .await
            .map(Arc::new)
            .ok();

        if cache.is_none() {
            tracing::warn!("Redis not available — caching disabled");
        }

        (Some(creds), cache)
    } else {
        tracing::info!("Mock mode enabled (CLOUD_USE_MOCK_DATA=true) — using SurrealDB data");
        (None, None)
    };

    let provider_ctx = Arc::new(ProviderContext {
        db: db_arc.clone(),
        credentials,
        cache,
        flags,
    });

    // Create the provider once and share it across workers
    let pipeline_provider = providers::get_data_pipeline_provider(&provider_ctx);

    tracing::info!("Starting Data Engineering Service on port {port}");

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .app_data(web::Data::from(pipeline_provider.clone()))
            .route("/health", web::get().to(health))
            // Overview
            .route(
                "/api/v1/data-engineering/overview",
                web::get().to(handlers::overview::get_overview),
            )
            // ETL Pipelines
            .route(
                "/api/v1/data-engineering/etl",
                web::get().to(handlers::etl::list_pipelines),
            )
            .route(
                "/api/v1/data-engineering/etl",
                web::post().to(handlers::etl::create_pipeline),
            )
            .route(
                "/api/v1/data-engineering/etl/{id}",
                web::get().to(handlers::etl::get_pipeline),
            )
            .route(
                "/api/v1/data-engineering/etl/{id}",
                web::put().to(handlers::etl::update_pipeline),
            )
            .route(
                "/api/v1/data-engineering/etl/{id}",
                web::delete().to(handlers::etl::delete_pipeline),
            )
            .route(
                "/api/v1/data-engineering/etl/{id}/run",
                web::post().to(handlers::etl::trigger_run),
            )
            // Streaming
            .route(
                "/api/v1/data-engineering/streaming",
                web::get().to(handlers::streaming::list_streaming_jobs),
            )
            .route(
                "/api/v1/data-engineering/streaming",
                web::post().to(handlers::streaming::create_streaming_job),
            )
            // Data Lake
            .route(
                "/api/v1/data-engineering/data-lake",
                web::get().to(handlers::data_lake::list_datasets),
            )
            .route(
                "/api/v1/data-engineering/data-lake",
                web::post().to(handlers::data_lake::register_dataset),
            )
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

async fn health() -> actix_web::HttpResponse {
    actix_web::HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "data-engineering-service",
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

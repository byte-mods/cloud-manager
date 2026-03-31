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
use crate::providers::MonitoringContext;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("monitoring_service=info".parse().unwrap()),
        )
        .init();

    let config = AppConfig::from_env().expect("Failed to load configuration");
    let port = config.server_port;
    let flags = cloud_common::FeatureFlags::from_env();

    // Initialize real cloud credentials if not in mock mode
    let credentials = if flags.use_real_sdk() {
        tracing::info!("Real SDK mode enabled -- initializing cloud credentials");
        let creds = Arc::new(cloud_common::CredentialManager::new().await);
        let available = creds.available_providers();
        tracing::info!(providers = ?available, "Cloud credentials loaded");
        Some(creds)
    } else {
        tracing::info!("Mock mode enabled (CLOUD_USE_MOCK_DATA=true) -- using seeded data from SurrealDB");
        None
    };

    let monitoring_ctx = Arc::new(MonitoringContext {
        credentials,
        flags,
    });

    // Initialize embedded SurrealDB for persistent CRUD storage
    let db = cloud_common::Database::new("./data/monitoring").await.unwrap();
    db.init_and_seed().await.ok();
    tracing::info!("SurrealDB initialized for monitoring-service");

    // Seed monitoring data into SurrealDB if empty
    store::seed_if_empty(&db).await;

    tracing::info!("Starting Monitoring Service on port {port}");

    let db_data = web::Data::new(db);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .app_data(web::Data::new(monitoring_ctx.clone()))
            // SurrealDB for persistent CRUD handlers
            .app_data(db_data.clone())
            .route("/health", web::get().to(health))
            // Overview
            .route(
                "/api/v1/monitoring/overview",
                web::get().to(handlers::overview::get_overview),
            )
            // Dashboards
            .route(
                "/api/v1/monitoring/dashboards",
                web::get().to(handlers::dashboards::list_dashboards),
            )
            .route(
                "/api/v1/monitoring/dashboards",
                web::post().to(handlers::dashboards::create_dashboard),
            )
            // Metrics
            .route(
                "/api/v1/monitoring/metrics",
                web::get().to(handlers::metrics::list_metrics),
            )
            .route(
                "/api/v1/monitoring/metrics/{name}",
                web::get().to(handlers::metrics::get_metric),
            )
            // Alerts
            .route(
                "/api/v1/monitoring/alerts",
                web::get().to(handlers::alerts::list_alerts),
            )
            .route(
                "/api/v1/monitoring/alerts",
                web::post().to(handlers::alerts::create_alert),
            )
            .route(
                "/api/v1/monitoring/alerts/{id}/ack",
                web::put().to(handlers::alerts::acknowledge_alert),
            )
            // Logs
            .route(
                "/api/v1/monitoring/logs",
                web::get().to(handlers::logs::query_logs),
            )
            .route(
                "/api/v1/monitoring/logs/stream",
                web::get().to(handlers::logs::stream_logs),
            )
            // Tracing
            .route(
                "/api/v1/monitoring/tracing",
                web::get().to(handlers::tracing_handler::list_traces),
            )
            .route(
                "/api/v1/monitoring/tracing/{id}",
                web::get().to(handlers::tracing_handler::get_trace),
            )
            // Uptime
            .route(
                "/api/v1/monitoring/uptime",
                web::get().to(handlers::uptime::list_services),
            )
            .route(
                "/api/v1/monitoring/uptime/{id}",
                web::get().to(handlers::uptime::get_service_health),
            )
            // WebSocket – live metrics
            .route(
                "/api/v1/monitoring/ws",
                web::get().to(handlers::websocket::ws_metrics),
            )
            // WebSocket – live log streaming
            .route(
                "/api/v1/monitoring/logs/stream-ws",
                web::get().to(handlers::log_stream::ws_log_stream),
            )
            // Notification channels
            .route(
                "/api/v1/monitoring/notifications/channels",
                web::post().to(handlers::notifications::add_channel),
            )
            .route(
                "/api/v1/monitoring/notifications/channels",
                web::get().to(handlers::notifications::list_channels),
            )
            .route(
                "/api/v1/monitoring/notifications/channels/{id}",
                web::delete().to(handlers::notifications::remove_channel),
            )
            .route(
                "/api/v1/monitoring/notifications/test/{id}",
                web::post().to(handlers::notifications::test_channel),
            )
            // Incidents (SurrealDB-backed)
            .route(
                "/api/v1/monitoring/incidents",
                web::get().to(handlers::incidents::list_incidents),
            )
            .route(
                "/api/v1/monitoring/incidents",
                web::post().to(handlers::incidents::create_incident),
            )
            .route(
                "/api/v1/monitoring/incidents/{id}",
                web::get().to(handlers::incidents::get_incident),
            )
            .route(
                "/api/v1/monitoring/incidents/{id}",
                web::put().to(handlers::incidents::update_incident),
            )
            .route(
                "/api/v1/monitoring/incidents/{id}",
                web::delete().to(handlers::incidents::delete_incident),
            )
            // SLA targets (SurrealDB-backed)
            .route(
                "/api/v1/monitoring/sla",
                web::get().to(handlers::sla::list_sla_targets),
            )
            .route(
                "/api/v1/monitoring/sla",
                web::post().to(handlers::sla::create_sla_target),
            )
            .route(
                "/api/v1/monitoring/sla/{id}",
                web::put().to(handlers::sla::update_sla_target),
            )
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

async fn health() -> actix_web::HttpResponse {
    actix_web::HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "monitoring-service",
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

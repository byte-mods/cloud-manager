mod config;
mod error;
mod handlers;
mod models;
mod providers;

use std::sync::Arc;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer};
use tracing_subscriber::EnvFilter;

use crate::config::AppConfig;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("cost_service=info".parse().unwrap()),
        )
        .init();

    let config = AppConfig::from_env().expect("Failed to load configuration");
    let port = config.server_port;
    let flags = cloud_common::FeatureFlags::from_env();

    // Initialize real cloud credentials if not in mock mode.
    let credentials = if flags.use_real_sdk() {
        tracing::info!("Real SDK mode enabled — initializing cloud credentials");
        let creds = Arc::new(cloud_common::CredentialManager::new().await);
        let available = creds.available_providers();
        tracing::info!(providers = ?available, "Cloud credentials loaded");
        Some(creds)
    } else {
        tracing::info!("Mock mode enabled (CLOUD_USE_MOCK_DATA=true) — using seeded data");
        None
    };

    // Build cost providers based on feature flags.
    let aws_region = config.aws_region.as_deref().unwrap_or("us-east-1");
    let gcp_project = config.gcp_project_id.as_deref().unwrap_or("my-project");
    let azure_sub = config.azure_subscription_id.as_deref().unwrap_or("my-subscription");

    let cost_providers = providers::build_providers(
        &flags,
        credentials.as_ref(),
        aws_region,
        gcp_project,
        azure_sub,
    );

    let providers_data = web::Data::new(cost_providers);

    // Initialize embedded SurrealDB for persistent budget storage.
    let db = cloud_common::Database::new("./data/cost").await.unwrap();
    db.init_schema().await.ok();
    tracing::info!("SurrealDB initialized for cost-service");

    let db_data = web::Data::new(db);

    tracing::info!("Starting Cost Service on port {port}");

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .app_data(providers_data.clone())
            .app_data(db_data.clone())
            .route("/health", web::get().to(health))
            // Cost overview
            .route(
                "/api/v1/cost/overview",
                web::get().to(handlers::overview::get_overview),
            )
            // Cost explorer
            .route(
                "/api/v1/cost/explorer",
                web::get().to(handlers::explorer::explore_costs),
            )
            // Budgets
            .route(
                "/api/v1/cost/budgets",
                web::get().to(handlers::budgets::list_budgets),
            )
            .route(
                "/api/v1/cost/budgets",
                web::post().to(handlers::budgets::create_budget),
            )
            // Recommendations
            .route(
                "/api/v1/cost/recommendations",
                web::get().to(handlers::recommendations::get_recommendations),
            )
            // Reservations
            .route(
                "/api/v1/cost/reservations",
                web::get().to(handlers::reservations::list_reservations),
            )
            // Forecasting
            .route(
                "/api/v1/cost/forecast",
                web::get().to(handlers::forecast::get_forecast),
            )
            // Waste detection
            .route(
                "/api/v1/cost/waste",
                web::get().to(handlers::waste::detect_waste),
            )
            // FinOps endpoints
            .route("/api/v1/cost/finops/team-allocations", web::get().to(handlers::finops::get_team_allocations))
            .route("/api/v1/cost/finops/team-allocations", web::post().to(handlers::finops::create_team_allocation))
            .route("/api/v1/cost/finops/unit-economics", web::get().to(handlers::finops::get_unit_economics))
            .route("/api/v1/cost/finops/ri-recommendations", web::get().to(handlers::finops::get_ri_recommendations))
            .route("/api/v1/cost/finops/waste-categories", web::get().to(handlers::finops::get_waste_categories))
            .route("/api/v1/cost/finops/kpis", web::get().to(handlers::finops::get_kpis))
            // Cost anomalies endpoints
            .route("/api/v1/cost/anomalies", web::get().to(handlers::anomalies::list_anomalies))
            .route("/api/v1/cost/anomalies", web::post().to(handlers::anomalies::create_anomaly))
            .route("/api/v1/cost/anomalies/{id}", web::get().to(handlers::anomalies::get_anomaly))
            .route("/api/v1/cost/anomalies/{id}/dismiss", web::put().to(handlers::anomalies::dismiss_anomaly))
            .route("/api/v1/cost/anomalies/{id}/investigate", web::put().to(handlers::anomalies::investigate_anomaly))
            .route("/api/v1/cost/anomalies/{id}/resolve", web::put().to(handlers::anomalies::resolve_anomaly))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

async fn health() -> actix_web::HttpResponse {
    actix_web::HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "cost-service",
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

use actix_cors::Cors;
use actix_web::{middleware, web, App, HttpServer};
use std::sync::Arc;
use tracing_subscriber::EnvFilter;

mod config;
mod error;
mod handlers;
mod models;
mod providers;
mod scanner;
mod store;
mod traits;

use config::AppConfig;
use providers::SecurityContext;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("info".parse().unwrap()))
        .init();

    let config = AppConfig::from_env();
    let bind_addr = format!("{}:{}", config.server.host, config.server.port);
    let flags = cloud_common::FeatureFlags::from_env();

    // Initialize embedded SurrealDB for persistent CRUD storage
    let db = cloud_common::Database::new("./data/security").await.unwrap();
    db.init_and_seed().await.ok();
    tracing::info!("SurrealDB initialized for security-service");

    // Seed security data into SurrealDB if empty
    store::seed_if_empty(&db).await;
    tracing::info!("Security data seeded successfully");

    // Initialize real cloud credentials and cache if not in mock mode
    let (credentials, cache) = if flags.use_real_sdk() {
        tracing::info!(
            "Real SDK mode enabled -- initializing cloud credentials and Redis cache"
        );

        let creds = Arc::new(cloud_common::CredentialManager::new().await);
        let available = creds.available_providers();
        tracing::info!(providers = ?available, "Cloud credentials loaded");

        let redis_url =
            std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_owned());
        let cache = cloud_common::RedisCache::new(&redis_url, "security-service")
            .await
            .map(Arc::new)
            .ok();

        if cache.is_none() {
            tracing::warn!("Redis not available -- caching disabled");
        }

        (Some(creds), cache)
    } else {
        tracing::info!("Mock mode enabled (CLOUD_USE_MOCK_DATA=true) -- using SurrealDB data");
        (None, None)
    };

    let db_arc = Arc::new(db);

    let security_ctx = Arc::new(SecurityContext {
        db: db_arc.clone(),
        credentials,
        cache,
        flags,
    });

    tracing::info!("Starting security service on {}", bind_addr);

    let app_config = web::Data::new(config);
    let db_data = web::Data::from(db_arc);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .app_data(app_config.clone())
            .app_data(web::Data::new(security_ctx.clone()))
            // SurrealDB for all handlers
            .app_data(db_data.clone())
            // Health check
            .route("/health", web::get().to(health_check))
            // Scan routes
            .service(
                web::scope("/api/v1/security/scans")
                    .route("", web::get().to(handlers::scans::list_scans))
                    .route("", web::post().to(handlers::scans::create_scan))
                    .route("/{id}", web::get().to(handlers::scans::get_scan))
                    .route(
                        "/{id}/findings",
                        web::get().to(handlers::scans::get_scan_findings),
                    )
                    .route(
                        "/{id}/status",
                        web::get().to(handlers::scans::get_scan_status),
                    ),
            )
            // Compliance routes
            .service(
                web::scope("/api/v1/security/compliance")
                    .route("/assess", web::post().to(handlers::compliance::assess_framework))
                    .route("/report", web::post().to(handlers::compliance::generate_report))
                    .route(
                        "/generate-terraform",
                        web::post().to(handlers::compliance_code::generate_terraform),
                    )
                    .route(
                        "/generate-opa",
                        web::post().to(handlers::compliance_code::generate_opa),
                    )
                    .route(
                        "/{framework}",
                        web::get().to(handlers::compliance::get_assessment),
                    ),
            )
            // Posture routes
            .service(
                web::scope("/api/v1/security/posture")
                    .route("/score", web::get().to(handlers::posture::get_score))
                    .route("/categories", web::get().to(handlers::posture::get_categories))
                    .route("/trend", web::get().to(handlers::posture::get_trend)),
            )
            // Vulnerability routes
            .service(
                web::scope("/api/v1/security/vulnerabilities")
                    .route("", web::get().to(handlers::vulnerability::list_vulnerabilities))
                    .route("/scan", web::post().to(handlers::vulnerability::scan_vulnerabilities))
                    .route(
                        "/{id}",
                        web::get().to(handlers::vulnerability::get_vulnerability),
                    ),
            )
            // DDoS test routes
            .service(
                web::scope("/api/v1/security/ddos-tests")
                    .route("", web::post().to(handlers::ddos::create_test))
                    .route("/{id}", web::get().to(handlers::ddos::get_results))
                    .route("/{id}/stop", web::post().to(handlers::ddos::stop_test))
                    .route("/{id}/audit", web::get().to(handlers::ddos::audit_trail)),
            )
            // Container scan routes (SurrealDB-backed)
            .service(
                web::scope("/api/v1/security/container-scans")
                    .route("", web::get().to(handlers::container_scan::list_scans))
                    .route("", web::post().to(handlers::container_scan::create_scan)),
            )
    })
    .bind(&bind_addr)?
    .run()
    .await
}

async fn health_check() -> actix_web::HttpResponse {
    actix_web::HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "security-service",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

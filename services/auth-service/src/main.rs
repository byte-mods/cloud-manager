mod config;
mod error;
mod handlers;
mod jwt;
mod models;
mod permissions;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer};
use tracing_subscriber::EnvFilter;

use crate::config::AppConfig;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("auth_service=info".parse().unwrap()))
        .json()
        .init();

    let config = AppConfig::from_env().expect("Failed to load configuration");
    let port = config.server_port;

    // Initialize embedded SurrealDB
    let db = cloud_common::Database::new(&config.surreal_db_path)
        .await
        .expect("Failed to initialize SurrealDB");

    db.init_and_seed().await.expect("Failed to initialize database schema");

    tracing::info!("Starting Auth Service on port {port} (SurrealDB at {})", config.surreal_db_path);

    let config_data = web::Data::new(config);
    let db_data = web::Data::new(db);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .app_data(config_data.clone())
            .app_data(db_data.clone())
            .route("/health", web::get().to(health))
            // Auth
            .route("/signup", web::post().to(handlers::auth::signup))
            .route("/login", web::post().to(handlers::auth::login))
            .route("/refresh", web::post().to(handlers::auth::refresh))
            .route("/logout", web::post().to(handlers::auth::logout))
            .route("/change-password", web::put().to(handlers::auth::change_password))
            // User management (admin)
            .route("/users", web::get().to(handlers::users::list_users))
            .route("/users", web::post().to(handlers::auth::create_user))
            .route("/users/{id}", web::get().to(handlers::users::get_user))
            .route("/users/{id}/role", web::put().to(handlers::users::update_role))
            .route("/users/{id}", web::delete().to(handlers::users::delete_user))
            // Notifications
            .route("/notifications", web::get().to(handlers::notifications::list_notifications))
            .route("/notifications", web::post().to(handlers::notifications::create_notification))
            .route("/notifications/{id}/read", web::put().to(handlers::notifications::mark_read))
            // Approvals
            .route("/approvals", web::get().to(handlers::approvals::list_approvals))
            .route("/approvals", web::post().to(handlers::approvals::create_approval))
            .route("/approvals/{id}/approve", web::put().to(handlers::approvals::approve))
            .route("/approvals/{id}/reject", web::put().to(handlers::approvals::reject))
            // Webhooks
            .route("/webhooks", web::get().to(handlers::webhooks::list_webhooks))
            .route("/webhooks", web::post().to(handlers::webhooks::create_webhook))
            .route("/webhooks/{id}", web::delete().to(handlers::webhooks::delete_webhook))
            // Audit log
            .route("/audit-log", web::get().to(handlers::audit::list_audit_log))
            .route("/audit-log", web::post().to(handlers::audit::create_audit_entry))
            .route("/audit-log/{id}", web::get().to(handlers::audit::get_audit_entry))
            // Cloud accounts
            .route("/cloud-accounts", web::get().to(handlers::cloud_accounts::list_cloud_accounts))
            .route("/cloud-accounts", web::post().to(handlers::cloud_accounts::create_cloud_account))
            .route("/cloud-accounts/{id}", web::delete().to(handlers::cloud_accounts::delete_cloud_account))
            // Approval workflows
            .route("/approvals/workflows", web::get().to(handlers::approval_workflows::list_workflows))
            .route("/approvals/workflows", web::post().to(handlers::approval_workflows::create_workflow))
            .route("/approvals/workflows/{id}", web::put().to(handlers::approval_workflows::update_workflow))
            .route("/approvals/workflows/{id}", web::delete().to(handlers::approval_workflows::delete_workflow))
            // Organizations — Teams
            .route("/organizations/teams", web::get().to(handlers::organizations::list_teams))
            .route("/organizations/teams", web::post().to(handlers::organizations::create_team))
            .route("/organizations/teams/{id}", web::put().to(handlers::organizations::update_team))
            .route("/organizations/teams/{id}", web::delete().to(handlers::organizations::delete_team))
            // Organizations — Projects
            .route("/organizations/projects", web::get().to(handlers::organizations::list_projects))
            .route("/organizations/projects", web::post().to(handlers::organizations::create_project))
            .route("/organizations/projects/{id}", web::put().to(handlers::organizations::update_project))
            .route("/organizations/projects/{id}", web::delete().to(handlers::organizations::delete_project))
            // Organizations — Members
            .route("/organizations/members", web::get().to(handlers::organizations::list_members))
            .route("/organizations/members", web::post().to(handlers::organizations::create_member))
            .route("/organizations/members/{id}", web::put().to(handlers::organizations::update_member))
            .route("/organizations/members/{id}", web::delete().to(handlers::organizations::delete_member))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

async fn health() -> actix_web::HttpResponse {
    actix_web::HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "auth-service",
        "storage": "surrealdb-embedded",
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

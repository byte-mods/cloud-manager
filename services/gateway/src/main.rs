mod audit;
mod config;
mod error;
mod middleware;
mod proxy;
mod rbac;
mod routes;
mod terminal;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer};
use tracing_subscriber::EnvFilter;

use crate::config::AppConfig;
use crate::middleware::auth::JwtAuth;
use crate::middleware::rate_limit::RateLimiter;
use crate::proxy::ServiceProxy;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("gateway=info".parse().unwrap()))
        .json()
        .init();

    let config = AppConfig::from_env().expect("Failed to load configuration");
    let port = config.server_port;

    let proxy = web::Data::new(ServiceProxy::new(config.clone()));

    tracing::info!("Starting API Gateway on port {port}");

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .wrap(JwtAuth {
                jwt_secret: config.jwt_secret.clone(),
            })
            .wrap(RateLimiter {
                max_requests: 100,
                window_secs: 60,
            })
            .app_data(proxy.clone())
            .configure(routes::configure)
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

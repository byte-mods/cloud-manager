use actix_web::{web, HttpRequest, HttpResponse};
use crate::proxy::ServiceProxy;

/// Health check endpoint.
pub async fn health() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "gateway",
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

/// Catch-all proxy handler for /api/v1/{service}/{path:.*}
///
/// Extracts the service name from the first path segment after /api/v1/ and
/// forwards the remaining path to the matching downstream service.
pub async fn proxy_handler(
    req: HttpRequest,
    body: web::Bytes,
    proxy: web::Data<ServiceProxy>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse, actix_web::Error> {
    let (service, remainder) = path.into_inner();
    let downstream_path = if remainder.is_empty() {
        "/".to_owned()
    } else {
        format!("/{remainder}")
    };

    // Append query string if present.
    let downstream_path = if let Some(qs) = req.uri().query() {
        format!("{downstream_path}?{qs}")
    } else {
        downstream_path
    };

    proxy
        .forward(&service, &downstream_path, &req, body)
        .await
        .map_err(actix_web::error::ErrorInternalServerError)
}

/// Configure all gateway routes.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.route("/health", web::get().to(health))
        // WebSocket terminal — real interactive shell
        .route("/ws/terminal", web::get().to(crate::terminal::ws_terminal))
        .route(
            "/api/v1/{service}/{path:.*}",
            web::route().to(proxy_handler),
        );
}

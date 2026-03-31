use actix_web::{HttpResponse, ResponseError};

#[derive(Debug, thiserror::Error)]
pub enum GatewayError {
    #[error("Authentication required")]
    Unauthorized,

    #[error("Invalid or expired token")]
    InvalidToken,

    #[error("Rate limit exceeded")]
    RateLimitExceeded { retry_after: u64 },

    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("Unknown service: {0}")]
    UnknownService(String),

    #[error("Bad gateway: {0}")]
    BadGateway(String),

    #[error("Circuit open for service: {0}")]
    CircuitOpen(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl ResponseError for GatewayError {
    fn error_response(&self) -> HttpResponse {
        let (status, body) = match self {
            GatewayError::Unauthorized => (
                actix_web::http::StatusCode::UNAUTHORIZED,
                serde_json::json!({ "error": "authentication_required", "message": self.to_string() }),
            ),
            GatewayError::InvalidToken => (
                actix_web::http::StatusCode::UNAUTHORIZED,
                serde_json::json!({ "error": "invalid_token", "message": self.to_string() }),
            ),
            GatewayError::RateLimitExceeded { retry_after } => {
                return HttpResponse::TooManyRequests()
                    .insert_header(("Retry-After", retry_after.to_string()))
                    .json(serde_json::json!({
                        "error": "rate_limit_exceeded",
                        "message": self.to_string(),
                        "retry_after": retry_after,
                    }));
            }
            GatewayError::ServiceUnavailable(svc) => (
                actix_web::http::StatusCode::SERVICE_UNAVAILABLE,
                serde_json::json!({ "error": "service_unavailable", "message": format!("Service unavailable: {svc}") }),
            ),
            GatewayError::UnknownService(svc) => (
                actix_web::http::StatusCode::NOT_FOUND,
                serde_json::json!({ "error": "unknown_service", "message": format!("Unknown service: {svc}") }),
            ),
            GatewayError::BadGateway(msg) => (
                actix_web::http::StatusCode::BAD_GATEWAY,
                serde_json::json!({ "error": "bad_gateway", "message": msg }),
            ),
            GatewayError::CircuitOpen(svc) => (
                actix_web::http::StatusCode::SERVICE_UNAVAILABLE,
                serde_json::json!({ "error": "circuit_open", "message": format!("Circuit breaker open for service: {svc}") }),
            ),
            GatewayError::Internal(msg) => (
                actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                serde_json::json!({ "error": "internal_error", "message": msg }),
            ),
        };

        HttpResponse::build(status).json(body)
    }
}

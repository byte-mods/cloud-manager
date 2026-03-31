use actix_web::{HttpResponse, ResponseError};
use std::fmt;

#[derive(Debug, thiserror::Error)]
pub enum CloudError {
    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Invalid request: {0}")]
    BadRequest(String),

    #[error("Provider error: {0}")]
    ProviderError(String),

    #[error("Authentication error: {0}")]
    AuthError(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Region not supported: {0}")]
    UnsupportedRegion(String),

    #[error("Resource conflict: {0}")]
    Conflict(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("HTTP client error: {0}")]
    HttpClient(#[from] reqwest::Error),
}

impl ResponseError for CloudError {
    fn error_response(&self) -> HttpResponse {
        match self {
            CloudError::NotFound(msg) => HttpResponse::NotFound().json(ErrorResponse {
                error: "not_found".to_string(),
                message: msg.clone(),
            }),
            CloudError::BadRequest(msg) => HttpResponse::BadRequest().json(ErrorResponse {
                error: "bad_request".to_string(),
                message: msg.clone(),
            }),
            CloudError::AuthError(msg) => HttpResponse::Unauthorized().json(ErrorResponse {
                error: "unauthorized".to_string(),
                message: msg.clone(),
            }),
            CloudError::RateLimitExceeded => {
                HttpResponse::TooManyRequests().json(ErrorResponse {
                    error: "rate_limit_exceeded".to_string(),
                    message: "Rate limit exceeded. Please retry later.".to_string(),
                })
            }
            CloudError::UnsupportedRegion(msg) => {
                HttpResponse::BadRequest().json(ErrorResponse {
                    error: "unsupported_region".to_string(),
                    message: msg.clone(),
                })
            }
            CloudError::Conflict(msg) => HttpResponse::Conflict().json(ErrorResponse {
                error: "conflict".to_string(),
                message: msg.clone(),
            }),
            _ => HttpResponse::InternalServerError().json(ErrorResponse {
                error: "internal_error".to_string(),
                message: "An internal error occurred".to_string(),
            }),
        }
    }
}

#[derive(serde::Serialize)]
struct ErrorResponse {
    error: String,
    message: String,
}

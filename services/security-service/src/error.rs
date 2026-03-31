use actix_web::{HttpResponse, ResponseError};

#[derive(Debug, thiserror::Error)]
pub enum SecurityError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid request: {0}")]
    BadRequest(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Scan already in progress: {0}")]
    ScanInProgress(String),

    #[error("DDoS test not authorized: {0}")]
    DdosNotAuthorized(String),

    #[error("Max duration exceeded: maximum {max_seconds}s allowed")]
    MaxDurationExceeded { max_seconds: u64 },

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

impl ResponseError for SecurityError {
    fn error_response(&self) -> HttpResponse {
        match self {
            SecurityError::NotFound(msg) => HttpResponse::NotFound().json(ErrorResponse {
                error: "not_found".to_string(),
                message: msg.clone(),
            }),
            SecurityError::BadRequest(msg) => HttpResponse::BadRequest().json(ErrorResponse {
                error: "bad_request".to_string(),
                message: msg.clone(),
            }),
            SecurityError::Unauthorized(msg) => {
                HttpResponse::Unauthorized().json(ErrorResponse {
                    error: "unauthorized".to_string(),
                    message: msg.clone(),
                })
            }
            SecurityError::Forbidden(msg) => HttpResponse::Forbidden().json(ErrorResponse {
                error: "forbidden".to_string(),
                message: msg.clone(),
            }),
            SecurityError::ScanInProgress(msg) => {
                HttpResponse::Conflict().json(ErrorResponse {
                    error: "scan_in_progress".to_string(),
                    message: msg.clone(),
                })
            }
            SecurityError::DdosNotAuthorized(msg) => {
                HttpResponse::Forbidden().json(ErrorResponse {
                    error: "ddos_not_authorized".to_string(),
                    message: msg.clone(),
                })
            }
            SecurityError::MaxDurationExceeded { max_seconds } => {
                HttpResponse::BadRequest().json(ErrorResponse {
                    error: "max_duration_exceeded".to_string(),
                    message: format!("Maximum test duration is {} seconds", max_seconds),
                })
            }
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

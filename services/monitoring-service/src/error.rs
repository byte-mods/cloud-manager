use actix_web::{HttpResponse, ResponseError};

#[derive(Debug, thiserror::Error)]
pub enum MonitoringError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid request: {0}")]
    BadRequest(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl ResponseError for MonitoringError {
    fn error_response(&self) -> HttpResponse {
        let (status, error_code) = match self {
            MonitoringError::NotFound(_) => {
                (actix_web::http::StatusCode::NOT_FOUND, "not_found")
            }
            MonitoringError::BadRequest(_) => {
                (actix_web::http::StatusCode::BAD_REQUEST, "bad_request")
            }
            MonitoringError::Internal(_) => {
                (actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, "internal_error")
            }
        };

        HttpResponse::build(status).json(serde_json::json!({
            "error": error_code,
            "message": self.to_string(),
        }))
    }
}

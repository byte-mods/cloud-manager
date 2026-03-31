use actix_web::{HttpResponse, ResponseError};

#[derive(Debug, thiserror::Error)]
pub enum AnalyticsError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid request: {0}")]
    BadRequest(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl ResponseError for AnalyticsError {
    fn error_response(&self) -> HttpResponse {
        let (status, error_code) = match self {
            AnalyticsError::NotFound(_) => {
                (actix_web::http::StatusCode::NOT_FOUND, "not_found")
            }
            AnalyticsError::BadRequest(_) => {
                (actix_web::http::StatusCode::BAD_REQUEST, "bad_request")
            }
            AnalyticsError::Internal(_) => {
                (actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, "internal_error")
            }
        };

        HttpResponse::build(status).json(serde_json::json!({
            "error": error_code,
            "message": self.to_string(),
        }))
    }
}

use actix_web::{HttpResponse, ResponseError};

#[derive(Debug, thiserror::Error)]
pub enum DataEngineeringError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid request: {0}")]
    BadRequest(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl ResponseError for DataEngineeringError {
    fn error_response(&self) -> HttpResponse {
        let (status, error_code) = match self {
            DataEngineeringError::NotFound(_) => {
                (actix_web::http::StatusCode::NOT_FOUND, "not_found")
            }
            DataEngineeringError::BadRequest(_) => {
                (actix_web::http::StatusCode::BAD_REQUEST, "bad_request")
            }
            DataEngineeringError::Internal(_) => {
                (actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, "internal_error")
            }
        };

        HttpResponse::build(status).json(serde_json::json!({
            "error": error_code,
            "message": self.to_string(),
        }))
    }
}

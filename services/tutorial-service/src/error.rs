use actix_web::{HttpResponse, ResponseError};

#[derive(Debug, thiserror::Error)]
pub enum TutorialError {
    #[error("Tutorial not found: {0}")]
    NotFound(String),

    #[error("Invalid request: {0}")]
    BadRequest(String),

    #[error("User progress not found: {0}")]
    ProgressNotFound(String),

    #[error("Sandbox provisioning failed: {0}")]
    SandboxError(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl ResponseError for TutorialError {
    fn error_response(&self) -> HttpResponse {
        let (status, error_code) = match self {
            TutorialError::NotFound(_) => {
                (actix_web::http::StatusCode::NOT_FOUND, "not_found")
            }
            TutorialError::BadRequest(_) => {
                (actix_web::http::StatusCode::BAD_REQUEST, "bad_request")
            }
            TutorialError::ProgressNotFound(_) => {
                (actix_web::http::StatusCode::NOT_FOUND, "progress_not_found")
            }
            TutorialError::SandboxError(_) => {
                (actix_web::http::StatusCode::SERVICE_UNAVAILABLE, "sandbox_error")
            }
            TutorialError::Internal(_) => {
                (actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, "internal_error")
            }
        };

        HttpResponse::build(status).json(serde_json::json!({
            "error": error_code,
            "message": self.to_string(),
        }))
    }
}

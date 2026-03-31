use actix_web::{HttpResponse, ResponseError};

#[derive(Debug, thiserror::Error)]
pub enum CostError {
    #[error("Provider error: {0}")]
    ProviderError(String),

    #[error("Budget not found: {0}")]
    BudgetNotFound(String),

    #[error("Invalid request: {0}")]
    BadRequest(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl ResponseError for CostError {
    fn error_response(&self) -> HttpResponse {
        let (status, error_code) = match self {
            CostError::ProviderError(_) => {
                (actix_web::http::StatusCode::BAD_GATEWAY, "provider_error")
            }
            CostError::BudgetNotFound(_) => {
                (actix_web::http::StatusCode::NOT_FOUND, "budget_not_found")
            }
            CostError::BadRequest(_) => {
                (actix_web::http::StatusCode::BAD_REQUEST, "bad_request")
            }
            CostError::Internal(_) => {
                (actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, "internal_error")
            }
        };

        HttpResponse::build(status).json(serde_json::json!({
            "error": error_code,
            "message": self.to_string(),
        }))
    }
}

impl From<reqwest::Error> for CostError {
    fn from(e: reqwest::Error) -> Self {
        tracing::error!("HTTP client error: {e}");
        CostError::ProviderError(e.to_string())
    }
}

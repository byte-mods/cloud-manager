use actix_web::{HttpResponse, ResponseError};

#[derive(Debug, thiserror::Error)]
pub enum AiError {
    #[error("Anthropic API error: {0}")]
    AnthropicApi(String),

    #[error("Invalid request: {0}")]
    BadRequest(String),

    #[error("Streaming error: {0}")]
    StreamError(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl ResponseError for AiError {
    fn error_response(&self) -> HttpResponse {
        let (status, error_code) = match self {
            AiError::AnthropicApi(_) => {
                (actix_web::http::StatusCode::BAD_GATEWAY, "anthropic_api_error")
            }
            AiError::BadRequest(_) => {
                (actix_web::http::StatusCode::BAD_REQUEST, "bad_request")
            }
            AiError::StreamError(_) => {
                (actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, "stream_error")
            }
            AiError::ConfigError(_) => {
                (actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, "config_error")
            }
            AiError::Internal(_) => {
                (actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, "internal_error")
            }
        };

        HttpResponse::build(status).json(serde_json::json!({
            "error": error_code,
            "message": self.to_string(),
        }))
    }
}

impl From<reqwest::Error> for AiError {
    fn from(e: reqwest::Error) -> Self {
        tracing::error!("Reqwest error: {e}");
        AiError::AnthropicApi(e.to_string())
    }
}

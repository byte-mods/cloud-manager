use actix_web::{HttpResponse, ResponseError};

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("Invalid credentials")]
    InvalidCredentials,
    #[error("User not found")]
    UserNotFound,
    #[error("User already exists")]
    UserAlreadyExists,
    #[error("Token expired")]
    TokenExpired,
    #[error("Invalid token")]
    InvalidToken,
    #[error("Unauthorized")]
    Unauthorized,
    #[error("Forbidden")]
    Forbidden,
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Database error: {0}")]
    Database(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

impl ResponseError for AuthError {
    fn error_response(&self) -> HttpResponse {
        let (status, code) = match self {
            AuthError::InvalidCredentials => (actix_web::http::StatusCode::UNAUTHORIZED, "invalid_credentials"),
            AuthError::UserNotFound => (actix_web::http::StatusCode::NOT_FOUND, "user_not_found"),
            AuthError::UserAlreadyExists => (actix_web::http::StatusCode::CONFLICT, "user_already_exists"),
            AuthError::TokenExpired => (actix_web::http::StatusCode::UNAUTHORIZED, "token_expired"),
            AuthError::InvalidToken => (actix_web::http::StatusCode::UNAUTHORIZED, "invalid_token"),
            AuthError::Unauthorized => (actix_web::http::StatusCode::UNAUTHORIZED, "unauthorized"),
            AuthError::Forbidden => (actix_web::http::StatusCode::FORBIDDEN, "forbidden"),
            AuthError::Validation(_) => (actix_web::http::StatusCode::BAD_REQUEST, "validation_error"),
            AuthError::Database(_) => (actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, "database_error"),
            AuthError::Internal(_) => (actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, "internal_error"),
        };
        HttpResponse::build(status).json(serde_json::json!({ "error": code, "message": self.to_string() }))
    }
}

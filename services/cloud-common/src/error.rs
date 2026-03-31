use std::fmt;

/// Unified error type for all cloud SDK operations.
#[derive(Debug, thiserror::Error)]
pub enum CloudSdkError {
    #[error("AWS SDK error: {0}")]
    Aws(String),

    #[error("GCP API error: {0}")]
    Gcp(String),

    #[error("Azure SDK error: {0}")]
    Azure(String),

    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Rate limit exceeded for {service}")]
    RateLimitExceeded { service: String },

    #[error("Invalid configuration: {0}")]
    ConfigError(String),

    #[error("Cache error: {0}")]
    CacheError(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

/// Convert AWS SDK `SdkError` into `CloudSdkError`.
/// This is a generic converter — callers wrap their SDK errors through this.
impl CloudSdkError {
    pub fn aws<E: fmt::Display>(err: E) -> Self {
        CloudSdkError::Aws(err.to_string())
    }

    pub fn gcp<E: fmt::Display>(err: E) -> Self {
        CloudSdkError::Gcp(err.to_string())
    }

    pub fn azure<E: fmt::Display>(err: E) -> Self {
        CloudSdkError::Azure(err.to_string())
    }
}

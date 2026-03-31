use thiserror::Error;

#[derive(Debug, Error)]
pub enum CloudError {
    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),
    #[error("Resource not found: {0}")]
    NotFound(String),
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    #[error("Rate limited: retry after {0}s")]
    RateLimited(u64),
    #[error("Provider error: {0}")]
    ProviderError(String),
    #[error("Invalid request: {0}")]
    InvalidRequest(String),
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

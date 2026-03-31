use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AuthError;
use crate::models::user::User;

/// JWT claims embedded in access and refresh tokens.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// Subject — the user ID.
    pub sub: Uuid,
    pub role: String,
    pub email: String,
    /// Expiration (Unix timestamp).
    pub exp: usize,
    /// Issued-at (Unix timestamp).
    pub iat: usize,
    /// Token type: "access" or "refresh".
    pub token_type: String,
}

/// Create a short-lived access token for the given user.
pub fn create_access_token(user: &User, secret: &str, expiry_secs: u64) -> Result<String, AuthError> {
    let now = Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: user.id,
        role: user.role.to_string(),
        email: user.email.clone(),
        exp: now + expiry_secs as usize,
        iat: now,
        token_type: "access".to_owned(),
    };

    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AuthError::Internal(format!("JWT encode error: {e}")))
}

/// Create a long-lived refresh token for the given user.
pub fn create_refresh_token(user: &User, secret: &str, expiry_secs: u64) -> Result<String, AuthError> {
    let now = Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: user.id,
        role: user.role.to_string(),
        email: user.email.clone(),
        exp: now + expiry_secs as usize,
        iat: now,
        token_type: "refresh".to_owned(),
    };

    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AuthError::Internal(format!("JWT encode error: {e}")))
}

/// Validate a token string and return its claims.
pub fn validate_token(token: &str, secret: &str) -> Result<Claims, AuthError> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;

    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map(|data| data.claims)
    .map_err(|e| match e.kind() {
        jsonwebtoken::errors::ErrorKind::ExpiredSignature => AuthError::TokenExpired,
        _ => AuthError::InvalidToken,
    })
}

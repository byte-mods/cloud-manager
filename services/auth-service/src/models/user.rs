use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// User model stored in SurrealDB.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub role: String,
    pub mfa_enabled: bool,
    pub must_change_password: bool,
    pub created_at: String,
}

/// Request for initial signup (creates super admin).
#[derive(Debug, Deserialize)]
pub struct SignupRequest {
    pub email: String,
    pub name: String,
    pub password: String,
}

/// Request for admin creating a new user.
#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub email: String,
    pub name: String,
    pub password: String,
    pub role: Option<String>,
}

/// Request for login.
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

/// Request for changing password.
#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

/// Request for updating a user's role.
#[derive(Debug, Deserialize)]
pub struct UpdateRoleRequest {
    pub role: String,
}

/// Safe public response (no password hash).
#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub role: String,
    pub mfa_enabled: bool,
    pub must_change_password: bool,
    pub created_at: String,
}

impl From<User> for UserResponse {
    fn from(u: User) -> Self {
        Self {
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            mfa_enabled: u.mfa_enabled,
            must_change_password: u.must_change_password,
            created_at: u.created_at,
        }
    }
}

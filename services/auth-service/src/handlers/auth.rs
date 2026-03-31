use actix_web::{web, HttpResponse};
use cloud_common::Database;

use crate::config::AppConfig;
use crate::error::AuthError;
use crate::jwt;
use crate::models::user::{LoginRequest, SignupRequest, ChangePasswordRequest, User};

/// POST /signup — First-time setup. Creates super admin account.
/// Only works when no users exist in the database.
pub async fn signup(
    db: web::Data<Database>,
    config: web::Data<AppConfig>,
    body: web::Json<SignupRequest>,
) -> Result<HttpResponse, AuthError> {
    let req = body.into_inner();

    if req.email.is_empty() || !req.email.contains('@') {
        return Err(AuthError::Validation("Invalid email".into()));
    }
    if req.password.len() < 8 {
        return Err(AuthError::Validation("Password must be at least 8 characters".into()));
    }

    // Check if any users exist — signup only works for first user
    let users: Vec<serde_json::Value> = db.list("users").await.map_err(|e| AuthError::Database(e))?;
    if !users.is_empty() {
        return Err(AuthError::Validation("Signup disabled. Admin already exists. Ask your admin to create your account.".into()));
    }

    let id = uuid::Uuid::new_v4();
    let hash = bcrypt::hash(&req.password, 10).map_err(|e| AuthError::Internal(e.to_string()))?;

    let user_data = serde_json::json!({
        "id": id.to_string(),
        "email": req.email,
        "name": req.name,
        "password_hash": hash,
        "role": "cloud_architect",
        "mfa_enabled": false,
        "must_change_password": false,
        "created_at": chrono::Utc::now().to_rfc3339(),
    });

    let _: Option<serde_json::Value> = db.create_with_id("users", &id.to_string(), user_data)
        .await.map_err(|e| AuthError::Database(e))?;

    let user = User { id, email: req.email.clone(), name: req.name.clone(), password_hash: hash, role: "cloud_architect".into(), mfa_enabled: false, must_change_password: false, created_at: chrono::Utc::now().to_rfc3339() };
    let access_token = jwt::create_access_token(&user, &config.jwt_secret, config.jwt_expiry)?;

    Ok(HttpResponse::Created().json(serde_json::json!({
        "user": { "id": id, "email": req.email, "name": req.name, "role": "cloud_architect" },
        "access_token": access_token,
        "message": "Super admin account created"
    })))
}

/// POST /login
pub async fn login(
    db: web::Data<Database>,
    config: web::Data<AppConfig>,
    body: web::Json<LoginRequest>,
) -> Result<HttpResponse, AuthError> {
    let req = body.into_inner();

    let mut response = db.inner()
        .query("SELECT * FROM users WHERE email = $email LIMIT 1")
        .bind(("email", req.email.clone()))
        .await
        .map_err(|e| AuthError::Database(e.to_string()))?;

    let user_data: Option<serde_json::Value> = response.take(0).map_err(|e| AuthError::Database(e.to_string()))?;
    let u = user_data.ok_or(AuthError::InvalidCredentials)?;

    let stored_hash = u.get("password_hash").and_then(|v| v.as_str()).unwrap_or("");
    if !bcrypt::verify(&req.password, stored_hash).unwrap_or(false) {
        return Err(AuthError::InvalidCredentials);
    }

    let uid = u.get("id").and_then(|v| v.as_str()).unwrap_or("");
    let user = User {
        id: uuid::Uuid::parse_str(uid).unwrap_or_else(|_| uuid::Uuid::new_v4()),
        email: u.get("email").and_then(|v| v.as_str()).unwrap_or("").into(),
        name: u.get("name").and_then(|v| v.as_str()).unwrap_or("").into(),
        password_hash: stored_hash.into(),
        role: u.get("role").and_then(|v| v.as_str()).unwrap_or("cloud_architect").into(),
        mfa_enabled: u.get("mfa_enabled").and_then(|v| v.as_bool()).unwrap_or(false),
        must_change_password: u.get("must_change_password").and_then(|v| v.as_bool()).unwrap_or(false),
        created_at: u.get("created_at").and_then(|v| v.as_str()).unwrap_or("").into(),
    };

    let access_token = jwt::create_access_token(&user, &config.jwt_secret, config.jwt_expiry)?;
    let refresh_token = jwt::create_refresh_token(&user, &config.jwt_secret, config.refresh_token_expiry)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "user": { "id": user.id, "email": user.email, "name": user.name, "role": user.role, "mfa_enabled": user.mfa_enabled, "must_change_password": user.must_change_password },
        "access_token": access_token,
        "refresh_token": refresh_token,
    })))
}

/// POST /users — Admin creates a new user with role and temporary password.
pub async fn create_user(
    db: web::Data<Database>,
    body: web::Json<crate::models::user::CreateUserRequest>,
) -> Result<HttpResponse, AuthError> {
    let req = body.into_inner();

    if req.email.is_empty() || !req.email.contains('@') {
        return Err(AuthError::Validation("Invalid email".into()));
    }
    if req.password.len() < 8 {
        return Err(AuthError::Validation("Password must be at least 8 characters".into()));
    }

    // Check duplicate
    let mut resp = db.inner()
        .query("SELECT * FROM users WHERE email = $email LIMIT 1")
        .bind(("email", req.email.clone()))
        .await.map_err(|e| AuthError::Database(e.to_string()))?;
    let existing: Option<serde_json::Value> = resp.take(0).map_err(|e| AuthError::Database(e.to_string()))?;
    if existing.is_some() {
        return Err(AuthError::UserAlreadyExists);
    }

    let id = uuid::Uuid::new_v4();
    let hash = bcrypt::hash(&req.password, 10).map_err(|e| AuthError::Internal(e.to_string()))?;
    let role = req.role.unwrap_or_else(|| "cloud_architect".into());

    let _: Option<serde_json::Value> = db.create_with_id("users", &id.to_string(), serde_json::json!({
        "id": id.to_string(), "email": req.email, "name": req.name, "password_hash": hash,
        "role": role, "mfa_enabled": false, "must_change_password": true, "created_at": chrono::Utc::now().to_rfc3339(),
    })).await.map_err(|e| AuthError::Database(e))?;

    Ok(HttpResponse::Created().json(serde_json::json!({
        "user": { "id": id, "email": req.email, "name": req.name, "role": role, "must_change_password": true },
        "message": "User created. They must change password on first login."
    })))
}

/// PUT /change-password
pub async fn change_password(
    db: web::Data<Database>,
    body: web::Json<ChangePasswordRequest>,
) -> Result<HttpResponse, AuthError> {
    let req = body.into_inner();
    if req.new_password.len() < 8 {
        return Err(AuthError::Validation("Password must be at least 8 characters".into()));
    }

    // TODO: extract user ID from JWT. For now, use email-based lookup.
    let users: Vec<serde_json::Value> = db.list("users").await.map_err(|e| AuthError::Database(e))?;
    let user = users.first().ok_or(AuthError::UserNotFound)?;
    let stored_hash = user.get("password_hash").and_then(|v| v.as_str()).unwrap_or("");
    if !bcrypt::verify(&req.current_password, stored_hash).unwrap_or(false) {
        return Err(AuthError::InvalidCredentials);
    }

    let new_hash = bcrypt::hash(&req.new_password, 10).map_err(|e| AuthError::Internal(e.to_string()))?;
    let uid = user.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();

    db.inner()
        .query("UPDATE users SET password_hash = $hash, must_change_password = false WHERE id = $uid")
        .bind(("hash", new_hash))
        .bind(("uid", uid))
        .await.map_err(|e| AuthError::Database(e.to_string()))?;

    Ok(HttpResponse::Ok().json(serde_json::json!({ "message": "Password changed" })))
}

/// POST /refresh
pub async fn refresh(
    config: web::Data<AppConfig>,
    body: web::Json<serde_json::Value>,
) -> Result<HttpResponse, AuthError> {
    let token = body.get("refresh_token").and_then(|v| v.as_str())
        .ok_or(AuthError::Validation("refresh_token required".into()))?;

    let claims = jwt::validate_token(token, &config.jwt_secret)?;
    if claims.token_type != "refresh" {
        return Err(AuthError::InvalidToken);
    }

    let user = User { id: claims.sub, email: claims.email, name: "".into(), password_hash: "".into(), role: claims.role, mfa_enabled: false, must_change_password: false, created_at: "".into() };
    let access_token = jwt::create_access_token(&user, &config.jwt_secret, config.jwt_expiry)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({ "access_token": access_token })))
}

/// POST /logout (stateless JWT — no-op)
pub async fn logout() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "message": "Logged out" }))
}

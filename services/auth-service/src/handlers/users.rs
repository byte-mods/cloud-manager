use actix_web::{web, HttpResponse};
use cloud_common::Database;

use crate::error::AuthError;
use crate::models::user::UpdateRoleRequest;

/// GET /users
pub async fn list_users(db: web::Data<Database>) -> Result<HttpResponse, AuthError> {
    let users: Vec<serde_json::Value> = db.list("users").await.map_err(|e| AuthError::Database(e))?;
    let safe: Vec<serde_json::Value> = users.into_iter().map(|mut u| {
        if let Some(obj) = u.as_object_mut() { obj.remove("password_hash"); }
        u
    }).collect();
    Ok(HttpResponse::Ok().json(serde_json::json!({ "users": safe, "total": safe.len() })))
}

/// GET /users/{id}
pub async fn get_user(db: web::Data<Database>, path: web::Path<String>) -> Result<HttpResponse, AuthError> {
    let id = path.into_inner();
    let user: Option<serde_json::Value> = db.get("users", &id).await.map_err(|e| AuthError::Database(e))?;
    match user {
        Some(mut u) => {
            if let Some(obj) = u.as_object_mut() { obj.remove("password_hash"); }
            Ok(HttpResponse::Ok().json(u))
        }
        None => Err(AuthError::UserNotFound),
    }
}

/// PUT /users/{id}/role
pub async fn update_role(db: web::Data<Database>, path: web::Path<String>, body: web::Json<UpdateRoleRequest>) -> Result<HttpResponse, AuthError> {
    let id = path.into_inner();
    let role = body.into_inner().role;
    let valid = ["cloud_architect", "devops_engineer", "data_engineer", "system_admin", "network_admin"];
    if !valid.contains(&role.as_str()) {
        return Err(AuthError::Validation(format!("Invalid role. Must be one of: {}", valid.join(", "))));
    }
    db.inner().query("UPDATE users SET role = $role WHERE id = $id")
        .bind(("role", role.clone())).bind(("id", id))
        .await.map_err(|e| AuthError::Database(e.to_string()))?;
    Ok(HttpResponse::Ok().json(serde_json::json!({ "message": "Role updated", "role": role })))
}

/// DELETE /users/{id}
pub async fn delete_user(db: web::Data<Database>, path: web::Path<String>) -> Result<HttpResponse, AuthError> {
    let id = path.into_inner();
    db.delete("users", &id).await.map_err(|e| AuthError::Database(e))?;
    Ok(HttpResponse::Ok().json(serde_json::json!({ "message": "User deleted" })))
}

use actix_web::{web, HttpResponse};

use crate::data::paths;
use crate::error::TutorialError;

/// GET /api/v1/learn/paths
///
/// Returns all available learning paths.
pub async fn list_paths() -> Result<HttpResponse, TutorialError> {
    let all_paths = paths::get_all_learning_paths();
    Ok(HttpResponse::Ok().json(all_paths))
}

/// GET /api/v1/learn/paths/{role}
///
/// Returns the learning path for a specific role.
pub async fn get_path_by_role(
    path: web::Path<String>,
) -> Result<HttpResponse, TutorialError> {
    let role = path.into_inner();
    let learning_path = paths::get_learning_path_by_role(&role)
        .ok_or_else(|| TutorialError::NotFound(format!("No learning path for role: {role}")))?;

    Ok(HttpResponse::Ok().json(learning_path))
}

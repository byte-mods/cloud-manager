use actix_web::{web, HttpResponse};
use uuid::Uuid;

use crate::data::paths;
use crate::error::TutorialError;

/// GET /api/v1/learn/tutorials
///
/// Returns all available tutorials.
pub async fn list_tutorials() -> Result<HttpResponse, TutorialError> {
    let tutorials = paths::get_all_tutorials();

    // Return summaries rather than full tutorial content.
    let summaries: Vec<serde_json::Value> = tutorials
        .iter()
        .map(|t| {
            serde_json::json!({
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "difficulty": t.difficulty,
                "duration_minutes": t.duration_minutes,
                "provider": t.provider,
                "tags": t.tags,
                "step_count": t.steps.len(),
            })
        })
        .collect();

    Ok(HttpResponse::Ok().json(summaries))
}

/// GET /api/v1/learn/tutorials/{id}
///
/// Returns a full tutorial by ID, including all steps.
pub async fn get_tutorial(
    path: web::Path<Uuid>,
) -> Result<HttpResponse, TutorialError> {
    let tutorial_id = path.into_inner();
    let tutorial = paths::get_tutorial_by_id(tutorial_id).ok_or_else(|| {
        TutorialError::NotFound(format!("Tutorial not found: {tutorial_id}"))
    })?;

    Ok(HttpResponse::Ok().json(tutorial))
}

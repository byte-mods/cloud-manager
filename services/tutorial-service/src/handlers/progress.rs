use actix_web::{web, HttpResponse};
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

use crate::data::paths;
use crate::error::TutorialError;
use crate::models::progress::{CompleteStepRequest, CompleteStepResponse, PathProgress, UserProgress};

/// Shared in-memory progress store (replace with database in production).
pub type ProgressStore = Mutex<HashMap<Uuid, UserProgress>>;

/// GET /api/v1/learn/progress/{user_id}
///
/// Returns the progress for a specific user.
pub async fn get_progress(
    path: web::Path<Uuid>,
    store: web::Data<ProgressStore>,
) -> Result<HttpResponse, TutorialError> {
    let user_id = path.into_inner();
    let store = store.lock().map_err(|e| TutorialError::Internal(e.to_string()))?;

    let progress = store.get(&user_id).cloned().unwrap_or_else(|| UserProgress {
        user_id,
        completed_tutorials: Vec::new(),
        path_progress: HashMap::new(),
        total_points: 0,
    });

    Ok(HttpResponse::Ok().json(progress))
}

/// PUT /api/v1/learn/progress/{user_id}
///
/// Updates the full progress for a user (admin/sync).
pub async fn update_progress(
    path: web::Path<Uuid>,
    body: web::Json<UserProgress>,
    store: web::Data<ProgressStore>,
) -> Result<HttpResponse, TutorialError> {
    let user_id = path.into_inner();
    let mut progress = body.into_inner();
    progress.user_id = user_id;

    let mut store = store.lock().map_err(|e| TutorialError::Internal(e.to_string()))?;
    store.insert(user_id, progress.clone());

    Ok(HttpResponse::Ok().json(progress))
}

/// POST /api/v1/learn/progress/{user_id}/complete-step
///
/// Marks a tutorial step as completed and awards points.
pub async fn complete_step(
    path: web::Path<Uuid>,
    body: web::Json<CompleteStepRequest>,
    store: web::Data<ProgressStore>,
) -> Result<HttpResponse, TutorialError> {
    let user_id = path.into_inner();
    let request = body.into_inner();

    // Look up the tutorial to validate the step.
    let tutorial = paths::get_tutorial_by_id(request.tutorial_id).ok_or_else(|| {
        TutorialError::NotFound(format!("Tutorial not found: {}", request.tutorial_id))
    })?;

    let step = tutorial
        .steps
        .iter()
        .find(|s| s.id == request.step_id)
        .ok_or_else(|| {
            TutorialError::NotFound(format!("Step not found: {}", request.step_id))
        })?;

    // Check quiz answer if this is a quiz step.
    let quiz_correct = if let Some(quiz) = &step.quiz {
        let answer = request
            .quiz_answer
            .ok_or_else(|| TutorialError::BadRequest("Quiz answer required".into()))?;
        Some(answer == quiz.correct_index)
    } else {
        None
    };

    let points_earned = match quiz_correct {
        Some(true) => 20,
        Some(false) => 5, // Partial credit for attempting.
        None => 10,
    };

    let mut store = store.lock().map_err(|e| TutorialError::Internal(e.to_string()))?;

    let progress = store.entry(user_id).or_insert_with(|| UserProgress {
        user_id,
        completed_tutorials: Vec::new(),
        path_progress: HashMap::new(),
        total_points: 0,
    });

    progress.total_points += points_earned;

    // Update path progress: find which path this tutorial belongs to.
    for lp in paths::get_all_learning_paths() {
        if lp.tutorials.iter().any(|t| t.id == request.tutorial_id) {
            let path_prog = progress
                .path_progress
                .entry(lp.role.clone())
                .or_insert_with(|| PathProgress {
                    tutorials_completed: 0,
                    tutorials_total: lp.tutorials.len() as u32,
                    current_tutorial: Some(request.tutorial_id),
                    current_step: 0,
                });

            path_prog.current_tutorial = Some(request.tutorial_id);
            path_prog.current_step = step.order;

            // Check if tutorial is complete (last step).
            let is_last_step = step.order as usize >= tutorial.steps.len();
            if is_last_step {
                if !progress.completed_tutorials.contains(&request.tutorial_id) {
                    progress.completed_tutorials.push(request.tutorial_id);
                    path_prog.tutorials_completed += 1;
                }
            }

            let tutorial_completed = is_last_step;

            return Ok(HttpResponse::Ok().json(CompleteStepResponse {
                success: true,
                points_earned,
                total_points: progress.total_points,
                tutorial_completed,
                quiz_correct,
            }));
        }
    }

    Ok(HttpResponse::Ok().json(CompleteStepResponse {
        success: true,
        points_earned,
        total_points: progress.total_points,
        tutorial_completed: false,
        quiz_correct,
    }))
}

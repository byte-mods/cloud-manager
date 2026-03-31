use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProgress {
    pub user_id: Uuid,
    pub completed_tutorials: Vec<Uuid>,
    pub path_progress: HashMap<String, PathProgress>,
    pub total_points: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathProgress {
    pub tutorials_completed: u32,
    pub tutorials_total: u32,
    pub current_tutorial: Option<Uuid>,
    pub current_step: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompleteStepRequest {
    pub tutorial_id: Uuid,
    pub step_id: Uuid,
    pub quiz_answer: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompleteStepResponse {
    pub success: bool,
    pub points_earned: u32,
    pub total_points: u32,
    pub tutorial_completed: bool,
    pub quiz_correct: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxRequest {
    pub tutorial_id: Uuid,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxResponse {
    pub sandbox_id: Uuid,
    pub url: String,
    pub status: String,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearningPath {
    pub role: String,
    pub title: String,
    pub description: String,
    pub tutorials: Vec<TutorialSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TutorialSummary {
    pub id: Uuid,
    pub title: String,
    pub difficulty: Difficulty,
    pub duration_minutes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tutorial {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub difficulty: Difficulty,
    pub duration_minutes: u32,
    pub provider: Option<String>,
    pub tags: Vec<String>,
    pub steps: Vec<TutorialStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TutorialStep {
    pub id: Uuid,
    pub title: String,
    pub content: String,
    pub step_type: StepType,
    pub order: u32,
    pub quiz: Option<QuizQuestion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StepType {
    Content,
    CodeExample,
    HandsOn,
    Quiz,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Difficulty {
    Beginner,
    Intermediate,
    Advanced,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuizQuestion {
    pub question: String,
    pub options: Vec<String>,
    pub correct_index: usize,
    pub explanation: String,
}

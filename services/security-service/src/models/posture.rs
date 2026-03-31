use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityPosture {
    pub overall_score: f64,
    pub grade: PostureGrade,
    pub categories: Vec<PostureCategory>,
    pub drift_detected: bool,
    pub drift_details: Vec<DriftDetail>,
    pub assessed_at: DateTime<Utc>,
    pub trend: PostureTrend,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostureCategory {
    pub name: String,
    pub score: f64,
    pub weight: f64,
    pub issues_count: usize,
    pub critical_issues: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriftDetail {
    pub resource_id: String,
    pub resource_type: String,
    pub expected_state: serde_json::Value,
    pub actual_state: serde_json::Value,
    pub detected_at: DateTime<Utc>,
    pub severity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostureTrend {
    pub data_points: Vec<TrendDataPoint>,
    pub direction: TrendDirection,
    pub change_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendDataPoint {
    pub timestamp: DateTime<Utc>,
    pub score: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PostureGrade {
    A,
    B,
    C,
    D,
    F,
}

impl PostureGrade {
    pub fn from_score(score: f64) -> Self {
        match score as u64 {
            90..=100 => PostureGrade::A,
            80..=89 => PostureGrade::B,
            70..=79 => PostureGrade::C,
            60..=69 => PostureGrade::D,
            _ => PostureGrade::F,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TrendDirection {
    Improving,
    Stable,
    Declining,
}

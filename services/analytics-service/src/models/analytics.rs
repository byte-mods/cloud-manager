use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Query Engine ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryEngine {
    pub id: Uuid,
    pub name: String,
    pub engine_type: String,
    pub status: String,
    pub queries_per_day: f64,
    pub avg_query_time_ms: u64,
    pub region: String,
    pub last_health_check: DateTime<Utc>,
}

// ── Query ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct QueryRequest {
    pub query: String,
    pub engine: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub execution_time_ms: u64,
    pub row_count: usize,
    pub engine: String,
}

// ── Visualization ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Visualization {
    pub id: Uuid,
    pub name: String,
    pub chart_type: String,
    pub data_source: String,
    pub query: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateVisualizationRequest {
    pub name: String,
    pub chart_type: String,
    pub data_source: String,
    pub query: Option<String>,
}

// ── Report ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Report {
    pub id: Uuid,
    pub name: String,
    pub schedule: String,
    pub format: String,
    pub status: String,
    pub last_run_at: Option<DateTime<Utc>>,
    pub next_run_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub recipients: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateReportRequest {
    pub name: String,
    pub schedule: String,
    pub format: String,
    pub recipients: Option<Vec<String>>,
}

// ── Search Index ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchIndex {
    pub id: Uuid,
    pub name: String,
    pub document_count: u64,
    pub size_bytes: u64,
    pub status: String,
    pub last_indexed_at: DateTime<Utc>,
    pub index_rate_per_sec: u64,
}

// ── Overview ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsOverview {
    pub total_queries_today: u64,
    pub active_engines: u32,
    pub saved_visualizations: u32,
    pub scheduled_reports: u32,
    pub total_data_scanned_gb: f64,
    pub avg_query_time_ms: u64,
}

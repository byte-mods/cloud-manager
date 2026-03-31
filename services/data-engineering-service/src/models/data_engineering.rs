use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── ETL Pipeline ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtlPipeline {
    pub id: Uuid,
    pub name: String,
    pub status: String,
    pub schedule: String,
    pub engine: String,
    pub source: String,
    pub destination: String,
    pub last_run_at: Option<DateTime<Utc>>,
    pub next_run_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<u64>,
    pub records_processed: Option<u64>,
    pub error_count: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateEtlPipelineRequest {
    pub name: String,
    pub schedule: String,
    pub engine: String,
    pub source: String,
    pub destination: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateEtlPipelineRequest {
    pub name: Option<String>,
    pub schedule: Option<String>,
    pub status: Option<String>,
}

// ── Streaming Job ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamingJob {
    pub id: Uuid,
    pub name: String,
    pub status: String,
    pub source: String,
    pub destination: String,
    pub events_per_sec: u64,
    pub bytes_per_sec: u64,
    pub uptime_hours: f64,
    pub error_count: u32,
    pub last_checkpoint: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateStreamingJobRequest {
    pub name: String,
    pub source: String,
    pub destination: String,
}

// ── Data Lake Dataset ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataLakeDataset {
    pub id: Uuid,
    pub name: String,
    pub format: String,
    pub size_bytes: u64,
    pub size_display: String,
    pub location: String,
    pub row_count: Option<u64>,
    pub partition_count: u32,
    pub last_updated: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub owner: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RegisterDatasetRequest {
    pub name: String,
    pub format: String,
    pub location: String,
    pub owner: Option<String>,
    pub tags: Option<Vec<String>>,
}

// ── Overview ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataEngineeringOverview {
    pub total_pipelines: u32,
    pub running_pipelines: u32,
    pub failed_pipelines: u32,
    pub streaming_jobs: u32,
    pub total_events_per_sec: u64,
    pub data_lake_datasets: u32,
    pub total_data_size_tb: f64,
    pub records_processed_24h: u64,
}

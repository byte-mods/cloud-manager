use async_trait::async_trait;

use crate::error::DataEngineeringError;
use crate::models::data_engineering::{
    CreateEtlPipelineRequest, CreateStreamingJobRequest, DataEngineeringOverview, DataLakeDataset,
    EtlPipeline, RegisterDatasetRequest, StreamingJob,
};

pub type Result<T> = std::result::Result<T, DataEngineeringError>;

/// Trait abstracting over data pipeline operations (ETL, streaming, data lake).
///
/// Implementations include:
/// - In-memory mock store (default / CLOUD_USE_MOCK_DATA=true)
/// - AWS SDK (Glue for ETL, Kinesis for streaming)
#[async_trait]
pub trait DataPipelineProvider: Send + Sync {
    // ── ETL Pipelines ─────────────────────────────────────────────────────

    /// List all ETL pipelines.
    async fn list_pipelines(&self) -> Result<Vec<EtlPipeline>>;

    /// Get a single ETL pipeline by ID.
    async fn get_pipeline(&self, id: &str) -> Result<EtlPipeline>;

    /// Create a new ETL pipeline.
    async fn create_pipeline(&self, request: CreateEtlPipelineRequest) -> Result<EtlPipeline>;

    /// Delete an ETL pipeline.
    async fn delete_pipeline(&self, id: &str) -> Result<()>;

    /// Trigger a pipeline run.
    async fn trigger_pipeline_run(&self, id: &str) -> Result<EtlPipeline>;

    // ── Streaming ─────────────────────────────────────────────────────────

    /// List all streaming jobs.
    async fn list_streaming_jobs(&self) -> Result<Vec<StreamingJob>>;

    /// Create a new streaming job.
    async fn create_streaming_job(&self, request: CreateStreamingJobRequest) -> Result<StreamingJob>;

    // ── Data Lake ─────────────────────────────────────────────────────────

    /// List all data-lake datasets.
    async fn list_datasets(&self) -> Result<Vec<DataLakeDataset>>;

    /// Register a new dataset in the data lake catalog.
    async fn register_dataset(&self, request: RegisterDatasetRequest) -> Result<DataLakeDataset>;

    // ── Overview ──────────────────────────────────────────────────────────

    /// Get a high-level overview of data engineering resources.
    async fn get_overview(&self) -> Result<DataEngineeringOverview>;
}

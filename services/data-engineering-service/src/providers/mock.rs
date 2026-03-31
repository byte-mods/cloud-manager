use std::sync::Arc;

use async_trait::async_trait;
use chrono::Utc;
use uuid::Uuid;

use cloud_common::Database;

use crate::error::DataEngineeringError;
use crate::models::data_engineering::*;
use crate::traits::{DataPipelineProvider, Result};

/// Mock provider backed by SurrealDB.
pub struct MockDataPipelineProvider {
    db: Arc<Database>,
}

impl MockDataPipelineProvider {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl DataPipelineProvider for MockDataPipelineProvider {
    // ── ETL ───────────────────────────────────────────────────────────────

    async fn list_pipelines(&self) -> Result<Vec<EtlPipeline>> {
        let pipelines: Vec<EtlPipeline> = self.db.list("etl_pipelines").await.unwrap_or_default();
        Ok(pipelines)
    }

    async fn get_pipeline(&self, id: &str) -> Result<EtlPipeline> {
        // Validate UUID format
        let _: Uuid = id
            .parse()
            .map_err(|_| DataEngineeringError::BadRequest(format!("Invalid UUID: {id}")))?;

        match self.db.get::<EtlPipeline>("etl_pipelines", id).await {
            Ok(Some(pipeline)) => Ok(pipeline),
            _ => Err(DataEngineeringError::NotFound(format!(
                "Pipeline '{id}' not found"
            ))),
        }
    }

    async fn create_pipeline(&self, request: CreateEtlPipelineRequest) -> Result<EtlPipeline> {
        let now = Utc::now();
        let id = Uuid::new_v4();
        let pipeline = EtlPipeline {
            id,
            name: request.name,
            status: "created".into(),
            schedule: request.schedule,
            engine: request.engine,
            source: request.source,
            destination: request.destination,
            last_run_at: None,
            next_run_at: None,
            duration_seconds: None,
            records_processed: None,
            error_count: 0,
            created_at: now,
            updated_at: now,
        };

        let _: Option<EtlPipeline> = self
            .db
            .create_with_id("etl_pipelines", &id.to_string(), pipeline.clone())
            .await
            .ok()
            .flatten();

        Ok(pipeline)
    }

    async fn delete_pipeline(&self, id: &str) -> Result<()> {
        let _: Uuid = id
            .parse()
            .map_err(|_| DataEngineeringError::BadRequest(format!("Invalid UUID: {id}")))?;

        // Check existence first
        match self.db.get::<EtlPipeline>("etl_pipelines", id).await {
            Ok(Some(_)) => {
                self.db
                    .delete("etl_pipelines", id)
                    .await
                    .map_err(|e| DataEngineeringError::Internal(e))?;
                Ok(())
            }
            _ => Err(DataEngineeringError::NotFound(format!(
                "Pipeline '{id}' not found"
            ))),
        }
    }

    async fn trigger_pipeline_run(&self, id: &str) -> Result<EtlPipeline> {
        let _: Uuid = id
            .parse()
            .map_err(|_| DataEngineeringError::BadRequest(format!("Invalid UUID: {id}")))?;

        match self.db.get::<EtlPipeline>("etl_pipelines", id).await {
            Ok(Some(mut pipeline)) => {
                pipeline.status = "running".into();
                pipeline.last_run_at = Some(Utc::now());
                pipeline.updated_at = Utc::now();

                let _: Option<EtlPipeline> = self
                    .db
                    .update("etl_pipelines", id, pipeline.clone())
                    .await
                    .ok()
                    .flatten();

                Ok(pipeline)
            }
            _ => Err(DataEngineeringError::NotFound(format!(
                "Pipeline '{id}' not found"
            ))),
        }
    }

    // ── Streaming ─────────────────────────────────────────────────────────

    async fn list_streaming_jobs(&self) -> Result<Vec<StreamingJob>> {
        let jobs: Vec<StreamingJob> = self.db.list("streaming_jobs").await.unwrap_or_default();
        Ok(jobs)
    }

    async fn create_streaming_job(&self, request: CreateStreamingJobRequest) -> Result<StreamingJob> {
        let now = Utc::now();
        let id = Uuid::new_v4();
        let job = StreamingJob {
            id,
            name: request.name,
            status: "starting".into(),
            source: request.source,
            destination: request.destination,
            events_per_sec: 0,
            bytes_per_sec: 0,
            uptime_hours: 0.0,
            error_count: 0,
            last_checkpoint: now,
            created_at: now,
        };

        let _: Option<StreamingJob> = self
            .db
            .create_with_id("streaming_jobs", &id.to_string(), job.clone())
            .await
            .ok()
            .flatten();

        Ok(job)
    }

    // ── Data Lake ─────────────────────────────────────────────────────────

    async fn list_datasets(&self) -> Result<Vec<DataLakeDataset>> {
        let datasets: Vec<DataLakeDataset> = self.db.list("datasets").await.unwrap_or_default();
        Ok(datasets)
    }

    async fn register_dataset(&self, request: RegisterDatasetRequest) -> Result<DataLakeDataset> {
        let now = Utc::now();
        let id = Uuid::new_v4();
        let dataset = DataLakeDataset {
            id,
            name: request.name,
            format: request.format,
            size_bytes: 0,
            size_display: "0 B".into(),
            location: request.location,
            row_count: None,
            partition_count: 0,
            last_updated: now,
            created_at: now,
            owner: request.owner.unwrap_or_else(|| "unknown".to_string()),
            tags: request.tags.unwrap_or_default(),
        };

        let _: Option<DataLakeDataset> = self
            .db
            .create_with_id("datasets", &id.to_string(), dataset.clone())
            .await
            .ok()
            .flatten();

        Ok(dataset)
    }

    // ── Overview ──────────────────────────────────────────────────────────

    async fn get_overview(&self) -> Result<DataEngineeringOverview> {
        let pipelines: Vec<EtlPipeline> = self.db.list("etl_pipelines").await.unwrap_or_default();
        let streaming: Vec<StreamingJob> = self.db.list("streaming_jobs").await.unwrap_or_default();
        let datasets: Vec<DataLakeDataset> = self.db.list("datasets").await.unwrap_or_default();

        let running = pipelines.iter().filter(|p| p.status == "running").count() as u32;
        let failed = pipelines.iter().filter(|p| p.status == "failed").count() as u32;
        let total_eps: u64 = streaming.iter().map(|s| s.events_per_sec).sum();
        let total_size_bytes: u64 = datasets.iter().map(|d| d.size_bytes).sum();
        let total_records: u64 = pipelines.iter().filter_map(|p| p.records_processed).sum();

        Ok(DataEngineeringOverview {
            total_pipelines: pipelines.len() as u32,
            running_pipelines: running,
            failed_pipelines: failed,
            streaming_jobs: streaming.len() as u32,
            total_events_per_sec: total_eps,
            data_lake_datasets: datasets.len() as u32,
            total_data_size_tb: (total_size_bytes as f64 / 1_099_511_627_776.0 * 100.0).round()
                / 100.0,
            records_processed_24h: total_records,
        })
    }
}

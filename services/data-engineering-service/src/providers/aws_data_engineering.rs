use std::sync::Arc;

use async_trait::async_trait;
use chrono::Utc;
use uuid::Uuid;

use cloud_common::{CredentialManager, RedisCache};

use crate::error::DataEngineeringError;
use crate::models::data_engineering::*;
use crate::traits::{DataPipelineProvider, Result};

/// AWS-backed data-engineering provider using Glue (ETL) and Kinesis (streaming).
pub struct AwsDataEngineeringProvider {
    credentials: Arc<CredentialManager>,
    #[allow(dead_code)]
    cache: Option<Arc<RedisCache>>,
    default_region: String,
}

impl AwsDataEngineeringProvider {
    pub fn new(
        credentials: Arc<CredentialManager>,
        cache: Option<Arc<RedisCache>>,
        default_region: String,
    ) -> Self {
        Self {
            credentials,
            cache,
            default_region,
        }
    }

    fn glue_client(&self) -> Result<aws_sdk_glue::Client> {
        let config = self
            .credentials
            .aws_config_for_region(&self.default_region)
            .map_err(|e| DataEngineeringError::Internal(e.to_string()))?;
        Ok(aws_sdk_glue::Client::new(&config))
    }

    fn kinesis_client(&self) -> Result<aws_sdk_kinesis::Client> {
        let config = self
            .credentials
            .aws_config_for_region(&self.default_region)
            .map_err(|e| DataEngineeringError::Internal(e.to_string()))?;
        Ok(aws_sdk_kinesis::Client::new(&config))
    }
}

#[async_trait]
impl DataPipelineProvider for AwsDataEngineeringProvider {
    // ── ETL Pipelines (AWS Glue Jobs) ─────────────────────────────────────

    async fn list_pipelines(&self) -> Result<Vec<EtlPipeline>> {
        tracing::info!(region = %self.default_region, "Listing Glue jobs via AWS SDK");

        let glue = self.glue_client()?;
        let resp = glue
            .get_jobs()
            .send()
            .await
            .map_err(|e| DataEngineeringError::Internal(format!("AWS Glue GetJobs: {e}")))?;

        let pipelines = resp
            .jobs()
            .iter()
            .map(|job| {
                let name = job.name().unwrap_or_default().to_owned();
                let created = job
                    .created_on()
                    .and_then(|t| {
                        chrono::DateTime::from_timestamp(t.secs(), t.subsec_nanos())
                    })
                    .unwrap_or_else(Utc::now);
                let updated = job
                    .last_modified_on()
                    .and_then(|t| {
                        chrono::DateTime::from_timestamp(t.secs(), t.subsec_nanos())
                    })
                    .unwrap_or_else(Utc::now);

                EtlPipeline {
                    id: Uuid::new_v4(),
                    name: name.clone(),
                    status: "available".into(),
                    schedule: job
                        .command()
                        .and_then(|c| c.name().map(|n| n.to_owned()))
                        .unwrap_or_else(|| "on-demand".into()),
                    engine: "AWS Glue".into(),
                    source: job
                        .connections()
                        .and_then(|c| c.connections().first().map(|s| s.to_owned()))
                        .unwrap_or_else(|| "N/A".into()),
                    destination: job
                        .default_arguments()
                        .and_then(|args| {
                            args.get("--output_path").map(|s| s.to_owned())
                        })
                        .unwrap_or_else(|| "N/A".into()),
                    last_run_at: None,
                    next_run_at: None,
                    duration_seconds: Some(job.max_retries() as u64),
                    records_processed: None,
                    error_count: 0,
                    created_at: created,
                    updated_at: updated,
                }
            })
            .collect();

        Ok(pipelines)
    }

    async fn get_pipeline(&self, id: &str) -> Result<EtlPipeline> {
        tracing::info!(job_name = %id, "Getting Glue job via AWS SDK");

        let glue = self.glue_client()?;
        let resp = glue
            .get_job()
            .job_name(id)
            .send()
            .await
            .map_err(|e| DataEngineeringError::NotFound(format!("Glue job '{id}': {e}")))?;

        let job = resp
            .job()
            .ok_or_else(|| DataEngineeringError::NotFound(format!("Glue job '{id}' not found")))?;

        let created = job
            .created_on()
            .and_then(|t| chrono::DateTime::from_timestamp(t.secs(), t.subsec_nanos()))
            .unwrap_or_else(Utc::now);
        let updated = job
            .last_modified_on()
            .and_then(|t| chrono::DateTime::from_timestamp(t.secs(), t.subsec_nanos()))
            .unwrap_or_else(Utc::now);

        Ok(EtlPipeline {
            id: Uuid::new_v4(),
            name: job.name().unwrap_or_default().to_owned(),
            status: "available".into(),
            schedule: "on-demand".into(),
            engine: "AWS Glue".into(),
            source: "N/A".into(),
            destination: "N/A".into(),
            last_run_at: None,
            next_run_at: None,
            duration_seconds: None,
            records_processed: None,
            error_count: 0,
            created_at: created,
            updated_at: updated,
        })
    }

    async fn create_pipeline(&self, request: CreateEtlPipelineRequest) -> Result<EtlPipeline> {
        tracing::info!(name = %request.name, "Creating Glue job via AWS SDK");

        let glue = self.glue_client()?;

        let command = aws_sdk_glue::types::JobCommand::builder()
            .name("glueetl")
            .script_location(format!("s3://glue-scripts/{}.py", request.name))
            .python_version("3")
            .build();

        glue.create_job()
            .name(&request.name)
            .role("arn:aws:iam::role/GlueServiceRole")
            .command(command)
            .glue_version("4.0")
            .number_of_workers(2)
            .worker_type(aws_sdk_glue::types::WorkerType::G1X)
            .send()
            .await
            .map_err(|e| {
                DataEngineeringError::Internal(format!("AWS Glue CreateJob: {e}"))
            })?;

        let now = Utc::now();
        Ok(EtlPipeline {
            id: Uuid::new_v4(),
            name: request.name,
            status: "created".into(),
            schedule: request.schedule,
            engine: "AWS Glue".into(),
            source: request.source,
            destination: request.destination,
            last_run_at: None,
            next_run_at: None,
            duration_seconds: None,
            records_processed: None,
            error_count: 0,
            created_at: now,
            updated_at: now,
        })
    }

    async fn delete_pipeline(&self, id: &str) -> Result<()> {
        tracing::info!(job_name = %id, "Deleting Glue job via AWS SDK");

        let glue = self.glue_client()?;
        glue.delete_job()
            .job_name(id)
            .send()
            .await
            .map_err(|e| DataEngineeringError::Internal(format!("AWS Glue DeleteJob: {e}")))?;

        Ok(())
    }

    async fn trigger_pipeline_run(&self, id: &str) -> Result<EtlPipeline> {
        tracing::info!(job_name = %id, "Starting Glue job run via AWS SDK");

        let glue = self.glue_client()?;
        let run_resp = glue
            .start_job_run()
            .job_name(id)
            .send()
            .await
            .map_err(|e| {
                DataEngineeringError::Internal(format!("AWS Glue StartJobRun: {e}"))
            })?;

        let run_id = run_resp
            .job_run_id()
            .unwrap_or("unknown")
            .to_owned();

        tracing::info!(job_name = %id, run_id = %run_id, "Glue job run started");

        let now = Utc::now();
        Ok(EtlPipeline {
            id: Uuid::new_v4(),
            name: id.to_owned(),
            status: "running".into(),
            schedule: "on-demand".into(),
            engine: "AWS Glue".into(),
            source: "N/A".into(),
            destination: "N/A".into(),
            last_run_at: Some(now),
            next_run_at: None,
            duration_seconds: None,
            records_processed: None,
            error_count: 0,
            created_at: now,
            updated_at: now,
        })
    }

    // ── Streaming (AWS Kinesis) ───────────────────────────────────────────

    async fn list_streaming_jobs(&self) -> Result<Vec<StreamingJob>> {
        tracing::info!(region = %self.default_region, "Listing Kinesis streams via AWS SDK");

        let kinesis = self.kinesis_client()?;
        let resp = kinesis
            .list_streams()
            .send()
            .await
            .map_err(|e| DataEngineeringError::Internal(format!("Kinesis ListStreams: {e}")))?;

        let now = Utc::now();
        let jobs: Vec<StreamingJob> = resp
            .stream_names()
            .iter()
            .map(|name| StreamingJob {
                id: Uuid::new_v4(),
                name: name.clone(),
                status: "running".into(),
                source: format!("Kinesis ({})", name),
                destination: "N/A".into(),
                events_per_sec: 0,
                bytes_per_sec: 0,
                uptime_hours: 0.0,
                error_count: 0,
                last_checkpoint: now,
                created_at: now,
            })
            .collect();

        Ok(jobs)
    }

    async fn create_streaming_job(
        &self,
        request: CreateStreamingJobRequest,
    ) -> Result<StreamingJob> {
        tracing::info!(name = %request.name, "Creating Kinesis stream via AWS SDK");

        let kinesis = self.kinesis_client()?;
        kinesis
            .create_stream()
            .stream_name(&request.name)
            .shard_count(1)
            .send()
            .await
            .map_err(|e| {
                DataEngineeringError::Internal(format!("Kinesis CreateStream: {e}"))
            })?;

        let now = Utc::now();
        Ok(StreamingJob {
            id: Uuid::new_v4(),
            name: request.name,
            status: "creating".into(),
            source: request.source,
            destination: request.destination,
            events_per_sec: 0,
            bytes_per_sec: 0,
            uptime_hours: 0.0,
            error_count: 0,
            last_checkpoint: now,
            created_at: now,
        })
    }

    // ── Data Lake (Glue Data Catalog) ─────────────────────────────────────

    async fn list_datasets(&self) -> Result<Vec<DataLakeDataset>> {
        tracing::info!(region = %self.default_region, "Listing Glue databases/tables via AWS SDK");

        let glue = self.glue_client()?;
        let resp = glue
            .get_databases()
            .send()
            .await
            .map_err(|e| {
                DataEngineeringError::Internal(format!("Glue GetDatabases: {e}"))
            })?;

        let now = Utc::now();
        let datasets: Vec<DataLakeDataset> = resp
            .database_list()
            .iter()
            .map(|db| {
                let name = db.name().to_owned();
                let created = db
                    .create_time()
                    .and_then(|t| {
                        chrono::DateTime::from_timestamp(t.secs(), t.subsec_nanos())
                    })
                    .unwrap_or_else(Utc::now);

                DataLakeDataset {
                    id: Uuid::new_v4(),
                    name: name.clone(),
                    format: "glue_catalog".into(),
                    size_bytes: 0,
                    size_display: "N/A".into(),
                    location: db
                        .location_uri()
                        .unwrap_or("N/A")
                        .to_owned(),
                    row_count: None,
                    partition_count: 0,
                    last_updated: now,
                    created_at: created,
                    owner: "aws-glue".into(),
                    tags: db
                        .parameters()
                        .map(|p| p.keys().cloned().collect())
                        .unwrap_or_default(),
                }
            })
            .collect();

        Ok(datasets)
    }

    async fn register_dataset(&self, request: RegisterDatasetRequest) -> Result<DataLakeDataset> {
        tracing::info!(name = %request.name, "Creating Glue database via AWS SDK");

        let glue = self.glue_client()?;

        let db_input = aws_sdk_glue::types::DatabaseInput::builder()
            .name(&request.name)
            .location_uri(&request.location)
            .description(format!("Data lake dataset: {}", request.name))
            .build()
            .map_err(|e| {
                DataEngineeringError::Internal(format!("Failed to build DatabaseInput: {e}"))
            })?;

        glue.create_database()
            .database_input(db_input)
            .send()
            .await
            .map_err(|e| {
                DataEngineeringError::Internal(format!("Glue CreateDatabase: {e}"))
            })?;

        let now = Utc::now();
        Ok(DataLakeDataset {
            id: Uuid::new_v4(),
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
        })
    }

    // ── Overview ──────────────────────────────────────────────────────────

    async fn get_overview(&self) -> Result<DataEngineeringOverview> {
        // Aggregate from the individual list calls.
        let pipelines = self.list_pipelines().await?;
        let streams = self.list_streaming_jobs().await?;
        let datasets = self.list_datasets().await?;

        let running = pipelines.iter().filter(|p| p.status == "running").count() as u32;
        let failed = pipelines.iter().filter(|p| p.status == "failed").count() as u32;
        let total_eps: u64 = streams.iter().map(|s| s.events_per_sec).sum();
        let total_size: u64 = datasets.iter().map(|d| d.size_bytes).sum();
        let total_records: u64 = pipelines.iter().filter_map(|p| p.records_processed).sum();

        Ok(DataEngineeringOverview {
            total_pipelines: pipelines.len() as u32,
            running_pipelines: running,
            failed_pipelines: failed,
            streaming_jobs: streams.len() as u32,
            total_events_per_sec: total_eps,
            data_lake_datasets: datasets.len() as u32,
            total_data_size_tb: (total_size as f64 / 1_099_511_627_776.0 * 100.0).round() / 100.0,
            records_processed_24h: total_records,
        })
    }
}

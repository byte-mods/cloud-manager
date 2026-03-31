use chrono::{Duration, Utc};
use cloud_common::Database;
use uuid::Uuid;

use crate::models::data_engineering::*;

/// Seed all data engineering tables if they are empty.
pub async fn seed_if_empty(db: &Database) {
    let now = Utc::now();

    // Seed ETL pipelines
    let existing: Vec<EtlPipeline> = db.list("etl_pipelines").await.unwrap_or_default();
    if existing.is_empty() {
        for pipeline in seed_etl_pipelines(now) {
            let _: Option<EtlPipeline> = db
                .create_with_id("etl_pipelines", &pipeline.id.to_string(), pipeline)
                .await
                .ok()
                .flatten();
        }
        tracing::info!("Seeded etl_pipelines table");
    }

    // Seed streaming jobs
    let existing: Vec<StreamingJob> = db.list("streaming_jobs").await.unwrap_or_default();
    if existing.is_empty() {
        for job in seed_streaming_jobs(now) {
            let _: Option<StreamingJob> = db
                .create_with_id("streaming_jobs", &job.id.to_string(), job)
                .await
                .ok()
                .flatten();
        }
        tracing::info!("Seeded streaming_jobs table");
    }

    // Seed datasets
    let existing: Vec<DataLakeDataset> = db.list("datasets").await.unwrap_or_default();
    if existing.is_empty() {
        for dataset in seed_datasets(now) {
            let _: Option<DataLakeDataset> = db
                .create_with_id("datasets", &dataset.id.to_string(), dataset)
                .await
                .ok()
                .flatten();
        }
        tracing::info!("Seeded datasets table");
    }
}

fn seed_etl_pipelines(now: chrono::DateTime<Utc>) -> Vec<EtlPipeline> {
    vec![
        EtlPipeline {
            id: Uuid::new_v4(),
            name: "Customer Data Sync".into(),
            status: "running".into(),
            schedule: "hourly".into(),
            engine: "AWS Glue".into(),
            source: "RDS PostgreSQL (customers)".into(),
            destination: "S3 (s3://data-lake/customers/)".into(),
            last_run_at: Some(now - Duration::minutes(35)),
            next_run_at: Some(now + Duration::minutes(25)),
            duration_seconds: Some(245),
            records_processed: Some(48_500),
            error_count: 0,
            created_at: now - Duration::days(60),
            updated_at: now - Duration::minutes(35),
        },
        EtlPipeline {
            id: Uuid::new_v4(),
            name: "Product Catalog Update".into(),
            status: "succeeded".into(),
            schedule: "daily".into(),
            engine: "GCP Dataflow".into(),
            source: "Cloud SQL (products)".into(),
            destination: "BigQuery (analytics.product_catalog)".into(),
            last_run_at: Some(now - Duration::hours(6)),
            next_run_at: Some(now + Duration::hours(18)),
            duration_seconds: Some(1820),
            records_processed: Some(234_000),
            error_count: 0,
            created_at: now - Duration::days(45),
            updated_at: now - Duration::hours(6),
        },
        EtlPipeline {
            id: Uuid::new_v4(),
            name: "Transaction Processing".into(),
            status: "running".into(),
            schedule: "real-time".into(),
            engine: "Azure Data Factory".into(),
            source: "Azure SQL (transactions)".into(),
            destination: "ADLS Gen2 (transactions/)".into(),
            last_run_at: Some(now - Duration::seconds(30)),
            next_run_at: None, // continuous
            duration_seconds: None, // ongoing
            records_processed: Some(1_245_000),
            error_count: 3,
            created_at: now - Duration::days(30),
            updated_at: now - Duration::seconds(30),
        },
        EtlPipeline {
            id: Uuid::new_v4(),
            name: "Log Aggregation".into(),
            status: "failed".into(),
            schedule: "hourly".into(),
            engine: "AWS Glue".into(),
            source: "CloudWatch Logs".into(),
            destination: "S3 (s3://data-lake/logs/)".into(),
            last_run_at: Some(now - Duration::hours(1)),
            next_run_at: None, // failed, no next run until fixed
            duration_seconds: Some(120),
            records_processed: Some(12_000),
            error_count: 15,
            created_at: now - Duration::days(90),
            updated_at: now - Duration::hours(1),
        },
        EtlPipeline {
            id: Uuid::new_v4(),
            name: "Marketing Analytics".into(),
            status: "paused".into(),
            schedule: "daily".into(),
            engine: "GCP Dataflow".into(),
            source: "Google Analytics API".into(),
            destination: "BigQuery (marketing.campaigns)".into(),
            last_run_at: Some(now - Duration::days(3)),
            next_run_at: None, // paused
            duration_seconds: Some(3600),
            records_processed: Some(890_000),
            error_count: 0,
            created_at: now - Duration::days(120),
            updated_at: now - Duration::days(3),
        },
        EtlPipeline {
            id: Uuid::new_v4(),
            name: "Inventory Sync".into(),
            status: "succeeded".into(),
            schedule: "every 6h".into(),
            engine: "Azure Data Factory".into(),
            source: "SAP HANA (inventory)".into(),
            destination: "Azure Synapse (warehouse.inventory)".into(),
            last_run_at: Some(now - Duration::hours(2)),
            next_run_at: Some(now + Duration::hours(4)),
            duration_seconds: Some(540),
            records_processed: Some(156_000),
            error_count: 0,
            created_at: now - Duration::days(75),
            updated_at: now - Duration::hours(2),
        },
    ]
}

fn seed_streaming_jobs(now: chrono::DateTime<Utc>) -> Vec<StreamingJob> {
    vec![
        StreamingJob {
            id: Uuid::new_v4(),
            name: "Order Events".into(),
            status: "running".into(),
            source: "Kafka (orders-topic)".into(),
            destination: "S3 (s3://data-lake/orders/)".into(),
            events_per_sec: 12_000,
            bytes_per_sec: 4_800_000,
            uptime_hours: 720.5,
            error_count: 2,
            last_checkpoint: now - Duration::seconds(15),
            created_at: now - Duration::days(30),
        },
        StreamingJob {
            id: Uuid::new_v4(),
            name: "Clickstream".into(),
            status: "running".into(),
            source: "PubSub (clickstream-events)".into(),
            destination: "BigQuery (analytics.clickstream)".into(),
            events_per_sec: 45_000,
            bytes_per_sec: 18_000_000,
            uptime_hours: 168.2,
            error_count: 0,
            last_checkpoint: now - Duration::seconds(8),
            created_at: now - Duration::days(7),
        },
        StreamingJob {
            id: Uuid::new_v4(),
            name: "IoT Telemetry".into(),
            status: "running".into(),
            source: "EventHubs (iot-telemetry)".into(),
            destination: "ADLS Gen2 (iot/)".into(),
            events_per_sec: 8_000,
            bytes_per_sec: 3_200_000,
            uptime_hours: 2160.0,
            error_count: 8,
            last_checkpoint: now - Duration::seconds(5),
            created_at: now - Duration::days(90),
        },
        StreamingJob {
            id: Uuid::new_v4(),
            name: "Audit Trail".into(),
            status: "running".into(),
            source: "Kinesis (audit-stream)".into(),
            destination: "Redshift (audit.events)".into(),
            events_per_sec: 2_000,
            bytes_per_sec: 800_000,
            uptime_hours: 504.8,
            error_count: 1,
            last_checkpoint: now - Duration::seconds(20),
            created_at: now - Duration::days(21),
        },
    ]
}

fn seed_datasets(now: chrono::DateTime<Utc>) -> Vec<DataLakeDataset> {
    vec![
        DataLakeDataset {
            id: Uuid::new_v4(),
            name: "raw_transactions".into(),
            format: "parquet".into(),
            size_bytes: 450_000_000_000,
            size_display: "450 GB".into(),
            location: "s3://data-lake/raw/transactions/".into(),
            row_count: Some(2_400_000_000),
            partition_count: 365,
            last_updated: now - Duration::hours(1),
            created_at: now - Duration::days(365),
            owner: "data-engineering@example.com".into(),
            tags: vec!["pii".into(), "financial".into(), "raw".into()],
        },
        DataLakeDataset {
            id: Uuid::new_v4(),
            name: "customer_profiles".into(),
            format: "json".into(),
            size_bytes: 12_000_000_000,
            size_display: "12 GB".into(),
            location: "s3://data-lake/curated/customers/".into(),
            row_count: Some(8_500_000),
            partition_count: 12,
            last_updated: now - Duration::hours(2),
            created_at: now - Duration::days(180),
            owner: "data-engineering@example.com".into(),
            tags: vec!["pii".into(), "curated".into()],
        },
        DataLakeDataset {
            id: Uuid::new_v4(),
            name: "product_catalog".into(),
            format: "csv".into(),
            size_bytes: 2_300_000_000,
            size_display: "2.3 GB".into(),
            location: "gs://data-lake/products/".into(),
            row_count: Some(1_200_000),
            partition_count: 1,
            last_updated: now - Duration::hours(6),
            created_at: now - Duration::days(120),
            owner: "product-team@example.com".into(),
            tags: vec!["product".into(), "catalog".into()],
        },
        DataLakeDataset {
            id: Uuid::new_v4(),
            name: "clickstream_events".into(),
            format: "avro".into(),
            size_bytes: 1_200_000_000_000,
            size_display: "1.2 TB".into(),
            location: "gs://data-lake/clickstream/".into(),
            row_count: Some(45_000_000_000),
            partition_count: 730,
            last_updated: now - Duration::minutes(10),
            created_at: now - Duration::days(730),
            owner: "analytics-team@example.com".into(),
            tags: vec!["behavioral".into(), "raw".into(), "high-volume".into()],
        },
        DataLakeDataset {
            id: Uuid::new_v4(),
            name: "server_logs".into(),
            format: "json".into(),
            size_bytes: 3_400_000_000_000,
            size_display: "3.4 TB".into(),
            location: "s3://data-lake/logs/servers/".into(),
            row_count: Some(120_000_000_000),
            partition_count: 1095,
            last_updated: now - Duration::minutes(5),
            created_at: now - Duration::days(1095),
            owner: "platform-team@example.com".into(),
            tags: vec!["logs".into(), "infrastructure".into(), "raw".into()],
        },
        DataLakeDataset {
            id: Uuid::new_v4(),
            name: "ml_training_data".into(),
            format: "parquet".into(),
            size_bytes: 890_000_000_000,
            size_display: "890 GB".into(),
            location: "s3://data-lake/ml/training/".into(),
            row_count: Some(5_600_000_000),
            partition_count: 48,
            last_updated: now - Duration::days(2),
            created_at: now - Duration::days(90),
            owner: "ml-team@example.com".into(),
            tags: vec!["ml".into(), "curated".into(), "features".into()],
        },
        DataLakeDataset {
            id: Uuid::new_v4(),
            name: "financial_reports".into(),
            format: "parquet".into(),
            size_bytes: 45_000_000_000,
            size_display: "45 GB".into(),
            location: "abfss://data-lake@storage/financial/".into(),
            row_count: Some(340_000_000),
            partition_count: 36,
            last_updated: now - Duration::days(1),
            created_at: now - Duration::days(365),
            owner: "finance-team@example.com".into(),
            tags: vec!["financial".into(), "confidential".into(), "curated".into()],
        },
        DataLakeDataset {
            id: Uuid::new_v4(),
            name: "iot_sensor_data".into(),
            format: "parquet".into(),
            size_bytes: 2_100_000_000_000,
            size_display: "2.1 TB".into(),
            location: "abfss://data-lake@storage/iot/sensors/".into(),
            row_count: Some(89_000_000_000),
            partition_count: 365,
            last_updated: now - Duration::minutes(2),
            created_at: now - Duration::days(365),
            owner: "iot-team@example.com".into(),
            tags: vec!["iot".into(), "telemetry".into(), "raw".into(), "high-volume".into()],
        },
    ]
}

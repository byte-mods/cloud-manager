use chrono::{Duration, Utc};
use cloud_common::Database;
use uuid::Uuid;

use crate::models::analytics::*;

/// Seed all analytics tables if they are empty.
pub async fn seed_if_empty(db: &Database) {
    let now = Utc::now();

    // Seed query engines
    let existing: Vec<QueryEngine> = db.list("query_engines").await.unwrap_or_default();
    if existing.is_empty() {
        for engine in seed_query_engines(now) {
            let _: Option<QueryEngine> = db
                .create_with_id("query_engines", &engine.id.to_string(), engine)
                .await
                .ok()
                .flatten();
        }
        tracing::info!("Seeded query_engines table");
    }

    // Seed visualizations
    let existing: Vec<Visualization> = db.list("visualizations").await.unwrap_or_default();
    if existing.is_empty() {
        for vis in seed_visualizations(now) {
            let _: Option<Visualization> = db
                .create_with_id("visualizations", &vis.id.to_string(), vis)
                .await
                .ok()
                .flatten();
        }
        tracing::info!("Seeded visualizations table");
    }

    // Seed reports
    let existing: Vec<Report> = db.list("reports").await.unwrap_or_default();
    if existing.is_empty() {
        for report in seed_reports(now) {
            let _: Option<Report> = db
                .create_with_id("reports", &report.id.to_string(), report)
                .await
                .ok()
                .flatten();
        }
        tracing::info!("Seeded reports table");
    }

    // Seed search indices
    let existing: Vec<SearchIndex> = db.list("search_indices").await.unwrap_or_default();
    if existing.is_empty() {
        for index in seed_search_indices(now) {
            let _: Option<SearchIndex> = db
                .create_with_id("search_indices", &index.id.to_string(), index)
                .await
                .ok()
                .flatten();
        }
        tracing::info!("Seeded search_indices table");
    }
}

fn seed_query_engines(now: chrono::DateTime<Utc>) -> Vec<QueryEngine> {
    vec![
        QueryEngine {
            id: Uuid::new_v4(),
            name: "Athena".into(),
            engine_type: "Serverless SQL".into(),
            status: "healthy".into(),
            queries_per_day: 5200.0,
            avg_query_time_ms: 3400,
            region: "us-east-1".into(),
            last_health_check: now - Duration::seconds(45),
        },
        QueryEngine {
            id: Uuid::new_v4(),
            name: "BigQuery".into(),
            engine_type: "Serverless SQL".into(),
            status: "healthy".into(),
            queries_per_day: 3800.0,
            avg_query_time_ms: 2100,
            region: "us-central1".into(),
            last_health_check: now - Duration::seconds(30),
        },
        QueryEngine {
            id: Uuid::new_v4(),
            name: "Synapse".into(),
            engine_type: "Dedicated SQL Pool".into(),
            status: "healthy".into(),
            queries_per_day: 1500.0,
            avg_query_time_ms: 4800,
            region: "eastus2".into(),
            last_health_check: now - Duration::seconds(60),
        },
        QueryEngine {
            id: Uuid::new_v4(),
            name: "Redshift".into(),
            engine_type: "Provisioned Cluster".into(),
            status: "degraded".into(),
            queries_per_day: 890.0,
            avg_query_time_ms: 8200,
            region: "us-west-2".into(),
            last_health_check: now - Duration::seconds(15),
        },
    ]
}

fn seed_visualizations(now: chrono::DateTime<Utc>) -> Vec<Visualization> {
    vec![
        Visualization {
            id: Uuid::new_v4(),
            name: "Revenue by Region".into(),
            chart_type: "bar".into(),
            data_source: "BigQuery".into(),
            query: "SELECT region, SUM(revenue) as total FROM sales GROUP BY region ORDER BY total DESC".into(),
            created_at: now - Duration::days(14),
            updated_at: now - Duration::hours(6),
        },
        Visualization {
            id: Uuid::new_v4(),
            name: "User Growth".into(),
            chart_type: "line".into(),
            data_source: "Athena".into(),
            query: "SELECT date_trunc('month', created_at) as month, COUNT(*) as users FROM users GROUP BY 1 ORDER BY 1".into(),
            created_at: now - Duration::days(30),
            updated_at: now - Duration::days(2),
        },
        Visualization {
            id: Uuid::new_v4(),
            name: "Error Distribution".into(),
            chart_type: "pie".into(),
            data_source: "Athena".into(),
            query: "SELECT error_type, COUNT(*) as count FROM errors WHERE timestamp > NOW() - INTERVAL '7 days' GROUP BY error_type".into(),
            created_at: now - Duration::days(7),
            updated_at: now - Duration::hours(12),
        },
        Visualization {
            id: Uuid::new_v4(),
            name: "Latency Heatmap".into(),
            chart_type: "heatmap".into(),
            data_source: "Synapse".into(),
            query: "SELECT hour, service, AVG(latency_ms) as avg_latency FROM metrics GROUP BY hour, service".into(),
            created_at: now - Duration::days(5),
            updated_at: now - Duration::days(1),
        },
        Visualization {
            id: Uuid::new_v4(),
            name: "Cost Breakdown".into(),
            chart_type: "treemap".into(),
            data_source: "BigQuery".into(),
            query: "SELECT service, category, SUM(cost) as total FROM billing GROUP BY service, category".into(),
            created_at: now - Duration::days(21),
            updated_at: now - Duration::hours(3),
        },
        Visualization {
            id: Uuid::new_v4(),
            name: "Traffic Sources".into(),
            chart_type: "sankey".into(),
            data_source: "Athena".into(),
            query: "SELECT source, destination, SUM(request_count) as flow FROM traffic_logs GROUP BY source, destination".into(),
            created_at: now - Duration::days(10),
            updated_at: now - Duration::days(3),
        },
    ]
}

fn seed_reports(now: chrono::DateTime<Utc>) -> Vec<Report> {
    vec![
        Report {
            id: Uuid::new_v4(),
            name: "Weekly Cost Summary".into(),
            schedule: "weekly".into(),
            format: "PDF".into(),
            status: "completed".into(),
            last_run_at: Some(now - Duration::days(1)),
            next_run_at: Some(now + Duration::days(6)),
            created_at: now - Duration::days(60),
            recipients: vec!["finance@example.com".into(), "ops@example.com".into()],
        },
        Report {
            id: Uuid::new_v4(),
            name: "Monthly Security Audit".into(),
            schedule: "monthly".into(),
            format: "PDF".into(),
            status: "completed".into(),
            last_run_at: Some(now - Duration::days(5)),
            next_run_at: Some(now + Duration::days(25)),
            created_at: now - Duration::days(90),
            recipients: vec!["security@example.com".into(), "compliance@example.com".into()],
        },
        Report {
            id: Uuid::new_v4(),
            name: "Daily Performance".into(),
            schedule: "daily".into(),
            format: "email".into(),
            status: "completed".into(),
            last_run_at: Some(now - Duration::hours(8)),
            next_run_at: Some(now + Duration::hours(16)),
            created_at: now - Duration::days(45),
            recipients: vec!["engineering@example.com".into()],
        },
        Report {
            id: Uuid::new_v4(),
            name: "Quarterly Business Review".into(),
            schedule: "quarterly".into(),
            format: "slides".into(),
            status: "scheduled".into(),
            last_run_at: Some(now - Duration::days(60)),
            next_run_at: Some(now + Duration::days(30)),
            created_at: now - Duration::days(180),
            recipients: vec!["leadership@example.com".into(), "finance@example.com".into()],
        },
        Report {
            id: Uuid::new_v4(),
            name: "Compliance Status".into(),
            schedule: "monthly".into(),
            format: "PDF".into(),
            status: "completed".into(),
            last_run_at: Some(now - Duration::days(3)),
            next_run_at: Some(now + Duration::days(27)),
            created_at: now - Duration::days(120),
            recipients: vec!["compliance@example.com".into(), "legal@example.com".into()],
        },
    ]
}

fn seed_search_indices(now: chrono::DateTime<Utc>) -> Vec<SearchIndex> {
    vec![
        SearchIndex {
            id: Uuid::new_v4(),
            name: "resources".into(),
            document_count: 2_300_000,
            size_bytes: 12_400_000_000, // ~12.4 GB
            status: "healthy".into(),
            last_indexed_at: now - Duration::minutes(5),
            index_rate_per_sec: 450,
        },
        SearchIndex {
            id: Uuid::new_v4(),
            name: "logs".into(),
            document_count: 45_000_000,
            size_bytes: 245_000_000_000, // ~245 GB
            status: "healthy".into(),
            last_indexed_at: now - Duration::seconds(30),
            index_rate_per_sec: 12_000,
        },
        SearchIndex {
            id: Uuid::new_v4(),
            name: "metrics".into(),
            document_count: 120_000_000,
            size_bytes: 680_000_000_000, // ~680 GB
            status: "healthy".into(),
            last_indexed_at: now - Duration::seconds(10),
            index_rate_per_sec: 45_000,
        },
    ]
}

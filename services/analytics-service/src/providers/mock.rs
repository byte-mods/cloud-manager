use std::sync::Arc;

use async_trait::async_trait;

use cloud_common::Database;

use crate::models::analytics::*;
use crate::traits::{QueryEngineProvider, Result};

/// Mock provider backed by SurrealDB.
pub struct MockQueryEngineProvider {
    db: Arc<Database>,
}

impl MockQueryEngineProvider {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl QueryEngineProvider for MockQueryEngineProvider {
    async fn list_query_engines(&self) -> Result<Vec<QueryEngine>> {
        let engines: Vec<QueryEngine> = self.db.list("query_engines").await.unwrap_or_default();
        Ok(engines)
    }

    async fn execute_query(&self, request: &QueryRequest) -> Result<QueryResult> {
        let engines: Vec<QueryEngine> = self.db.list("query_engines").await.unwrap_or_default();
        let engine_name = request
            .engine
            .clone()
            .unwrap_or_else(|| "Athena".to_string());

        // Check engine exists
        let _engine = engines
            .iter()
            .find(|e| e.name.to_lowercase() == engine_name.to_lowercase());
        if _engine.is_none() {
            return Err(crate::error::AnalyticsError::BadRequest(format!(
                "Query engine '{}' not found",
                engine_name
            )));
        }

        // Generate mock results based on query patterns
        let query_lower = request.query.to_lowercase();
        let result = if query_lower.contains("cost")
            || query_lower.contains("billing")
            || query_lower.contains("revenue")
        {
            QueryResult {
                columns: vec![
                    "service".into(),
                    "region".into(),
                    "total_cost".into(),
                    "request_count".into(),
                    "cost_per_request".into(),
                ],
                rows: vec![
                    vec![json_str("EC2"), json_str("us-east-1"), json_num(12450.00), json_num(1240000.0), json_num(0.010)],
                    vec![json_str("S3"), json_str("us-east-1"), json_num(3210.50), json_num(8900000.0), json_num(0.0004)],
                    vec![json_str("RDS"), json_str("us-west-2"), json_num(5680.25), json_num(340000.0), json_num(0.017)],
                    vec![json_str("Lambda"), json_str("us-east-1"), json_num(890.10), json_num(15600000.0), json_num(0.0001)],
                ],
                execution_time_ms: 245,
                row_count: 4,
                engine: engine_name,
            }
        } else if query_lower.contains("user") || query_lower.contains("customer") {
            QueryResult {
                columns: vec![
                    "month".into(),
                    "new_users".into(),
                    "active_users".into(),
                    "churn_rate".into(),
                    "region".into(),
                ],
                rows: vec![
                    vec![json_str("2026-01"), json_num(1250.0), json_num(45200.0), json_num(2.1), json_str("North America")],
                    vec![json_str("2026-02"), json_num(1380.0), json_num(46800.0), json_num(1.9), json_str("North America")],
                    vec![json_str("2026-03"), json_num(1520.0), json_num(48900.0), json_num(1.6), json_str("North America")],
                ],
                execution_time_ms: 1820,
                row_count: 3,
                engine: engine_name,
            }
        } else if query_lower.contains("error")
            || query_lower.contains("latency")
            || query_lower.contains("performance")
        {
            QueryResult {
                columns: vec![
                    "service".into(),
                    "error_count".into(),
                    "error_rate_pct".into(),
                    "p50_ms".into(),
                    "p99_ms".into(),
                ],
                rows: vec![
                    vec![json_str("api-gateway"), json_num(142.0), json_num(0.12), json_num(45.0), json_num(420.0)],
                    vec![json_str("auth-service"), json_num(23.0), json_num(0.08), json_num(32.0), json_num(180.0)],
                    vec![json_str("payment-service"), json_num(89.0), json_num(0.45), json_num(120.0), json_num(890.0)],
                ],
                execution_time_ms: 890,
                row_count: 3,
                engine: engine_name,
            }
        } else {
            QueryResult {
                columns: vec!["id".into(), "name".into(), "value".into(), "category".into(), "timestamp".into()],
                rows: vec![
                    vec![json_num(1.0), json_str("item-alpha"), json_num(42.5), json_str("compute"), json_str("2026-03-30T10:00:00Z")],
                    vec![json_num(2.0), json_str("item-beta"), json_num(18.3), json_str("storage"), json_str("2026-03-30T09:45:00Z")],
                    vec![json_num(3.0), json_str("item-gamma"), json_num(91.7), json_str("network"), json_str("2026-03-30T09:30:00Z")],
                ],
                execution_time_ms: 340,
                row_count: 3,
                engine: engine_name,
            }
        };

        Ok(result)
    }
}

fn json_str(s: &str) -> serde_json::Value {
    serde_json::Value::String(s.to_string())
}

fn json_num(n: f64) -> serde_json::Value {
    serde_json::json!(n)
}

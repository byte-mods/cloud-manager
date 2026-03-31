use async_trait::async_trait;

use crate::error::AnalyticsError;
use crate::models::analytics::{QueryEngine, QueryRequest, QueryResult};

pub type Result<T> = std::result::Result<T, AnalyticsError>;

/// Trait abstracting over query engine operations.
///
/// Implementations include:
/// - In-memory mock store (default / CLOUD_USE_MOCK_DATA=true)
/// - AWS SDK (Athena for serverless SQL query execution)
#[async_trait]
pub trait QueryEngineProvider: Send + Sync {
    /// List available query engines.
    async fn list_query_engines(&self) -> Result<Vec<QueryEngine>>;

    /// Execute a SQL query and return results.
    async fn execute_query(&self, request: &QueryRequest) -> Result<QueryResult>;
}

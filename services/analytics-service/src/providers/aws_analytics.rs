use std::sync::Arc;

use async_trait::async_trait;
use chrono::Utc;
use uuid::Uuid;

use cloud_common::{CredentialManager, RedisCache};

use crate::error::AnalyticsError;
use crate::models::analytics::*;
use crate::traits::{QueryEngineProvider, Result};

/// AWS-backed analytics provider using Athena for query execution.
pub struct AwsAnalyticsProvider {
    credentials: Arc<CredentialManager>,
    #[allow(dead_code)]
    cache: Option<Arc<RedisCache>>,
    default_region: String,
    output_location: String,
}

impl AwsAnalyticsProvider {
    pub fn new(
        credentials: Arc<CredentialManager>,
        cache: Option<Arc<RedisCache>>,
        default_region: String,
        output_location: String,
    ) -> Self {
        Self {
            credentials,
            cache,
            default_region,
            output_location,
        }
    }

    fn athena_client(&self) -> Result<aws_sdk_athena::Client> {
        let config = self
            .credentials
            .aws_config_for_region(&self.default_region)
            .map_err(|e| AnalyticsError::Internal(e.to_string()))?;
        Ok(aws_sdk_athena::Client::new(&config))
    }
}

#[async_trait]
impl QueryEngineProvider for AwsAnalyticsProvider {
    async fn list_query_engines(&self) -> Result<Vec<QueryEngine>> {
        tracing::info!(region = %self.default_region, "Listing Athena work groups via AWS SDK");

        let athena = self.athena_client()?;
        let resp = athena
            .list_work_groups()
            .send()
            .await
            .map_err(|e| AnalyticsError::Internal(format!("Athena ListWorkGroups: {e}")))?;

        let now = Utc::now();
        let engines: Vec<QueryEngine> = resp
            .work_groups()
            .iter()
            .map(|wg| {
                let name = wg.name().unwrap_or("unnamed").to_owned();
                let state = wg
                    .state()
                    .map(|s| format!("{:?}", s))
                    .unwrap_or_else(|| "unknown".into());

                QueryEngine {
                    id: Uuid::new_v4(),
                    name: format!("Athena ({})", name),
                    engine_type: "Serverless SQL".into(),
                    status: if state.contains("Enabled") {
                        "healthy".into()
                    } else {
                        "disabled".into()
                    },
                    queries_per_day: 0.0,
                    avg_query_time_ms: 0,
                    region: self.default_region.clone(),
                    last_health_check: now,
                }
            })
            .collect();

        Ok(engines)
    }

    async fn execute_query(&self, request: &QueryRequest) -> Result<QueryResult> {
        tracing::info!(query = %request.query, "Executing Athena query via AWS SDK");

        let athena = self.athena_client()?;

        let result_config = aws_sdk_athena::types::ResultConfiguration::builder()
            .output_location(&self.output_location)
            .build();

        // Start query execution
        let start_resp = athena
            .start_query_execution()
            .query_string(&request.query)
            .result_configuration(result_config)
            .send()
            .await
            .map_err(|e| {
                AnalyticsError::Internal(format!("Athena StartQueryExecution: {e}"))
            })?;

        let execution_id = start_resp
            .query_execution_id()
            .ok_or_else(|| AnalyticsError::Internal("No execution ID returned".into()))?
            .to_owned();

        tracing::info!(execution_id = %execution_id, "Athena query started, polling for completion");

        // Poll for completion (with timeout)
        let mut attempts = 0;
        let max_attempts = 60; // up to ~60 seconds
        loop {
            attempts += 1;
            if attempts > max_attempts {
                return Err(AnalyticsError::Internal(format!(
                    "Athena query {} timed out after {}s",
                    execution_id, max_attempts
                )));
            }

            let status_resp = athena
                .get_query_execution()
                .query_execution_id(&execution_id)
                .send()
                .await
                .map_err(|e| {
                    AnalyticsError::Internal(format!("Athena GetQueryExecution: {e}"))
                })?;

            let state = status_resp
                .query_execution()
                .and_then(|qe| qe.status())
                .and_then(|s| s.state())
                .map(|s| format!("{:?}", s))
                .unwrap_or_else(|| "UNKNOWN".into());

            match state.as_str() {
                "Succeeded" => break,
                "Failed" | "Cancelled" => {
                    let reason = status_resp
                        .query_execution()
                        .and_then(|qe| qe.status())
                        .and_then(|s| s.state_change_reason())
                        .unwrap_or("Unknown reason");
                    return Err(AnalyticsError::Internal(format!(
                        "Athena query {}: {} - {}",
                        execution_id, state, reason
                    )));
                }
                _ => {
                    // Still running, wait a bit
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                }
            }
        }

        // Fetch results
        let results_resp = athena
            .get_query_results()
            .query_execution_id(&execution_id)
            .send()
            .await
            .map_err(|e| {
                AnalyticsError::Internal(format!("Athena GetQueryResults: {e}"))
            })?;

        let result_set = results_resp
            .result_set()
            .ok_or_else(|| AnalyticsError::Internal("No result set returned".into()))?;

        // Extract column names from first row (header)
        let all_rows = result_set.rows();
        let columns: Vec<String> = all_rows
            .first()
            .map(|header_row| {
                header_row
                    .data()
                    .iter()
                    .map(|d| d.var_char_value().unwrap_or("").to_owned())
                    .collect()
            })
            .unwrap_or_default();

        // Extract data rows (skip header)
        let data_rows: Vec<Vec<serde_json::Value>> = all_rows
            .iter()
            .skip(1)
            .map(|row| {
                row.data()
                    .iter()
                    .map(|d| {
                        let val = d.var_char_value().unwrap_or("");
                        // Try to parse as number, otherwise keep as string
                        if let Ok(n) = val.parse::<f64>() {
                            serde_json::json!(n)
                        } else {
                            serde_json::Value::String(val.to_owned())
                        }
                    })
                    .collect()
            })
            .collect();

        let row_count = data_rows.len();

        // Get execution time from statistics
        let exec_resp = athena
            .get_query_execution()
            .query_execution_id(&execution_id)
            .send()
            .await
            .ok();

        let execution_time_ms = exec_resp
            .as_ref()
            .and_then(|r| r.query_execution())
            .and_then(|qe| qe.statistics())
            .and_then(|s| s.engine_execution_time_in_millis())
            .unwrap_or(0) as u64;

        Ok(QueryResult {
            columns,
            rows: data_rows,
            execution_time_ms,
            row_count,
            engine: "Athena".into(),
        })
    }
}

use std::sync::Arc;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use cloud_common::CredentialManager;

use crate::error::MonitoringError;
use crate::models::monitoring::{
    Alert, AlertSeverity, AlertStatus, LogEntry, LogLevel, MetricDataPoint, MetricDetail,
};
use crate::traits::alerts::Result as AlertResult;
use crate::traits::logs::Result as LogResult;
use crate::traits::metrics::Result as MetricResult;
use crate::traits::{AlertsProvider, LogsProvider, MetricsProvider};

/// Azure monitoring provider using the Azure Monitor REST API.
pub struct AzureMonitoringProvider {
    http: reqwest::Client,
    credentials: Arc<CredentialManager>,
    subscription_id: String,
}

impl AzureMonitoringProvider {
    pub fn new(credentials: Arc<CredentialManager>, subscription_id: String) -> Self {
        Self {
            http: reqwest::Client::new(),
            credentials,
            subscription_id,
        }
    }

    async fn get_token(&self) -> Result<String, MonitoringError> {
        use azure_core::credentials::TokenCredential;
        let cred = self
            .credentials
            .azure_credential()
            .map_err(|e| MonitoringError::Internal(format!("Azure credential error: {e}")))?;

        let token = cred
            .get_token(&["https://management.azure.com/.default"])
            .await
            .map_err(|e| MonitoringError::Internal(format!("Azure token error: {e}")))?;

        Ok(token.token.secret().to_string())
    }

    async fn get_json(
        &self,
        path: &str,
        api_version: &str,
    ) -> Result<serde_json::Value, MonitoringError> {
        let url = format!(
            "https://management.azure.com/subscriptions/{}{path}?api-version={api_version}",
            self.subscription_id
        );
        let token = self.get_token().await?;

        let resp = self
            .http
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| MonitoringError::Internal(format!("Azure HTTP error: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(MonitoringError::Internal(format!(
                "Azure API error {status}: {body}"
            )));
        }

        resp.json()
            .await
            .map_err(|e| MonitoringError::Internal(format!("Azure JSON parse error: {e}")))
    }
}

#[async_trait]
impl MetricsProvider for AzureMonitoringProvider {
    async fn list_metrics(&self, namespace: Option<&str>) -> MetricResult<Vec<MetricDetail>> {
        tracing::info!(
            provider = "azure",
            subscription = self.subscription_id.as_str(),
            "Listing Azure Monitor metric definitions via REST API"
        );

        let resource_group =
            std::env::var("AZURE_RESOURCE_GROUP").unwrap_or_else(|_| "default-rg".to_owned());
        let resource_name =
            std::env::var("AZURE_RESOURCE_NAME").unwrap_or_else(|_| "default-vm".to_owned());
        let resource_type = namespace.unwrap_or("Microsoft.Compute/virtualMachines");

        let path = format!(
            "/resourceGroups/{}/providers/{}/{}/providers/Microsoft.Insights/metricDefinitions",
            resource_group, resource_type, resource_name
        );

        let data = self.get_json(&path, "2024-02-01").await?;

        let metrics: Vec<MetricDetail> = data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|def| {
                let name = def["name"]["value"]
                    .as_str()
                    .unwrap_or("unknown")
                    .to_owned();
                let display = def["name"]["localizedValue"]
                    .as_str()
                    .unwrap_or(&name)
                    .to_owned();
                let unit = def["unit"].as_str().unwrap_or("Count").to_owned();

                MetricDetail {
                    name,
                    display_name: display,
                    unit,
                    data_points: vec![],
                    min: 0.0,
                    max: 0.0,
                    avg: 0.0,
                }
            })
            .collect();

        Ok(metrics)
    }

    async fn get_metric_data(
        &self,
        name: &str,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
        period_seconds: u32,
    ) -> MetricResult<Vec<MetricDataPoint>> {
        tracing::info!(
            provider = "azure",
            metric = name,
            "Getting Azure Monitor metric data via REST API"
        );

        let resource_group =
            std::env::var("AZURE_RESOURCE_GROUP").unwrap_or_else(|_| "default-rg".to_owned());
        let resource_name =
            std::env::var("AZURE_RESOURCE_NAME").unwrap_or_else(|_| "default-vm".to_owned());

        let duration = format!("PT{}S", period_seconds);
        let timespan = format!("{}/{}", start.to_rfc3339(), end.to_rfc3339());

        let path = format!(
            "/resourceGroups/{}/providers/Microsoft.Compute/virtualMachines/{}/providers/Microsoft.Insights/metrics",
            resource_group, resource_name
        );

        let url = format!(
            "https://management.azure.com/subscriptions/{}{path}?api-version=2024-02-01&metricnames={name}&timespan={timespan}&interval={duration}&aggregation=Average",
            self.subscription_id
        );

        let token = self.get_token().await?;
        let resp = self
            .http
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| MonitoringError::Internal(format!("Azure HTTP error: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(MonitoringError::Internal(format!(
                "Azure API error {status}: {body}"
            )));
        }

        let data: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| MonitoringError::Internal(format!("Azure JSON parse error: {e}")))?;

        let mut data_points = Vec::new();

        if let Some(metrics) = data["value"].as_array() {
            for metric in metrics {
                if let Some(timeseries) = metric["timeseries"].as_array() {
                    for ts in timeseries {
                        if let Some(data_arr) = ts["data"].as_array() {
                            for point in data_arr {
                                let ts_str =
                                    point["timeStamp"].as_str().unwrap_or("");
                                let value = point["average"]
                                    .as_f64()
                                    .or_else(|| point["total"].as_f64())
                                    .unwrap_or(0.0);

                                if let Ok(ts) = DateTime::parse_from_rfc3339(ts_str) {
                                    data_points.push(MetricDataPoint {
                                        timestamp: ts.with_timezone(&Utc),
                                        value,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        data_points.sort_by_key(|dp| dp.timestamp);
        Ok(data_points)
    }
}

#[async_trait]
impl LogsProvider for AzureMonitoringProvider {
    async fn query_logs(
        &self,
        log_group: Option<&str>,
        filter_pattern: Option<&str>,
        limit: usize,
    ) -> LogResult<Vec<LogEntry>> {
        tracing::info!(
            provider = "azure",
            "Querying Azure Log Analytics via REST API"
        );

        let workspace_id =
            std::env::var("AZURE_LOG_ANALYTICS_WORKSPACE_ID").unwrap_or_default();
        let token = self.get_token().await?;

        let table = log_group.unwrap_or("Syslog");
        let filter = filter_pattern
            .map(|p| format!("| where SyslogMessage contains \"{}\"", p))
            .unwrap_or_default();

        let query = format!("{table} {filter} | top {limit} by TimeGenerated desc");

        let url = format!(
            "https://api.loganalytics.io/v1/workspaces/{}/query",
            workspace_id
        );

        let resp = self
            .http
            .post(&url)
            .bearer_auth(&token)
            .json(&serde_json::json!({ "query": query }))
            .send()
            .await
            .map_err(|e| MonitoringError::Internal(format!("Azure Log Analytics HTTP error: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(MonitoringError::Internal(format!(
                "Azure Log Analytics API error {status}: {body}"
            )));
        }

        let data: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| MonitoringError::Internal(format!("Azure JSON parse error: {e}")))?;

        let mut entries = Vec::new();

        if let Some(tables) = data["tables"].as_array() {
            for table in tables {
                if let Some(rows) = table["rows"].as_array() {
                    for row in rows.iter().take(limit) {
                        let message = row
                            .as_array()
                            .and_then(|r| r.get(2))
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_owned();
                        let ts_str = row
                            .as_array()
                            .and_then(|r| r.first())
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        let timestamp = DateTime::parse_from_rfc3339(ts_str)
                            .map(|dt| dt.with_timezone(&Utc))
                            .unwrap_or_else(|_| Utc::now());

                        entries.push(LogEntry {
                            id: Uuid::new_v4(),
                            timestamp,
                            level: LogLevel::Info,
                            service: "azure-vm".to_owned(),
                            message,
                            trace_id: None,
                        });
                    }
                }
            }
        }

        Ok(entries)
    }

    async fn list_log_groups(&self) -> LogResult<Vec<String>> {
        tracing::info!(provider = "azure", "Listing Azure Log Analytics tables");

        // Azure Log Analytics tables are well-known; return common defaults
        Ok(vec![
            "Syslog".to_owned(),
            "Event".to_owned(),
            "Heartbeat".to_owned(),
            "Perf".to_owned(),
            "AzureActivity".to_owned(),
            "ContainerLog".to_owned(),
        ])
    }
}

#[async_trait]
impl AlertsProvider for AzureMonitoringProvider {
    async fn list_alerts(&self) -> AlertResult<Vec<Alert>> {
        tracing::info!(
            provider = "azure",
            "Listing Azure Monitor alerts via REST API"
        );

        let path = "/providers/Microsoft.AlertsManagement/alerts";
        let data = self.get_json(path, "2023-01-01").await?;

        let alerts: Vec<Alert> = data["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|item| {
                let props = &item["properties"];
                let name = props["essentials"]["alertRule"]
                    .as_str()
                    .unwrap_or("unknown")
                    .to_owned();
                let severity_str = props["essentials"]["severity"]
                    .as_str()
                    .unwrap_or("Sev3");
                let severity = match severity_str {
                    "Sev0" | "Sev1" => AlertSeverity::Critical,
                    "Sev2" => AlertSeverity::Warning,
                    _ => AlertSeverity::Info,
                };
                let state = props["essentials"]["alertState"]
                    .as_str()
                    .unwrap_or("New");
                let status = match state {
                    "New" => AlertStatus::Firing,
                    "Acknowledged" => AlertStatus::Acknowledged,
                    _ => AlertStatus::Resolved,
                };

                Alert {
                    id: Uuid::new_v4(),
                    name,
                    severity,
                    status: status.clone(),
                    message: props["essentials"]["description"]
                        .as_str()
                        .unwrap_or("Azure Monitor alert")
                        .to_owned(),
                    source: "Azure/Monitor".to_owned(),
                    created_at: Utc::now(),
                    acknowledged_at: if status == AlertStatus::Acknowledged {
                        Some(Utc::now())
                    } else {
                        None
                    },
                    resolved_at: if status == AlertStatus::Resolved {
                        Some(Utc::now())
                    } else {
                        None
                    },
                }
            })
            .collect();

        Ok(alerts)
    }

    async fn get_alert(&self, name: &str) -> AlertResult<Alert> {
        let alerts = self.list_alerts().await?;
        alerts
            .into_iter()
            .find(|a| a.name == name)
            .ok_or_else(|| MonitoringError::NotFound(format!("Alert '{name}' not found")))
    }
}

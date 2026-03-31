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

/// GCP monitoring provider using the Google Cloud Monitoring REST API.
pub struct GcpMonitoringProvider {
    http: reqwest::Client,
    credentials: Arc<CredentialManager>,
    project_id: String,
}

impl GcpMonitoringProvider {
    pub fn new(credentials: Arc<CredentialManager>, project_id: String) -> Self {
        Self {
            http: reqwest::Client::new(),
            credentials,
            project_id,
        }
    }

    async fn get_token(&self) -> Result<String, MonitoringError> {
        self.credentials
            .gcp_token(&["https://www.googleapis.com/auth/cloud-platform"])
            .await
            .map_err(|e| MonitoringError::Internal(format!("GCP token error: {e}")))
    }

    async fn get_json(&self, url: &str) -> Result<serde_json::Value, MonitoringError> {
        let token = self.get_token().await?;
        let resp = self
            .http
            .get(url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| MonitoringError::Internal(format!("GCP HTTP error: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(MonitoringError::Internal(format!(
                "GCP API error {status}: {body}"
            )));
        }

        resp.json()
            .await
            .map_err(|e| MonitoringError::Internal(format!("GCP JSON parse error: {e}")))
    }
}

#[async_trait]
impl MetricsProvider for GcpMonitoringProvider {
    async fn list_metrics(&self, namespace: Option<&str>) -> MetricResult<Vec<MetricDetail>> {
        tracing::info!(
            provider = "gcp",
            project = self.project_id.as_str(),
            "Listing GCP monitoring metrics via REST API"
        );

        let filter = namespace
            .map(|ns| format!("&filter=metric.type%3Dstarts_with(%22{}%22)", ns))
            .unwrap_or_default();

        let url = format!(
            "https://monitoring.googleapis.com/v3/projects/{}/metricDescriptors?pageSize=100{}",
            self.project_id, filter
        );

        let data = self.get_json(&url).await?;

        let metrics: Vec<MetricDetail> = data["metricDescriptors"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|desc| {
                let metric_type = desc["type"].as_str().unwrap_or("unknown").to_owned();
                let display = desc["displayName"]
                    .as_str()
                    .unwrap_or(&metric_type)
                    .to_owned();
                let unit = desc["unit"].as_str().unwrap_or("1").to_owned();

                MetricDetail {
                    name: metric_type,
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
            provider = "gcp",
            metric = name,
            "Getting GCP metric time-series data via REST API"
        );

        let url = format!(
            "https://monitoring.googleapis.com/v3/projects/{}/timeSeries?filter=metric.type%3D%22{}%22&interval.startTime={}&interval.endTime={}&aggregation.alignmentPeriod={}s&aggregation.perSeriesAligner=ALIGN_MEAN",
            self.project_id,
            name,
            start.to_rfc3339(),
            end.to_rfc3339(),
            period_seconds,
        );

        let data = self.get_json(&url).await?;

        let mut data_points = Vec::new();

        if let Some(time_series) = data["timeSeries"].as_array() {
            for series in time_series {
                if let Some(points) = series["points"].as_array() {
                    for point in points {
                        let ts_str = point["interval"]["endTime"]
                            .as_str()
                            .unwrap_or("");
                        let value = point["value"]["doubleValue"]
                            .as_f64()
                            .or_else(|| point["value"]["int64Value"].as_str().and_then(|v| v.parse::<f64>().ok()))
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

        data_points.sort_by_key(|dp| dp.timestamp);
        Ok(data_points)
    }
}

#[async_trait]
impl LogsProvider for GcpMonitoringProvider {
    async fn query_logs(
        &self,
        log_group: Option<&str>,
        filter_pattern: Option<&str>,
        limit: usize,
    ) -> LogResult<Vec<LogEntry>> {
        tracing::info!(
            provider = "gcp",
            project = self.project_id.as_str(),
            "Querying GCP Cloud Logging via REST API"
        );

        let token = self.get_token().await?;

        let mut filter_parts = vec![format!(
            "resource.type=\"gce_instance\" AND logName=\"projects/{}/logs/{}\"",
            self.project_id,
            log_group.unwrap_or("syslog")
        )];

        if let Some(pattern) = filter_pattern {
            filter_parts.push(format!("textPayload:\"{}\"", pattern));
        }

        let body = serde_json::json!({
            "resourceNames": [format!("projects/{}", self.project_id)],
            "filter": filter_parts.join(" AND "),
            "pageSize": limit,
            "orderBy": "timestamp desc",
        });

        let resp = self
            .http
            .post("https://logging.googleapis.com/v2/entries:list")
            .bearer_auth(&token)
            .json(&body)
            .send()
            .await
            .map_err(|e| MonitoringError::Internal(format!("GCP Logging HTTP error: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body_text = resp.text().await.unwrap_or_default();
            return Err(MonitoringError::Internal(format!(
                "GCP Logging API error {status}: {body_text}"
            )));
        }

        let data: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| MonitoringError::Internal(format!("GCP JSON parse error: {e}")))?;

        let entries: Vec<LogEntry> = data["entries"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|entry| {
                let message = entry["textPayload"]
                    .as_str()
                    .or_else(|| entry["jsonPayload"]["message"].as_str())
                    .unwrap_or("")
                    .to_owned();
                let severity = entry["severity"].as_str().unwrap_or("DEFAULT");
                let level = match severity {
                    "ERROR" | "CRITICAL" | "ALERT" | "EMERGENCY" => LogLevel::Error,
                    "WARNING" => LogLevel::Warn,
                    "DEBUG" => LogLevel::Debug,
                    _ => LogLevel::Info,
                };
                let ts_str = entry["timestamp"].as_str().unwrap_or("");
                let timestamp = DateTime::parse_from_rfc3339(ts_str)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now());
                let service = entry["resource"]["labels"]["instance_id"]
                    .as_str()
                    .unwrap_or("unknown")
                    .to_owned();

                LogEntry {
                    id: Uuid::new_v4(),
                    timestamp,
                    level,
                    service,
                    message,
                    trace_id: entry["trace"].as_str().map(|s| s.to_owned()),
                }
            })
            .collect();

        Ok(entries)
    }

    async fn list_log_groups(&self) -> LogResult<Vec<String>> {
        tracing::info!(provider = "gcp", "Listing GCP log names via REST API");

        let url = format!(
            "https://logging.googleapis.com/v2/projects/{}/logs",
            self.project_id
        );
        let data = self.get_json(&url).await?;

        let groups: Vec<String> = data["logNames"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_owned()))
            .collect();

        Ok(groups)
    }
}

#[async_trait]
impl AlertsProvider for GcpMonitoringProvider {
    async fn list_alerts(&self) -> AlertResult<Vec<Alert>> {
        tracing::info!(
            provider = "gcp",
            project = self.project_id.as_str(),
            "Listing GCP alerting policies via REST API"
        );

        let url = format!(
            "https://monitoring.googleapis.com/v3/projects/{}/alertPolicies",
            self.project_id
        );
        let data = self.get_json(&url).await?;

        let alerts: Vec<Alert> = data["alertPolicies"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|policy| {
                let name = policy["displayName"]
                    .as_str()
                    .unwrap_or("unknown")
                    .to_owned();
                let enabled = policy["enabled"].as_bool().unwrap_or(true);
                let status = if enabled {
                    AlertStatus::Firing
                } else {
                    AlertStatus::Resolved
                };

                Alert {
                    id: Uuid::new_v4(),
                    name,
                    severity: AlertSeverity::Warning,
                    status,
                    message: policy["documentation"]["content"]
                        .as_str()
                        .unwrap_or("GCP alert policy")
                        .to_owned(),
                    source: "GCP/Monitoring".to_owned(),
                    created_at: Utc::now(),
                    acknowledged_at: None,
                    resolved_at: if !enabled { Some(Utc::now()) } else { None },
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

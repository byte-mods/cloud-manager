use std::sync::Arc;

use async_trait::async_trait;
use chrono::{DateTime, TimeZone, Utc};
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

/// AWS monitoring provider backed by real CloudWatch and CloudWatch Logs SDK calls.
pub struct AwsMonitoringProvider {
    credentials: Arc<CredentialManager>,
    default_region: String,
}

impl AwsMonitoringProvider {
    pub fn new(credentials: Arc<CredentialManager>, default_region: String) -> Self {
        Self {
            credentials,
            default_region,
        }
    }

    fn cloudwatch_client(&self) -> Result<aws_sdk_cloudwatch::Client, MonitoringError> {
        let config = self
            .credentials
            .aws_config_for_region(&self.default_region)
            .map_err(|e| MonitoringError::Internal(format!("AWS config error: {e}")))?;
        Ok(aws_sdk_cloudwatch::Client::new(&config))
    }

    fn logs_client(&self) -> Result<aws_sdk_cloudwatchlogs::Client, MonitoringError> {
        let config = self
            .credentials
            .aws_config_for_region(&self.default_region)
            .map_err(|e| MonitoringError::Internal(format!("AWS config error: {e}")))?;
        Ok(aws_sdk_cloudwatchlogs::Client::new(&config))
    }
}

#[async_trait]
impl MetricsProvider for AwsMonitoringProvider {
    async fn list_metrics(&self, namespace: Option<&str>) -> MetricResult<Vec<MetricDetail>> {
        tracing::info!(
            provider = "aws",
            region = self.default_region.as_str(),
            namespace = namespace,
            "Listing CloudWatch metrics via SDK"
        );

        let cw = self.cloudwatch_client()?;

        let mut req = cw.list_metrics();
        if let Some(ns) = namespace {
            req = req.namespace(ns);
        }

        let resp = req
            .send()
            .await
            .map_err(|e| MonitoringError::Internal(format!("CloudWatch list_metrics error: {e}")))?;

        let metrics: Vec<MetricDetail> = resp
            .metrics()
            .iter()
            .map(|m| {
                let name = m.metric_name().unwrap_or("unknown").to_owned();
                let ns = m.namespace().unwrap_or("").to_owned();
                MetricDetail {
                    name: name.clone(),
                    display_name: format!("{ns}/{name}"),
                    unit: "None".to_owned(),
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
            provider = "aws",
            metric = name,
            "Getting CloudWatch metric data via SDK"
        );

        let cw = self.cloudwatch_client()?;

        let start_time = aws_sdk_cloudwatch::primitives::DateTime::from_secs(start.timestamp());
        let end_time = aws_sdk_cloudwatch::primitives::DateTime::from_secs(end.timestamp());

        let metric_data_query = aws_sdk_cloudwatch::types::MetricDataQuery::builder()
            .id("m1")
            .metric_stat(
                aws_sdk_cloudwatch::types::MetricStat::builder()
                    .metric(
                        aws_sdk_cloudwatch::types::Metric::builder()
                            .metric_name(name)
                            .namespace("AWS/EC2")
                            .build(),
                    )
                    .period(period_seconds as i32)
                    .stat("Average")
                    .build(),
            )
            .build();

        let resp = cw
            .get_metric_data()
            .metric_data_queries(metric_data_query)
            .start_time(start_time)
            .end_time(end_time)
            .send()
            .await
            .map_err(|e| {
                MonitoringError::Internal(format!("CloudWatch get_metric_data error: {e}"))
            })?;

        let mut data_points = Vec::new();

        for result in resp.metric_data_results() {
            let timestamps = result.timestamps();
            let values = result.values();

            for (ts, val) in timestamps.iter().zip(values.iter()) {
                let secs = ts.secs();
                if let Some(dt) = Utc.timestamp_opt(secs, 0).single() {
                    data_points.push(MetricDataPoint {
                        timestamp: dt,
                        value: *val,
                    });
                }
            }
        }

        // Sort by timestamp ascending
        data_points.sort_by_key(|dp| dp.timestamp);

        Ok(data_points)
    }
}

#[async_trait]
impl LogsProvider for AwsMonitoringProvider {
    async fn query_logs(
        &self,
        log_group: Option<&str>,
        filter_pattern: Option<&str>,
        limit: usize,
    ) -> LogResult<Vec<LogEntry>> {
        tracing::info!(
            provider = "aws",
            log_group = log_group,
            "Querying CloudWatch Logs via SDK"
        );

        let logs_client = self.logs_client()?;
        let group = log_group.unwrap_or("/aws/lambda/default");

        let mut req = logs_client
            .filter_log_events()
            .log_group_name(group)
            .limit(limit as i32);

        if let Some(pattern) = filter_pattern {
            req = req.filter_pattern(pattern);
        }

        let resp = req.send().await.map_err(|e| {
            MonitoringError::Internal(format!("CloudWatch Logs filter_log_events error: {e}"))
        })?;

        let entries: Vec<LogEntry> = resp
            .events()
            .iter()
            .map(|event| {
                let message = event.message().unwrap_or("").to_owned();
                let ts_millis = event.timestamp().unwrap_or(0);
                let timestamp = Utc
                    .timestamp_millis_opt(ts_millis)
                    .single()
                    .unwrap_or_else(Utc::now);

                let level = if message.contains("ERROR") || message.contains("error") {
                    LogLevel::Error
                } else if message.contains("WARN") || message.contains("warn") {
                    LogLevel::Warn
                } else if message.contains("DEBUG") || message.contains("debug") {
                    LogLevel::Debug
                } else {
                    LogLevel::Info
                };

                let service = event
                    .log_stream_name()
                    .unwrap_or("unknown")
                    .to_owned();

                LogEntry {
                    id: Uuid::new_v4(),
                    timestamp,
                    level,
                    service,
                    message,
                    trace_id: None,
                }
            })
            .collect();

        Ok(entries)
    }

    async fn list_log_groups(&self) -> LogResult<Vec<String>> {
        tracing::info!(provider = "aws", "Listing CloudWatch Log groups via SDK");

        let logs_client = self.logs_client()?;

        let resp = logs_client
            .describe_log_groups()
            .send()
            .await
            .map_err(|e| {
                MonitoringError::Internal(format!(
                    "CloudWatch Logs describe_log_groups error: {e}"
                ))
            })?;

        let groups: Vec<String> = resp
            .log_groups()
            .iter()
            .filter_map(|g| g.log_group_name().map(|s| s.to_owned()))
            .collect();

        Ok(groups)
    }
}

#[async_trait]
impl AlertsProvider for AwsMonitoringProvider {
    async fn list_alerts(&self) -> AlertResult<Vec<Alert>> {
        tracing::info!(
            provider = "aws",
            region = self.default_region.as_str(),
            "Listing CloudWatch alarms via SDK"
        );

        let cw = self.cloudwatch_client()?;

        let resp = cw
            .describe_alarms()
            .send()
            .await
            .map_err(|e| MonitoringError::Internal(format!("CloudWatch describe_alarms error: {e}")))?;

        let mut alerts = Vec::new();

        for alarm in resp.metric_alarms() {
            let state = alarm
                .state_value()
                .map(|s| s.as_str())
                .unwrap_or("INSUFFICIENT_DATA");

            let status = match state {
                "ALARM" => AlertStatus::Firing,
                "OK" => AlertStatus::Resolved,
                _ => AlertStatus::Acknowledged,
            };

            let severity = if alarm
                .alarm_name()
                .map(|n| n.to_lowercase().contains("critical"))
                .unwrap_or(false)
            {
                AlertSeverity::Critical
            } else if alarm
                .alarm_name()
                .map(|n| n.to_lowercase().contains("warn"))
                .unwrap_or(false)
            {
                AlertSeverity::Warning
            } else {
                AlertSeverity::Info
            };

            let updated = alarm
                .state_updated_timestamp()
                .map(|t| {
                    Utc.timestamp_opt(t.secs(), 0)
                        .single()
                        .unwrap_or_else(Utc::now)
                })
                .unwrap_or_else(Utc::now);

            let resolved_at = if status == AlertStatus::Resolved {
                Some(updated)
            } else {
                None
            };

            alerts.push(Alert {
                id: Uuid::new_v4(),
                name: alarm.alarm_name().unwrap_or("unknown").to_owned(),
                severity,
                status,
                message: alarm
                    .state_reason()
                    .unwrap_or("No description")
                    .to_owned(),
                source: alarm.namespace().unwrap_or("AWS/CloudWatch").to_owned(),
                created_at: updated,
                acknowledged_at: None,
                resolved_at,
            });
        }

        Ok(alerts)
    }

    async fn get_alert(&self, name: &str) -> AlertResult<Alert> {
        tracing::info!(
            provider = "aws",
            alarm = name,
            "Getting CloudWatch alarm via SDK"
        );

        let cw = self.cloudwatch_client()?;

        let resp = cw
            .describe_alarms()
            .alarm_names(name)
            .send()
            .await
            .map_err(|e| MonitoringError::Internal(format!("CloudWatch describe_alarms error: {e}")))?;

        let alarm = resp
            .metric_alarms()
            .first()
            .ok_or_else(|| MonitoringError::NotFound(format!("Alarm '{name}' not found")))?;

        let state = alarm
            .state_value()
            .map(|s| s.as_str())
            .unwrap_or("INSUFFICIENT_DATA");

        let status = match state {
            "ALARM" => AlertStatus::Firing,
            "OK" => AlertStatus::Resolved,
            _ => AlertStatus::Acknowledged,
        };

        let updated = alarm
            .state_updated_timestamp()
            .map(|t| {
                Utc.timestamp_opt(t.secs(), 0)
                    .single()
                    .unwrap_or_else(Utc::now)
            })
            .unwrap_or_else(Utc::now);

        let resolved_at = if status == AlertStatus::Resolved {
            Some(updated)
        } else {
            None
        };

        Ok(Alert {
            id: Uuid::new_v4(),
            name: alarm.alarm_name().unwrap_or("unknown").to_owned(),
            severity: AlertSeverity::Info,
            status,
            message: alarm
                .state_reason()
                .unwrap_or("No description")
                .to_owned(),
            source: alarm.namespace().unwrap_or("AWS/CloudWatch").to_owned(),
            created_at: updated,
            acknowledged_at: None,
            resolved_at,
        })
    }
}

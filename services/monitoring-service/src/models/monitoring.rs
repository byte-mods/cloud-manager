use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Dashboard ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dashboard {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub widgets: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateDashboardRequest {
    pub name: String,
    pub description: Option<String>,
}

// ── Metric ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricSummary {
    pub name: String,
    pub display_name: String,
    pub current_value: f64,
    pub unit: String,
    pub trend: String, // "up", "down", "stable"
    pub change_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricDataPoint {
    pub timestamp: DateTime<Utc>,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricDetail {
    pub name: String,
    pub display_name: String,
    pub unit: String,
    pub data_points: Vec<MetricDataPoint>,
    pub min: f64,
    pub max: f64,
    pub avg: f64,
}

// ── Alert ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AlertStatus {
    Firing,
    Acknowledged,
    Resolved,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AlertSeverity {
    Critical,
    Warning,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub id: Uuid,
    pub name: String,
    pub severity: AlertSeverity,
    pub status: AlertStatus,
    pub message: String,
    pub source: String,
    pub created_at: DateTime<Utc>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub resolved_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateAlertRequest {
    pub name: String,
    pub severity: AlertSeverity,
    pub message: String,
    pub source: String,
}

// ── Log ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub level: LogLevel,
    pub service: String,
    pub message: String,
    pub trace_id: Option<String>,
}

// ── Tracing ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceSummary {
    pub id: Uuid,
    pub name: String,
    pub service: String,
    pub duration_ms: u64,
    pub spans: u32,
    pub status: String,
    pub started_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Span {
    pub id: Uuid,
    pub name: String,
    pub service: String,
    pub duration_ms: u64,
    pub start_offset_ms: u64,
    pub status: String,
    pub attributes: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceDetail {
    pub id: Uuid,
    pub name: String,
    pub service: String,
    pub duration_ms: u64,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub spans: Vec<Span>,
}

// ── Uptime ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceHealth {
    pub id: Uuid,
    pub name: String,
    pub status: String,
    pub uptime_pct: f64,
    pub avg_response_ms: u64,
    pub last_checked: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UptimeHistoryEntry {
    pub timestamp: DateTime<Utc>,
    pub status: String,
    pub response_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceHealthDetail {
    pub service: ServiceHealth,
    pub history: Vec<UptimeHistoryEntry>,
}

// ── Notification Channels ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NotificationChannelType {
    Slack,
    Email,
    Pagerduty,
    Webhook,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationChannel {
    pub id: Uuid,
    pub name: String,
    pub channel_type: NotificationChannelType,
    pub webhook_url: String,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateNotificationChannelRequest {
    pub name: String,
    pub channel_type: NotificationChannelType,
    pub webhook_url: String,
}

// ── Overview ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringOverview {
    pub total_services: u32,
    pub healthy_services: u32,
    pub active_alerts: u32,
    pub critical_alerts: u32,
    pub avg_uptime_pct: f64,
    pub avg_response_ms: u64,
    pub error_rate_pct: f64,
    pub total_requests_24h: u64,
}

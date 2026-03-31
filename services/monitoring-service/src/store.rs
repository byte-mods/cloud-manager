use std::collections::HashMap;

use chrono::{Duration, Utc};
use uuid::Uuid;

use crate::models::monitoring::*;

/// Seed all monitoring data into SurrealDB if the dashboards table is empty.
pub async fn seed_if_empty(db: &cloud_common::Database) {
    // Check if dashboards table already has data
    let existing: Vec<Dashboard> = db.list("dashboards").await.unwrap_or_default();
    if !existing.is_empty() {
        tracing::info!("SurrealDB already seeded ({} dashboards found), skipping", existing.len());
        return;
    }

    tracing::info!("SurrealDB is empty, seeding monitoring data...");
    let now = Utc::now();

    // Seed dashboards
    for dashboard in seed_dashboards(now) {
        let id = dashboard.id.to_string();
        let _: Option<Dashboard> = db
            .create_with_id("dashboards", &id, dashboard)
            .await
            .unwrap_or(None);
    }

    // Seed alerts
    for alert in seed_alerts(now) {
        let id = alert.id.to_string();
        let _: Option<Alert> = db
            .create_with_id("alerts", &id, alert)
            .await
            .unwrap_or(None);
    }

    // Seed logs
    for log in seed_logs(now) {
        let id = log.id.to_string();
        let _: Option<LogEntry> = db
            .create_with_id("logs", &id, log)
            .await
            .unwrap_or(None);
    }

    // Seed traces
    for trace in seed_traces(now) {
        let id = trace.id.to_string();
        let _: Option<TraceDetail> = db
            .create_with_id("traces", &id, trace)
            .await
            .unwrap_or(None);
    }

    // Seed services
    for service in seed_services(now) {
        let id = service.id.to_string();
        let _: Option<ServiceHealth> = db
            .create_with_id("services", &id, service)
            .await
            .unwrap_or(None);
    }

    // Seed metrics (store each MetricDetail as a single document keyed by name)
    for (name, metric) in seed_metrics(now) {
        let _: Option<MetricDetail> = db
            .create_with_id("metrics", &name, metric)
            .await
            .unwrap_or(None);
    }

    // notification_channels starts empty (same as before)

    tracing::info!("SurrealDB seeding complete");
}

// ── Dashboards ─────────────────────────────────────────────────────────────

fn seed_dashboards(now: chrono::DateTime<Utc>) -> Vec<Dashboard> {
    vec![
        Dashboard {
            id: Uuid::new_v4(),
            name: "Infrastructure Overview".into(),
            description: "Real-time view of all infrastructure components and health status".into(),
            widgets: 12,
            created_at: now - Duration::days(30),
            updated_at: now - Duration::hours(2),
        },
        Dashboard {
            id: Uuid::new_v4(),
            name: "Application Performance".into(),
            description: "Latency, throughput, and error tracking for application services".into(),
            widgets: 9,
            created_at: now - Duration::days(21),
            updated_at: now - Duration::hours(6),
        },
        Dashboard {
            id: Uuid::new_v4(),
            name: "Cost & Usage".into(),
            description: "Cloud spend tracking, resource utilization, and cost optimization".into(),
            widgets: 7,
            created_at: now - Duration::days(14),
            updated_at: now - Duration::days(1),
        },
    ]
}

// ── Alerts ─────────────────────────────────────────────────────────────────

fn seed_alerts(now: chrono::DateTime<Utc>) -> Vec<Alert> {
    vec![
        Alert {
            id: Uuid::new_v4(),
            name: "High CPU on web-server-1".into(),
            severity: AlertSeverity::Critical,
            status: AlertStatus::Firing,
            message: "CPU utilization exceeded 95% for over 5 minutes on web-server-1 (us-east-1a)".into(),
            source: "web-server-1".into(),
            created_at: now - Duration::minutes(12),
            acknowledged_at: None,
            resolved_at: None,
        },
        Alert {
            id: Uuid::new_v4(),
            name: "Disk usage >85% on prod-db".into(),
            severity: AlertSeverity::Warning,
            status: AlertStatus::Firing,
            message: "Disk usage reached 87% on prod-db primary volume (/dev/sda1)".into(),
            source: "prod-db".into(),
            created_at: now - Duration::minutes(45),
            acknowledged_at: None,
            resolved_at: None,
        },
        Alert {
            id: Uuid::new_v4(),
            name: "Memory pressure on cache-layer".into(),
            severity: AlertSeverity::Warning,
            status: AlertStatus::Acknowledged,
            message: "Memory utilization at 82% on cache-layer-2, approaching eviction threshold".into(),
            source: "cache-layer".into(),
            created_at: now - Duration::hours(2),
            acknowledged_at: Some(now - Duration::hours(1)),
            resolved_at: None,
        },
        Alert {
            id: Uuid::new_v4(),
            name: "Elevated error rate on auth-service".into(),
            severity: AlertSeverity::Warning,
            status: AlertStatus::Acknowledged,
            message: "Error rate spiked to 2.4% on auth-service following deployment v2.3.1".into(),
            source: "auth-service".into(),
            created_at: now - Duration::hours(4),
            acknowledged_at: Some(now - Duration::hours(3)),
            resolved_at: None,
        },
        Alert {
            id: Uuid::new_v4(),
            name: "SSL certificate expiring".into(),
            severity: AlertSeverity::Info,
            status: AlertStatus::Resolved,
            message: "SSL certificate for api.example.com was renewed successfully".into(),
            source: "api-gateway".into(),
            created_at: now - Duration::days(2),
            acknowledged_at: Some(now - Duration::days(2) + Duration::hours(1)),
            resolved_at: Some(now - Duration::days(1)),
        },
        Alert {
            id: Uuid::new_v4(),
            name: "Network latency spike".into(),
            severity: AlertSeverity::Warning,
            status: AlertStatus::Resolved,
            message: "Cross-region latency between us-east-1 and eu-west-1 exceeded 200ms".into(),
            source: "network-monitor".into(),
            created_at: now - Duration::days(3),
            acknowledged_at: Some(now - Duration::days(3) + Duration::minutes(30)),
            resolved_at: Some(now - Duration::days(3) + Duration::hours(2)),
        },
        Alert {
            id: Uuid::new_v4(),
            name: "Database connection pool exhausted".into(),
            severity: AlertSeverity::Critical,
            status: AlertStatus::Resolved,
            message: "Connection pool reached 100% on prod-db, queries were queued for 45 seconds".into(),
            source: "database-proxy".into(),
            created_at: now - Duration::days(5),
            acknowledged_at: Some(now - Duration::days(5) + Duration::minutes(5)),
            resolved_at: Some(now - Duration::days(5) + Duration::minutes(20)),
        },
        Alert {
            id: Uuid::new_v4(),
            name: "Queue depth warning".into(),
            severity: AlertSeverity::Info,
            status: AlertStatus::Resolved,
            message: "Processing queue depth exceeded 1000 messages, auto-scaling triggered".into(),
            source: "queue-service".into(),
            created_at: now - Duration::days(7),
            acknowledged_at: Some(now - Duration::days(7) + Duration::hours(1)),
            resolved_at: Some(now - Duration::days(7) + Duration::hours(2)),
        },
    ]
}

// ── Logs ───────────────────────────────────────────────────────────────────

fn seed_logs(now: chrono::DateTime<Utc>) -> Vec<LogEntry> {
    let _services = ["api-gateway", "auth-service", "web-server", "database-proxy", "cache-layer"];
    let mut logs = Vec::with_capacity(50);

    let log_templates: Vec<(LogLevel, &str, &str)> = vec![
        (LogLevel::Info, "api-gateway", "Incoming request POST /api/v1/orders from 10.0.1.45"),
        (LogLevel::Info, "api-gateway", "Request completed 200 OK in 142ms"),
        (LogLevel::Info, "api-gateway", "Rate limiter: 1240 requests/min for tenant acme-corp"),
        (LogLevel::Warn, "api-gateway", "Upstream response time degraded: auth-service averaging 320ms"),
        (LogLevel::Error, "api-gateway", "Connection timeout to upstream auth-service after 30s"),
        (LogLevel::Info, "api-gateway", "Health check passed for all upstream services"),
        (LogLevel::Debug, "api-gateway", "TLS handshake completed with client 10.0.2.88"),
        (LogLevel::Info, "auth-service", "User login successful: user_42@example.com from 10.0.1.100"),
        (LogLevel::Warn, "auth-service", "Failed login attempt for user admin@example.com (3rd attempt)"),
        (LogLevel::Error, "auth-service", "JWT token validation failed: token expired at 2026-03-29T22:00:00Z"),
        (LogLevel::Info, "auth-service", "OAuth2 token refreshed for client_id=dashboard-app"),
        (LogLevel::Debug, "auth-service", "RBAC policy evaluation: user_42 -> resource:ec2:read -> ALLOW"),
        (LogLevel::Info, "auth-service", "Session created for user_128 with TTL 3600s"),
        (LogLevel::Warn, "auth-service", "Rate limit approaching for IP 203.0.113.50 (85/100 requests)"),
        (LogLevel::Info, "web-server", "Static asset cache refreshed: 342 files, 48MB total"),
        (LogLevel::Info, "web-server", "Server-sent events connection established for dashboard client"),
        (LogLevel::Warn, "web-server", "Response time exceeded SLO: GET /dashboard took 2.4s (target: 1s)"),
        (LogLevel::Error, "web-server", "Template rendering failed: missing variable 'cluster_status'"),
        (LogLevel::Debug, "web-server", "WebSocket connection upgraded for client session ws_8834"),
        (LogLevel::Info, "web-server", "Gzip compression ratio: 78% for /api/v1/monitoring/metrics"),
        (LogLevel::Info, "database-proxy", "Connection pool stats: 25/50 active, 3 idle, 0 waiting"),
        (LogLevel::Warn, "database-proxy", "Slow query detected: SELECT * FROM events WHERE... took 3.2s"),
        (LogLevel::Error, "database-proxy", "Replication lag exceeded threshold: 4.5s on replica-2"),
        (LogLevel::Info, "database-proxy", "Auto-vacuum completed on table 'audit_logs': 12,400 rows removed"),
        (LogLevel::Debug, "database-proxy", "Query plan cache hit ratio: 94.2% (last 5 minutes)"),
        (LogLevel::Info, "database-proxy", "Failover test completed successfully: switched to replica-1 in 1.2s"),
        (LogLevel::Warn, "database-proxy", "Connection count approaching limit: 45/50 on primary"),
        (LogLevel::Info, "cache-layer", "Cache hit rate: 94.2% (last 5 minutes)"),
        (LogLevel::Warn, "cache-layer", "Memory usage at 82%: evicting LRU entries"),
        (LogLevel::Error, "cache-layer", "Failed to connect to cache node cache-03: connection refused"),
        (LogLevel::Info, "cache-layer", "Key distribution rebalanced across 4 nodes"),
        (LogLevel::Debug, "cache-layer", "TTL expired for 1,240 keys in namespace 'session'"),
        (LogLevel::Info, "cache-layer", "Cluster health: 3/4 nodes healthy, 1 node recovering"),
        (LogLevel::Info, "api-gateway", "Circuit breaker OPEN for payment-service (5 failures in 30s)"),
        (LogLevel::Warn, "api-gateway", "Request body size exceeded 1MB limit for POST /api/v1/uploads"),
        (LogLevel::Info, "auth-service", "MFA verification successful for user_42@example.com"),
        (LogLevel::Error, "web-server", "Out of memory: process RSS exceeded 2GB limit"),
        (LogLevel::Info, "database-proxy", "Backup completed: full snapshot (2.3GB) uploaded to S3"),
        (LogLevel::Debug, "cache-layer", "Pub/Sub message delivered to 12 subscribers on channel 'alerts'"),
        (LogLevel::Info, "api-gateway", "API version v2 routes enabled for tenant beta-corp"),
        (LogLevel::Warn, "database-proxy", "Lock contention detected on table 'orders': 8 concurrent locks"),
        (LogLevel::Info, "web-server", "CDN purge completed for /static/* (342 objects)"),
        (LogLevel::Error, "api-gateway", "503 Service Unavailable: all upstream instances for search-service unhealthy"),
        (LogLevel::Info, "cache-layer", "Warm-up completed: 45,000 keys preloaded from database"),
        (LogLevel::Debug, "auth-service", "Token introspection: valid, expires in 1823s, scopes=[read,write]"),
        (LogLevel::Info, "database-proxy", "Index rebuild completed on events.created_at (12.4M rows, 3m 22s)"),
        (LogLevel::Warn, "web-server", "Client disconnected during SSE stream: session ws_7721"),
        (LogLevel::Info, "api-gateway", "Load balancer health: 8/8 instances healthy"),
        (LogLevel::Error, "database-proxy", "Deadlock detected and resolved: transaction 44821 rolled back"),
        (LogLevel::Info, "cache-layer", "Snapshot saved: 890MB compressed, 2.1GB uncompressed"),
    ];

    for (i, (level, service, message)) in log_templates.iter().enumerate() {
        logs.push(LogEntry {
            id: Uuid::new_v4(),
            timestamp: now - Duration::seconds((i as i64) * 37 + 5), // spread over ~30 minutes
            level: level.clone(),
            service: service.to_string(),
            message: message.to_string(),
            trace_id: if i % 4 == 0 {
                Some(format!("trace-{:08x}", i * 31337))
            } else {
                None
            },
        });
    }

    logs
}

// ── Traces ─────────────────────────────────────────────────────────────────

fn seed_traces(now: chrono::DateTime<Utc>) -> Vec<TraceDetail> {
    vec![
        TraceDetail {
            id: Uuid::new_v4(),
            name: "POST /api/v1/orders".into(),
            service: "api-gateway".into(),
            duration_ms: 245,
            status: "ok".into(),
            started_at: now - Duration::minutes(5),
            spans: vec![
                Span { id: Uuid::new_v4(), name: "auth.verify_token".into(), service: "auth-service".into(), duration_ms: 12, start_offset_ms: 0, status: "ok".into(), attributes: serde_json::json!({"token_type": "bearer", "user_id": "user_42"}) },
                Span { id: Uuid::new_v4(), name: "validation.check_payload".into(), service: "api-gateway".into(), duration_ms: 3, start_offset_ms: 12, status: "ok".into(), attributes: serde_json::json!({"schema": "order_v2", "fields_validated": 14}) },
                Span { id: Uuid::new_v4(), name: "db.insert_order".into(), service: "database-proxy".into(), duration_ms: 85, start_offset_ms: 15, status: "ok".into(), attributes: serde_json::json!({"table": "orders", "operation": "INSERT", "rows_affected": 1}) },
                Span { id: Uuid::new_v4(), name: "cache.update_inventory".into(), service: "cache-layer".into(), duration_ms: 8, start_offset_ms: 100, status: "ok".into(), attributes: serde_json::json!({"keys_updated": 3, "cache_namespace": "inventory"}) },
                Span { id: Uuid::new_v4(), name: "http.send_response".into(), service: "api-gateway".into(), duration_ms: 2, start_offset_ms: 108, status: "ok".into(), attributes: serde_json::json!({"status_code": 201, "content_length": 342}) },
            ],
        },
        TraceDetail {
            id: Uuid::new_v4(),
            name: "GET /api/v1/users/profile".into(),
            service: "api-gateway".into(),
            duration_ms: 67,
            status: "ok".into(),
            started_at: now - Duration::minutes(8),
            spans: vec![
                Span { id: Uuid::new_v4(), name: "auth.verify_token".into(), service: "auth-service".into(), duration_ms: 10, start_offset_ms: 0, status: "ok".into(), attributes: serde_json::json!({"token_type": "bearer"}) },
                Span { id: Uuid::new_v4(), name: "cache.get_profile".into(), service: "cache-layer".into(), duration_ms: 4, start_offset_ms: 10, status: "ok".into(), attributes: serde_json::json!({"cache_hit": true, "key": "profile:user_42"}) },
                Span { id: Uuid::new_v4(), name: "http.send_response".into(), service: "api-gateway".into(), duration_ms: 1, start_offset_ms: 14, status: "ok".into(), attributes: serde_json::json!({"status_code": 200}) },
            ],
        },
        TraceDetail {
            id: Uuid::new_v4(),
            name: "POST /api/v1/payments/charge".into(),
            service: "api-gateway".into(),
            duration_ms: 892,
            status: "error".into(),
            started_at: now - Duration::minutes(15),
            spans: vec![
                Span { id: Uuid::new_v4(), name: "auth.verify_token".into(), service: "auth-service".into(), duration_ms: 11, start_offset_ms: 0, status: "ok".into(), attributes: serde_json::json!({"token_type": "bearer"}) },
                Span { id: Uuid::new_v4(), name: "validation.check_payment".into(), service: "api-gateway".into(), duration_ms: 5, start_offset_ms: 11, status: "ok".into(), attributes: serde_json::json!({"amount": 149.99, "currency": "USD"}) },
                Span { id: Uuid::new_v4(), name: "db.check_balance".into(), service: "database-proxy".into(), duration_ms: 42, start_offset_ms: 16, status: "ok".into(), attributes: serde_json::json!({"table": "accounts"}) },
                Span { id: Uuid::new_v4(), name: "external.payment_gateway".into(), service: "payment-service".into(), duration_ms: 800, start_offset_ms: 58, status: "error".into(), attributes: serde_json::json!({"gateway": "stripe", "error": "timeout", "retry_count": 3}) },
                Span { id: Uuid::new_v4(), name: "http.send_response".into(), service: "api-gateway".into(), duration_ms: 2, start_offset_ms: 858, status: "error".into(), attributes: serde_json::json!({"status_code": 504}) },
            ],
        },
        TraceDetail {
            id: Uuid::new_v4(),
            name: "GET /api/v1/search?q=kubernetes".into(),
            service: "api-gateway".into(),
            duration_ms: 156,
            status: "ok".into(),
            started_at: now - Duration::minutes(22),
            spans: vec![
                Span { id: Uuid::new_v4(), name: "auth.verify_token".into(), service: "auth-service".into(), duration_ms: 9, start_offset_ms: 0, status: "ok".into(), attributes: serde_json::json!({"token_type": "api_key"}) },
                Span { id: Uuid::new_v4(), name: "search.query_index".into(), service: "search-service".into(), duration_ms: 78, start_offset_ms: 9, status: "ok".into(), attributes: serde_json::json!({"index": "resources", "hits": 42, "query": "kubernetes"}) },
                Span { id: Uuid::new_v4(), name: "cache.store_results".into(), service: "cache-layer".into(), duration_ms: 6, start_offset_ms: 87, status: "ok".into(), attributes: serde_json::json!({"ttl_seconds": 300}) },
                Span { id: Uuid::new_v4(), name: "http.send_response".into(), service: "api-gateway".into(), duration_ms: 2, start_offset_ms: 93, status: "ok".into(), attributes: serde_json::json!({"status_code": 200, "result_count": 42}) },
            ],
        },
        TraceDetail {
            id: Uuid::new_v4(),
            name: "DELETE /api/v1/resources/vm-1234".into(),
            service: "api-gateway".into(),
            duration_ms: 340,
            status: "ok".into(),
            started_at: now - Duration::minutes(35),
            spans: vec![
                Span { id: Uuid::new_v4(), name: "auth.verify_token".into(), service: "auth-service".into(), duration_ms: 11, start_offset_ms: 0, status: "ok".into(), attributes: serde_json::json!({"token_type": "bearer", "permission": "resource:delete"}) },
                Span { id: Uuid::new_v4(), name: "auth.check_rbac".into(), service: "auth-service".into(), duration_ms: 15, start_offset_ms: 11, status: "ok".into(), attributes: serde_json::json!({"role": "admin", "allowed": true}) },
                Span { id: Uuid::new_v4(), name: "cloud.terminate_instance".into(), service: "cloud-service".into(), duration_ms: 250, start_offset_ms: 26, status: "ok".into(), attributes: serde_json::json!({"provider": "aws", "instance_id": "i-0abc1234", "region": "us-east-1"}) },
                Span { id: Uuid::new_v4(), name: "db.update_resource_status".into(), service: "database-proxy".into(), duration_ms: 18, start_offset_ms: 276, status: "ok".into(), attributes: serde_json::json!({"table": "resources", "new_status": "terminated"}) },
                Span { id: Uuid::new_v4(), name: "cache.invalidate".into(), service: "cache-layer".into(), duration_ms: 3, start_offset_ms: 294, status: "ok".into(), attributes: serde_json::json!({"keys_invalidated": 5}) },
                Span { id: Uuid::new_v4(), name: "http.send_response".into(), service: "api-gateway".into(), duration_ms: 1, start_offset_ms: 297, status: "ok".into(), attributes: serde_json::json!({"status_code": 204}) },
            ],
        },
    ]
}

// ── Services (Uptime) ──────────────────────────────────────────────────────

fn seed_services(now: chrono::DateTime<Utc>) -> Vec<ServiceHealth> {
    vec![
        ServiceHealth { id: Uuid::new_v4(), name: "api-gateway".into(), status: "healthy".into(), uptime_pct: 99.95, avg_response_ms: 45, last_checked: now - Duration::seconds(30) },
        ServiceHealth { id: Uuid::new_v4(), name: "auth-service".into(), status: "healthy".into(), uptime_pct: 99.99, avg_response_ms: 32, last_checked: now - Duration::seconds(30) },
        ServiceHealth { id: Uuid::new_v4(), name: "web-frontend".into(), status: "healthy".into(), uptime_pct: 99.90, avg_response_ms: 120, last_checked: now - Duration::seconds(30) },
        ServiceHealth { id: Uuid::new_v4(), name: "database".into(), status: "healthy".into(), uptime_pct: 99.98, avg_response_ms: 8, last_checked: now - Duration::seconds(30) },
        ServiceHealth { id: Uuid::new_v4(), name: "cache".into(), status: "healthy".into(), uptime_pct: 99.97, avg_response_ms: 3, last_checked: now - Duration::seconds(30) },
        ServiceHealth { id: Uuid::new_v4(), name: "queue".into(), status: "healthy".into(), uptime_pct: 99.93, avg_response_ms: 15, last_checked: now - Duration::seconds(30) },
        ServiceHealth { id: Uuid::new_v4(), name: "search".into(), status: "degraded".into(), uptime_pct: 99.85, avg_response_ms: 210, last_checked: now - Duration::seconds(30) },
        ServiceHealth { id: Uuid::new_v4(), name: "monitoring".into(), status: "healthy".into(), uptime_pct: 100.0, avg_response_ms: 5, last_checked: now - Duration::seconds(30) },
    ]
}

// ── Metrics ────────────────────────────────────────────────────────────────

fn seed_metrics(now: chrono::DateTime<Utc>) -> HashMap<String, MetricDetail> {
    let mut map = HashMap::new();

    let metric_defs: Vec<(&str, &str, &str, f64, f64, f64)> = vec![
        // (name, display, unit, base_value, noise_amplitude, daily_cycle_amplitude)
        ("cpu_utilization",    "CPU Utilization",    "%",       45.0,  8.0,  15.0),
        ("memory_usage",       "Memory Usage",       "%",       62.0,  5.0,  8.0),
        ("disk_io_read",       "Disk I/O Read",      "MB/s",    120.0, 30.0, 40.0),
        ("disk_io_write",      "Disk I/O Write",     "MB/s",    85.0,  25.0, 35.0),
        ("network_in",         "Network In",         "Mbps",    450.0, 80.0, 150.0),
        ("network_out",        "Network Out",        "Mbps",    320.0, 60.0, 100.0),
        ("request_count",      "Request Count",      "req/min", 2400.0, 400.0, 800.0),
        ("error_rate",         "Error Rate",         "%",       0.2,   0.1,  0.05),
        ("latency_p50",        "Latency (p50)",      "ms",      45.0,  10.0, 12.0),
        ("latency_p95",        "Latency (p95)",      "ms",      180.0, 40.0, 50.0),
        ("latency_p99",        "Latency (p99)",      "ms",      450.0, 80.0, 120.0),
        ("active_connections", "Active Connections",  "count",   340.0, 50.0, 120.0),
        ("queue_depth",        "Queue Depth",        "count",   12.0,  8.0,  6.0),
        ("cache_hit_rate",     "Cache Hit Rate",     "%",       94.0,  2.0,  3.0),
        ("db_connections",     "DB Connections",     "count",   25.0,  5.0,  8.0),
    ];

    for (name, display, unit, base, noise, cycle) in metric_defs {
        let data_points = generate_metric_data_points(now, base, noise, cycle);
        let values: Vec<f64> = data_points.iter().map(|p| p.value).collect();
        let min = values.iter().cloned().fold(f64::INFINITY, f64::min);
        let max = values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let avg = values.iter().sum::<f64>() / values.len() as f64;

        map.insert(
            name.to_string(),
            MetricDetail {
                name: name.to_string(),
                display_name: display.to_string(),
                unit: unit.to_string(),
                data_points,
                min: (min * 100.0).round() / 100.0,
                max: (max * 100.0).round() / 100.0,
                avg: (avg * 100.0).round() / 100.0,
            },
        );
    }

    map
}

/// Generate 288 data points (24h at 5min intervals) with realistic daily patterns.
fn generate_metric_data_points(
    now: chrono::DateTime<Utc>,
    base: f64,
    noise_amp: f64,
    cycle_amp: f64,
) -> Vec<MetricDataPoint> {
    let mut points = Vec::with_capacity(288);
    // Simple seeded pseudo-random using a basic LCG
    let mut rng_state: u64 = (base * 1000.0) as u64 ^ 0xDEAD_BEEF;

    for i in 0..288 {
        let t = now - Duration::minutes((287 - i) * 5);
        let hour_fraction = ((287 - i) as f64 * 5.0) / 1440.0; // fraction of day from start

        // Daily cycle: peak during business hours (offset so ~12h ago is peak)
        let cycle = cycle_amp * (2.0 * std::f64::consts::PI * (hour_fraction - 0.35)).sin();

        // Deterministic noise
        rng_state = rng_state.wrapping_mul(6364136223846793005).wrapping_add(1);
        let noise_frac = ((rng_state >> 33) as f64) / (u32::MAX as f64) - 0.5; // [-0.5, 0.5]
        let noise = noise_amp * noise_frac;

        let mut value = base + cycle + noise;
        // Clamp percentages to [0, 100]
        if base <= 100.0 && (base > 0.5 || base < 0.01) {
            // likely a percentage or small value
        }
        if value < 0.0 {
            value = 0.0;
        }
        value = (value * 100.0).round() / 100.0;

        points.push(MetricDataPoint {
            timestamp: t,
            value,
        });
    }

    points
}

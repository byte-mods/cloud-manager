use serde::{de::DeserializeOwned, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use surrealdb::engine::local::{Db, RocksDb};
use surrealdb::Surreal;

/// Embedded SurrealDB database client.
///
/// Uses RocksDB backend for persistent storage on disk.
/// No external database server needed.
#[derive(Clone)]
pub struct Database {
    db: Arc<Surreal<Db>>,
    /// In-memory cache (replaces Redis)
    cache: Arc<Mutex<HashMap<String, CacheEntry>>>,
    /// In-memory rate limit counters (replaces Redis)
    rate_limits: Arc<Mutex<HashMap<String, (u64, u64)>>>,
}

struct CacheEntry {
    value: String,
    expires_at: u64,
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

impl Database {
    /// Create a new embedded SurrealDB instance backed by RocksDB.
    pub async fn new(path: &str) -> Result<Self, String> {
        let db = Surreal::new::<RocksDb>(path)
            .await
            .map_err(|e| format!("Failed to open SurrealDB at {path}: {e}"))?;

        db.use_ns("cloud_manager")
            .use_db("main")
            .await
            .map_err(|e| format!("Failed to select namespace/db: {e}"))?;

        tracing::info!("SurrealDB embedded database opened at {path}");

        Ok(Self {
            db: Arc::new(db),
            cache: Arc::new(Mutex::new(HashMap::new())),
            rate_limits: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    /// Get the raw SurrealDB instance for direct queries.
    pub fn inner(&self) -> &Surreal<Db> {
        &self.db
    }

    /// Create a record in a table.
    pub async fn create<T: Serialize + DeserializeOwned + 'static>(
        &self,
        table: &str,
        data: T,
    ) -> Result<Option<T>, String> {
        self.db
            .create(table)
            .content(data)
            .await
            .map_err(|e| format!("Create failed: {e}"))
    }

    /// Create a record with a specific ID.
    pub async fn create_with_id<T: Serialize + DeserializeOwned + 'static>(
        &self,
        table: &str,
        id: &str,
        data: T,
    ) -> Result<Option<T>, String> {
        self.db
            .create((table, id))
            .content(data)
            .await
            .map_err(|e| format!("Create with ID failed: {e}"))
    }

    /// List all records from a table.
    pub async fn list<T: DeserializeOwned>(&self, table: &str) -> Result<Vec<T>, String> {
        self.db
            .select(table)
            .await
            .map_err(|e| format!("List failed: {e}"))
    }

    /// Get a single record by ID.
    pub async fn get<T: DeserializeOwned>(
        &self,
        table: &str,
        id: &str,
    ) -> Result<Option<T>, String> {
        self.db
            .select((table, id))
            .await
            .map_err(|e| format!("Get failed: {e}"))
    }

    /// Update a record by ID.
    pub async fn update<T: Serialize + DeserializeOwned + 'static>(
        &self,
        table: &str,
        id: &str,
        data: T,
    ) -> Result<Option<T>, String> {
        self.db
            .update((table, id))
            .content(data)
            .await
            .map_err(|e| format!("Update failed: {e}"))
    }

    /// Delete a record by ID.
    pub async fn delete(&self, table: &str, id: &str) -> Result<(), String> {
        let _: Option<serde_json::Value> = self
            .db
            .delete((table, id))
            .await
            .map_err(|e| format!("Delete failed: {e}"))?;
        Ok(())
    }

    /// Run a raw SurrealQL query.
    pub async fn query(&self, sql: &str) -> Result<surrealdb::Response, String> {
        self.db
            .query(sql)
            .await
            .map_err(|e| format!("Query failed: {e}"))
    }

    /// Run a parameterized SurrealQL query with bindings.
    pub async fn query_with_bindings<T: DeserializeOwned>(
        &self,
        sql: &str,
        bindings: impl Serialize + 'static,
    ) -> Result<Vec<T>, String> {
        let mut response = self
            .db
            .query(sql)
            .bind(bindings)
            .await
            .map_err(|e| format!("Query with bindings failed: {e}"))?;
        let results: Vec<T> = response
            .take(0)
            .map_err(|e| format!("Failed to deserialize query results: {e}"))?;
        Ok(results)
    }

    /// Upsert a record — create if not exists, update if exists.
    pub async fn upsert<T: Serialize + DeserializeOwned + 'static>(
        &self,
        table: &str,
        id: &str,
        data: T,
    ) -> Result<Option<T>, String> {
        self.db
            .upsert((table, id))
            .content(data)
            .await
            .map_err(|e| format!("Upsert failed: {e}"))
    }

    /// List records from a table with a SurrealQL WHERE clause.
    /// Example: `list_filtered("alerts", "severity = 'critical' AND status = 'active'").await`
    pub async fn list_filtered<T: DeserializeOwned>(
        &self,
        table: &str,
        where_clause: &str,
    ) -> Result<Vec<T>, String> {
        let sql = format!("SELECT * FROM {table} WHERE {where_clause}");
        let mut response = self
            .db
            .query(&sql)
            .await
            .map_err(|e| format!("Filtered list failed: {e}"))?;
        let results: Vec<T> = response
            .take(0)
            .map_err(|e| format!("Failed to deserialize filtered results: {e}"))?;
        Ok(results)
    }

    /// List records with ordering and optional limit.
    pub async fn list_ordered<T: DeserializeOwned>(
        &self,
        table: &str,
        order_by: &str,
        limit: Option<u32>,
    ) -> Result<Vec<T>, String> {
        let sql = match limit {
            Some(n) => format!("SELECT * FROM {table} ORDER BY {order_by} LIMIT {n}"),
            None => format!("SELECT * FROM {table} ORDER BY {order_by}"),
        };
        let mut response = self
            .db
            .query(&sql)
            .await
            .map_err(|e| format!("Ordered list failed: {e}"))?;
        let results: Vec<T> = response
            .take(0)
            .map_err(|e| format!("Failed to deserialize ordered results: {e}"))?;
        Ok(results)
    }

    /// Count records in a table, optionally with a WHERE clause.
    pub async fn count(&self, table: &str, where_clause: Option<&str>) -> Result<u64, String> {
        let sql = match where_clause {
            Some(w) => format!("SELECT count() as total FROM {table} WHERE {w} GROUP ALL"),
            None => format!("SELECT count() as total FROM {table} GROUP ALL"),
        };
        let mut response = self
            .db
            .query(&sql)
            .await
            .map_err(|e| format!("Count failed: {e}"))?;
        let result: Option<serde_json::Value> = response
            .take(0)
            .map_err(|e| format!("Count deserialize failed: {e}"))?;
        Ok(result
            .and_then(|v| v.get("total").and_then(|t| t.as_u64()))
            .unwrap_or(0))
    }

    /// Delete all records matching a WHERE clause.
    pub async fn delete_where(&self, table: &str, where_clause: &str) -> Result<(), String> {
        let sql = format!("DELETE FROM {table} WHERE {where_clause}");
        self.db
            .query(&sql)
            .await
            .map_err(|e| format!("Delete where failed: {e}"))?;
        Ok(())
    }

    /// Initialize all table schemas. Called by every service at startup.
    /// Tables are SCHEMALESS and DEFINE IF NOT EXISTS, so this is idempotent.
    pub async fn init_schema(&self) -> Result<(), String> {
        let _ = self.query(r#"
            -- Schema versioning
            DEFINE TABLE IF NOT EXISTS schema_versions SCHEMALESS;

            -- Auth / IAM tables
            DEFINE TABLE IF NOT EXISTS users SCHEMALESS;
            DEFINE INDEX IF NOT EXISTS idx_users_email ON users FIELDS email UNIQUE;
            DEFINE TABLE IF NOT EXISTS api_keys SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS audit_log SCHEMALESS;
            DEFINE INDEX IF NOT EXISTS idx_audit_created ON audit_log FIELDS created_at;
            DEFINE TABLE IF NOT EXISTS notifications SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS webhooks SCHEMALESS;

            -- Organization tables
            DEFINE TABLE IF NOT EXISTS organizations SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS teams SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS projects SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS members SCHEMALESS;

            -- Approval tables
            DEFINE TABLE IF NOT EXISTS approval_workflows SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS approval_requests SCHEMALESS;
            DEFINE INDEX IF NOT EXISTS idx_approval_status ON approval_requests FIELDS status;

            -- Cloud accounts / connections
            DEFINE TABLE IF NOT EXISTS cloud_accounts SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS cloud_connections SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS resource_tags SCHEMALESS;

            -- Monitoring tables
            DEFINE TABLE IF NOT EXISTS dashboards SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS alerts SCHEMALESS;
            DEFINE INDEX IF NOT EXISTS idx_alerts_severity ON alerts FIELDS severity;
            DEFINE INDEX IF NOT EXISTS idx_alerts_status ON alerts FIELDS status;
            DEFINE TABLE IF NOT EXISTS logs SCHEMALESS;
            DEFINE INDEX IF NOT EXISTS idx_logs_timestamp ON logs FIELDS timestamp;
            DEFINE TABLE IF NOT EXISTS traces SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS services SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS metrics SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS metric_data_points SCHEMALESS;
            DEFINE INDEX IF NOT EXISTS idx_metric_dp_ts ON metric_data_points FIELDS metric_id, timestamp;
            DEFINE TABLE IF NOT EXISTS notification_channels SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS incidents SCHEMALESS;
            DEFINE INDEX IF NOT EXISTS idx_incidents_status ON incidents FIELDS status;
            DEFINE TABLE IF NOT EXISTS sla_targets SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS maintenance_windows SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS runbooks SCHEMALESS;

            -- Security tables
            DEFINE TABLE IF NOT EXISTS security_scans SCHEMALESS;
            DEFINE INDEX IF NOT EXISTS idx_scans_status ON security_scans FIELDS status;
            DEFINE TABLE IF NOT EXISTS security_findings SCHEMALESS;
            DEFINE INDEX IF NOT EXISTS idx_findings_severity ON security_findings FIELDS severity;
            DEFINE INDEX IF NOT EXISTS idx_findings_scan ON security_findings FIELDS scan_id;
            DEFINE TABLE IF NOT EXISTS compliance_assessments SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS compliance_frameworks SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS compliance_controls SCHEMALESS;
            DEFINE INDEX IF NOT EXISTS idx_controls_framework ON compliance_controls FIELDS framework_id;
            DEFINE TABLE IF NOT EXISTS vulnerabilities SCHEMALESS;
            DEFINE INDEX IF NOT EXISTS idx_vulns_severity ON vulnerabilities FIELDS severity;
            DEFINE TABLE IF NOT EXISTS ddos_tests SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS security_audit_entries SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS container_scans SCHEMALESS;

            -- Cost tables
            DEFINE TABLE IF NOT EXISTS budgets SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS cost_snapshots SCHEMALESS;
            DEFINE INDEX IF NOT EXISTS idx_cost_snap_date ON cost_snapshots FIELDS date, provider;
            DEFINE TABLE IF NOT EXISTS cost_recommendations SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS reservations SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS cost_anomalies SCHEMALESS;
            DEFINE INDEX IF NOT EXISTS idx_anomaly_status ON cost_anomalies FIELDS status;
            DEFINE TABLE IF NOT EXISTS finops_team_allocations SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS finops_unit_economics SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS finops_ri_recommendations SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS finops_waste_categories SCHEMALESS;

            -- Analytics tables
            DEFINE TABLE IF NOT EXISTS query_engines SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS visualizations SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS reports SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS search_indices SCHEMALESS;

            -- Data Engineering tables
            DEFINE TABLE IF NOT EXISTS etl_pipelines SCHEMALESS;
            DEFINE INDEX IF NOT EXISTS idx_etl_status ON etl_pipelines FIELDS status;
            DEFINE TABLE IF NOT EXISTS streaming_jobs SCHEMALESS;
            DEFINE INDEX IF NOT EXISTS idx_stream_status ON streaming_jobs FIELDS status;
            DEFINE TABLE IF NOT EXISTS datasets SCHEMALESS;

            -- Chaos Engineering tables
            DEFINE TABLE IF NOT EXISTS chaos_experiments SCHEMALESS;
            DEFINE INDEX IF NOT EXISTS idx_chaos_status ON chaos_experiments FIELDS status;
            DEFINE TABLE IF NOT EXISTS chaos_catalog SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS chaos_safety_settings SCHEMALESS;

            -- Drift Detection tables
            DEFINE TABLE IF NOT EXISTS drift_detections SCHEMALESS;
            DEFINE INDEX IF NOT EXISTS idx_drift_status ON drift_detections FIELDS drift_status;

            -- Infrastructure Design tables
            DEFINE TABLE IF NOT EXISTS infrastructure_designs SCHEMALESS;
            DEFINE TABLE IF NOT EXISTS service_catalog SCHEMALESS;
        "#).await?;

        tracing::info!("Database schema initialized");
        Ok(())
    }

    /// Initialize schema and seed demo data.
    pub async fn init_and_seed(&self) -> Result<(), String> {
        self.init_schema().await?;

        // Seed demo users if empty
        let users: Vec<serde_json::Value> = self.list("users").await.unwrap_or_default();
        if users.is_empty() {
            let accounts = vec![
                ("admin", "admin@cloudmanager.dev", "admin123", "cloud_architect", "Admin User"),
                ("devops", "devops@cloudmanager.dev", "devops123", "devops_engineer", "DevOps Engineer"),
                ("data", "data@cloudmanager.dev", "data123", "data_engineer", "Data Engineer"),
                ("sysadmin", "sysadmin@cloudmanager.dev", "sysadmin123", "system_admin", "System Admin"),
                ("network", "network@cloudmanager.dev", "network123", "network_admin", "Network Admin"),
            ];

            for (id, email, password, role, name) in accounts {
                let hash = bcrypt::hash(password, 6).map_err(|e| e.to_string())?;
                let _: Option<serde_json::Value> = self.create_with_id("users", id, serde_json::json!({
                    "email": email,
                    "name": name,
                    "password_hash": hash,
                    "role": role,
                    "mfa_enabled": false,
                })).await?;
            }
            tracing::info!("Seeded 5 demo user accounts");
        }

        Ok(())
    }

    // -- In-memory cache (replaces Redis caching) --

    pub fn cache_get(&self, key: &str) -> Option<String> {
        let cache = self.cache.lock().ok()?;
        let entry = cache.get(key)?;
        if entry.expires_at < now_secs() {
            return None;
        }
        Some(entry.value.clone())
    }

    pub fn cache_set(&self, key: &str, value: &str, ttl_secs: u64) {
        if let Ok(mut cache) = self.cache.lock() {
            cache.insert(key.to_string(), CacheEntry {
                value: value.to_string(),
                expires_at: now_secs() + ttl_secs,
            });
        }
    }

    // -- In-memory rate limiting (replaces Redis) --

    pub fn rate_limit_check(&self, key: &str, max_requests: u64, window_secs: u64) -> bool {
        let now = now_secs();
        if let Ok(mut limits) = self.rate_limits.lock() {
            let entry = limits.entry(key.to_string()).or_insert((0, now + window_secs));
            if now >= entry.1 {
                *entry = (1, now + window_secs);
                true
            } else if entry.0 < max_requests {
                entry.0 += 1;
                true
            } else {
                false
            }
        } else {
            true // Allow on lock failure
        }
    }
}

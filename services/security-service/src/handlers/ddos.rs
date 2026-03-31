use actix_web::{web, HttpResponse};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::config::AppConfig;
use crate::error::SecurityError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDdosTestRequest {
    /// Target URL or IP to test.
    pub target: String,
    /// Duration of the test in seconds.
    pub duration_seconds: u64,
    /// Type of DDoS simulation (e.g., "syn_flood", "http_flood", "udp_flood").
    pub attack_type: String,
    /// Requests per second to simulate.
    pub rate_limit: u64,
    /// Authorization document ID proving permission to test.
    pub authorization_document_id: String,
    /// Who authorized the test.
    pub authorized_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DdosTestResult {
    pub id: Uuid,
    pub target: String,
    pub attack_type: String,
    pub status: DdosTestStatus,
    pub duration_seconds: u64,
    pub total_requests_sent: u64,
    pub successful_responses: u64,
    pub failed_responses: u64,
    pub avg_response_time_ms: f64,
    pub max_response_time_ms: f64,
    pub started_at: chrono::DateTime<Utc>,
    pub completed_at: Option<chrono::DateTime<Utc>>,
    pub authorization_document_id: String,
    pub authorized_by: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DdosTestStatus {
    Pending,
    Running,
    Completed,
    Stopped,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: Uuid,
    pub test_id: Uuid,
    pub action: String,
    pub performed_by: String,
    pub timestamp: chrono::DateTime<Utc>,
    pub details: serde_json::Value,
}

/// POST /api/v1/security/ddos-tests
///
/// Create a new DDoS test. Requires a valid authorization document.
pub async fn create_test(
    config: web::Data<AppConfig>,
    db: web::Data<cloud_common::Database>,
    body: web::Json<CreateDdosTestRequest>,
) -> Result<HttpResponse, SecurityError> {
    let request = body.into_inner();

    // Check if DDoS testing is enabled
    if !config.ddos.enabled {
        return Err(SecurityError::Forbidden(
            "DDoS testing is not enabled in this environment".to_string(),
        ));
    }

    // Validate authorization document
    if request.authorization_document_id.is_empty() {
        return Err(SecurityError::DdosNotAuthorized(
            "Authorization document ID is required for DDoS testing".to_string(),
        ));
    }

    if request.authorized_by.is_empty() {
        return Err(SecurityError::DdosNotAuthorized(
            "Authorizer identity is required for DDoS testing".to_string(),
        ));
    }

    // Enforce max duration
    let max_duration = config.ddos.max_duration_seconds;
    if request.duration_seconds > max_duration {
        return Err(SecurityError::MaxDurationExceeded {
            max_seconds: max_duration,
        });
    }

    tracing::warn!(
        target = %request.target,
        attack_type = %request.attack_type,
        duration = request.duration_seconds,
        authorized_by = %request.authorized_by,
        auth_doc = %request.authorization_document_id,
        "Creating DDoS test - AUTHORIZED"
    );

    let test = DdosTestResult {
        id: Uuid::new_v4(),
        target: request.target.clone(),
        attack_type: request.attack_type.clone(),
        status: DdosTestStatus::Pending,
        duration_seconds: request.duration_seconds,
        total_requests_sent: 0,
        successful_responses: 0,
        failed_responses: 0,
        avg_response_time_ms: 0.0,
        max_response_time_ms: 0.0,
        started_at: Utc::now(),
        completed_at: None,
        authorization_document_id: request.authorization_document_id.clone(),
        authorized_by: request.authorized_by.clone(),
    };

    let response_test = test.clone();

    // Create audit entry
    let audit_entry = AuditEntry {
        id: Uuid::new_v4(),
        test_id: test.id,
        action: "test_created".to_string(),
        performed_by: request.authorized_by.clone(),
        timestamp: Utc::now(),
        details: serde_json::json!({
            "target": request.target,
            "attack_type": request.attack_type,
            "duration_seconds": request.duration_seconds,
            "rate_limit": request.rate_limit,
            "authorization_document_id": request.authorization_document_id,
        }),
    };

    let test_id = test.id;
    let test_target = request.target.clone();
    let test_duration = request.duration_seconds;
    let test_rate = request.rate_limit;
    let test_id_str = test.id.to_string();
    let audit_id_str = audit_entry.id.to_string();

    let _ = db
        .create_with_id("ddos_tests", &test_id_str, test)
        .await
        .map_err(|e| SecurityError::Internal(format!("DB write error: {}", e)))?;
    let _ = db
        .create_with_id("security_audit_entries", &audit_id_str, audit_entry)
        .await
        .map_err(|e| SecurityError::Internal(format!("DB write error: {}", e)))?;

    // Spawn background load test execution
    let db_clone = db.get_ref().clone();
    tokio::spawn(async move {
        crate::scanner::execute_load_test_with_db(
            &db_clone,
            test_id,
            &test_target,
            test_duration,
            test_rate,
        )
        .await;
    });

    Ok(HttpResponse::Created().json(response_test))
}

/// POST /api/v1/security/ddos-tests/{id}/stop
///
/// Emergency kill switch to stop a running DDoS test immediately.
pub async fn stop_test(
    db: web::Data<cloud_common::Database>,
    path: web::Path<String>,
) -> Result<HttpResponse, SecurityError> {
    let test_id = path.into_inner();

    let id = Uuid::parse_str(&test_id)
        .map_err(|_| SecurityError::BadRequest(format!("Invalid test ID: {}", test_id)))?;

    tracing::warn!(test_id = %id, "KILL SWITCH: Stopping DDoS test immediately");

    let test: Option<DdosTestResult> = db
        .get("ddos_tests", &id.to_string())
        .await
        .unwrap_or(None);

    let mut test = test
        .ok_or_else(|| SecurityError::NotFound(format!("DDoS test {} not found", test_id)))?;

    test.status = DdosTestStatus::Stopped;
    test.completed_at = Some(Utc::now());

    let stopped_at = test.completed_at;

    let _ = db
        .update("ddos_tests", &id.to_string(), test)
        .await
        .map_err(|e| SecurityError::Internal(format!("DB update error: {}", e)))?;

    // Add audit entry
    let audit_entry = AuditEntry {
        id: Uuid::new_v4(),
        test_id: id,
        action: "test_stopped".to_string(),
        performed_by: "kill_switch".to_string(),
        timestamp: Utc::now(),
        details: serde_json::json!({
            "reason": "Manual kill switch activated",
            "stopped_at": stopped_at,
        }),
    };
    let audit_id_str = audit_entry.id.to_string();
    let _ = db
        .create_with_id("security_audit_entries", &audit_id_str, audit_entry)
        .await;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "test_id": id,
        "status": "stopped",
        "stopped_at": stopped_at,
        "message": "DDoS test stopped via kill switch",
    })))
}

/// GET /api/v1/security/ddos-tests/{id}
pub async fn get_results(
    db: web::Data<cloud_common::Database>,
    path: web::Path<String>,
) -> Result<HttpResponse, SecurityError> {
    let test_id = path.into_inner();

    let id = Uuid::parse_str(&test_id)
        .map_err(|_| SecurityError::BadRequest(format!("Invalid test ID: {}", test_id)))?;

    tracing::info!(test_id = %test_id, "Getting DDoS test results");

    let test: Option<DdosTestResult> = db
        .get("ddos_tests", &id.to_string())
        .await
        .unwrap_or(None);

    match test {
        Some(test) => Ok(HttpResponse::Ok().json(test)),
        None => Err(SecurityError::NotFound(format!(
            "DDoS test {} not found",
            test_id
        ))),
    }
}

/// GET /api/v1/security/ddos-tests/{id}/audit
///
/// Get the audit trail for a DDoS test.
pub async fn audit_trail(
    db: web::Data<cloud_common::Database>,
    path: web::Path<String>,
) -> Result<HttpResponse, SecurityError> {
    let test_id = path.into_inner();

    let id = Uuid::parse_str(&test_id)
        .map_err(|_| SecurityError::BadRequest(format!("Invalid test ID: {}", test_id)))?;

    tracing::info!(test_id = %id, "Getting DDoS test audit trail");

    // Verify the test exists
    let test: Option<DdosTestResult> = db
        .get("ddos_tests", &id.to_string())
        .await
        .unwrap_or(None);

    if test.is_none() {
        return Err(SecurityError::NotFound(format!(
            "DDoS test {} not found",
            test_id
        )));
    }

    let all_entries: Vec<AuditEntry> = db.list("security_audit_entries").await.unwrap_or_default();
    let entries: Vec<&AuditEntry> = all_entries
        .iter()
        .filter(|e| e.test_id == id)
        .collect();

    let total = entries.len();

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "test_id": id,
        "audit_entries": entries,
        "total": total,
    })))
}

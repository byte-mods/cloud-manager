use actix_web::{web, HttpResponse};
use chrono::Utc;
use uuid::Uuid;

use crate::error::SecurityError;
use crate::models::{CreateScanRequest, ScanListResponse, ScanStatus, SecurityScan};

/// POST /api/v1/security/scans
pub async fn create_scan(
    db: web::Data<cloud_common::Database>,
    body: web::Json<CreateScanRequest>,
) -> Result<HttpResponse, SecurityError> {
    let request = body.into_inner();

    tracing::info!(
        scan_type = %request.scan_type,
        target = %request.target,
        "Creating security scan"
    );

    let scan = SecurityScan {
        id: Uuid::new_v4(),
        scan_type: request.scan_type,
        target: request.target,
        status: ScanStatus::Pending,
        findings: vec![],
        started_at: Utc::now(),
        completed_at: None,
        created_by: "system".to_string(),
        metadata: request.parameters.unwrap_or(serde_json::json!({})),
    };

    let response_scan = scan.clone();
    let scan_id = scan.id;
    let scan_type_str = scan.scan_type.to_string();
    let scan_target = scan.target.clone();
    let id_str = scan.id.to_string();

    let _ = db
        .create_with_id("security_scans", &id_str, scan)
        .await
        .map_err(|e| SecurityError::Internal(format!("DB write error: {}", e)))?;

    // Spawn background scan execution
    let db_clone = db.get_ref().clone();
    tokio::spawn(async move {
        crate::scanner::execute_scan_with_db(&db_clone, scan_id, &scan_type_str, &scan_target)
            .await;
    });

    Ok(HttpResponse::Created().json(response_scan))
}

/// GET /api/v1/security/scans/{id}
pub async fn get_scan(
    db: web::Data<cloud_common::Database>,
    path: web::Path<String>,
) -> Result<HttpResponse, SecurityError> {
    let scan_id = path.into_inner();

    tracing::info!(scan_id = %scan_id, "Getting scan details");

    let id = Uuid::parse_str(&scan_id)
        .map_err(|_| SecurityError::BadRequest(format!("Invalid scan ID: {}", scan_id)))?;

    let scan: Option<SecurityScan> = db
        .get("security_scans", &id.to_string())
        .await
        .unwrap_or(None);

    match scan {
        Some(scan) => Ok(HttpResponse::Ok().json(scan)),
        None => Err(SecurityError::NotFound(format!("Scan {} not found", scan_id))),
    }
}

/// GET /api/v1/security/scans
pub async fn list_scans(
    db: web::Data<cloud_common::Database>,
) -> Result<HttpResponse, SecurityError> {
    tracing::info!("Listing security scans");

    let scans: Vec<SecurityScan> = db.list("security_scans").await.unwrap_or_default();
    let total = scans.len();

    let response = ScanListResponse { scans, total };

    Ok(HttpResponse::Ok().json(response))
}

/// GET /api/v1/security/scans/{id}/findings
pub async fn get_scan_findings(
    db: web::Data<cloud_common::Database>,
    path: web::Path<String>,
) -> Result<HttpResponse, SecurityError> {
    let scan_id = path.into_inner();

    tracing::info!(scan_id = %scan_id, "Getting scan findings");

    let id = Uuid::parse_str(&scan_id)
        .map_err(|_| SecurityError::BadRequest(format!("Invalid scan ID: {}", scan_id)))?;

    let scan: Option<SecurityScan> = db
        .get("security_scans", &id.to_string())
        .await
        .unwrap_or(None);

    match scan {
        Some(scan) => {
            let total = scan.findings.len();
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "scan_id": scan_id,
                "findings": scan.findings,
                "total": total,
            })))
        }
        None => Err(SecurityError::NotFound(format!("Scan {} not found", scan_id))),
    }
}

/// GET /api/v1/security/scans/{id}/status
///
/// Lightweight endpoint that returns only scan status and progress info.
pub async fn get_scan_status(
    db: web::Data<cloud_common::Database>,
    path: web::Path<String>,
) -> Result<HttpResponse, SecurityError> {
    let scan_id = path.into_inner();

    let id = Uuid::parse_str(&scan_id)
        .map_err(|_| SecurityError::BadRequest(format!("Invalid scan ID: {}", scan_id)))?;

    let scan: Option<SecurityScan> = db
        .get("security_scans", &id.to_string())
        .await
        .unwrap_or(None);

    match scan {
        Some(scan) => {
            let findings_count = scan.findings.len();
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "scan_id": scan.id,
                "status": scan.status,
                "scan_type": scan.scan_type,
                "target": scan.target,
                "findings_count": findings_count,
                "started_at": scan.started_at,
                "completed_at": scan.completed_at,
                "metadata": scan.metadata,
            })))
        }
        None => Err(SecurityError::NotFound(format!("Scan {} not found", scan_id))),
    }
}

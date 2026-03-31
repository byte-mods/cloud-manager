use actix_web::{web, HttpResponse};
use chrono::Utc;

use crate::error::SecurityError;
use crate::models::compliance::ComplianceAssessment;
use crate::models::{
    AssessFrameworkRequest, ComplianceFramework, ComplianceReportRequest,
};

/// POST /api/v1/security/compliance/assess
pub async fn assess_framework(
    db: web::Data<cloud_common::Database>,
    body: web::Json<AssessFrameworkRequest>,
) -> Result<HttpResponse, SecurityError> {
    let request = body.into_inner();

    let framework = ComplianceFramework::from_str(&request.framework).ok_or_else(|| {
        SecurityError::BadRequest(format!("Unknown compliance framework: {}", request.framework))
    })?;

    tracing::info!(framework = %framework, "Starting compliance assessment");

    // Look up existing assessment by normalizing the framework key
    let key = normalize_framework_key(&request.framework);
    let assessment: Option<ComplianceAssessment> = db
        .get("compliance_assessments", &key)
        .await
        .unwrap_or(None);

    match assessment {
        Some(assessment) => Ok(HttpResponse::Ok().json(assessment)),
        None => Err(SecurityError::NotFound(format!(
            "No assessment found for framework: {}",
            framework
        ))),
    }
}

/// GET /api/v1/security/compliance/{framework}
pub async fn get_assessment(
    db: web::Data<cloud_common::Database>,
    path: web::Path<String>,
) -> Result<HttpResponse, SecurityError> {
    let framework_str = path.into_inner();

    let framework = ComplianceFramework::from_str(&framework_str).ok_or_else(|| {
        SecurityError::BadRequest(format!("Unknown compliance framework: {}", framework_str))
    })?;

    tracing::info!(framework = %framework, "Getting compliance assessment");

    let key = normalize_framework_key(&framework_str);
    let assessment: Option<ComplianceAssessment> = db
        .get("compliance_assessments", &key)
        .await
        .unwrap_or(None);

    match assessment {
        Some(assessment) => Ok(HttpResponse::Ok().json(assessment)),
        None => Err(SecurityError::NotFound(format!(
            "No assessment found for framework: {}",
            framework
        ))),
    }
}

/// POST /api/v1/security/compliance/report
pub async fn generate_report(
    db: web::Data<cloud_common::Database>,
    body: web::Json<ComplianceReportRequest>,
) -> Result<HttpResponse, SecurityError> {
    let request = body.into_inner();

    let framework = ComplianceFramework::from_str(&request.framework).ok_or_else(|| {
        SecurityError::BadRequest(format!("Unknown compliance framework: {}", request.framework))
    })?;

    tracing::info!(
        framework = %framework,
        format = ?request.format,
        "Generating compliance report"
    );

    let key = normalize_framework_key(&request.framework);
    let assessment: Option<ComplianceAssessment> = db
        .get("compliance_assessments", &key)
        .await
        .unwrap_or(None);

    let score = assessment.as_ref().map(|a| a.score).unwrap_or(0.0);
    let total_controls = assessment.as_ref().map(|a| a.summary.total_controls).unwrap_or(0);
    let format = request.format.unwrap_or_else(|| "json".to_string());

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "framework": framework.to_string(),
        "format": format,
        "generated_at": Utc::now(),
        "status": "generated",
        "score": score,
        "total_controls": total_controls,
        "download_url": format!("/api/v1/security/compliance/reports/{}/{}", key, format),
        "include_evidence": request.include_evidence,
    })))
}

fn normalize_framework_key(s: &str) -> String {
    match s.to_lowercase().as_str() {
        "soc2" => "soc2".to_string(),
        "iso27001" => "iso27001".to_string(),
        "hipaa" => "hipaa".to_string(),
        "pci-dss-4" | "pci_dss_4" | "pcidss4" => "pci-dss-4".to_string(),
        "gdpr" => "gdpr".to_string(),
        "nist-csf" | "nist_csf" | "nistcsf" => "nist-csf".to_string(),
        "cis" => "cis".to_string(),
        other => other.to_string(),
    }
}

use std::sync::Arc;

use async_trait::async_trait;

use crate::handlers::vulnerability::{Vulnerability, VulnerabilityStatus, VulnerabilitySummary};
use crate::models::compliance::ComplianceAssessment;
use crate::models::scan::{Finding, SecurityScan, Severity};
use crate::traits::security::{
    CategoryScore, FindingsResponse, PostureScore, Result, SecurityProviderError,
    VulnerabilityResponse,
};
use crate::traits::SecurityProvider;

/// Mock security provider backed by SurrealDB.
/// Preserves full backward compatibility with the original handler behavior.
pub struct MockSecurityProvider {
    db: Arc<cloud_common::Database>,
}

impl MockSecurityProvider {
    pub fn new(db: Arc<cloud_common::Database>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl SecurityProvider for MockSecurityProvider {
    async fn list_findings(&self, severity: Option<&str>) -> Result<FindingsResponse> {
        let scans: Vec<SecurityScan> = self
            .db
            .list("security_scans")
            .await
            .map_err(|e| SecurityProviderError::Internal(format!("DB error: {e}")))?;

        let mut findings: Vec<Finding> = scans
            .into_iter()
            .flat_map(|scan| scan.findings)
            .collect();

        if let Some(sev) = severity {
            let target = match sev.to_lowercase().as_str() {
                "critical" => Some(Severity::Critical),
                "high" => Some(Severity::High),
                "medium" => Some(Severity::Medium),
                "low" => Some(Severity::Low),
                "info" => Some(Severity::Info),
                _ => None,
            };
            if let Some(target) = target {
                findings.retain(|f| f.severity == target);
            }
        }

        let total = findings.len();
        Ok(FindingsResponse { findings, total })
    }

    async fn get_compliance_status(&self, framework: &str) -> Result<ComplianceAssessment> {
        let key = normalize_framework_key(framework);

        let assessment: Option<ComplianceAssessment> = self
            .db
            .get("compliance_assessments", &key)
            .await
            .map_err(|e| SecurityProviderError::Internal(format!("DB error: {e}")))?;

        assessment.ok_or_else(|| {
            SecurityProviderError::NotFound(format!(
                "No assessment found for framework: {framework}"
            ))
        })
    }

    async fn get_vulnerabilities(
        &self,
        severity: Option<&str>,
        status: Option<&str>,
    ) -> Result<VulnerabilityResponse> {
        let all_vulns: Vec<Vulnerability> = self
            .db
            .list("vulnerabilities")
            .await
            .map_err(|e| SecurityProviderError::Internal(format!("DB error: {e}")))?;

        let mut filtered = all_vulns.clone();

        if let Some(sev) = severity {
            let target = match sev.to_lowercase().as_str() {
                "critical" => Some(Severity::Critical),
                "high" => Some(Severity::High),
                "medium" => Some(Severity::Medium),
                "low" => Some(Severity::Low),
                "info" => Some(Severity::Info),
                _ => None,
            };
            if let Some(target) = target {
                filtered.retain(|v| v.severity == target);
            }
        }

        if let Some(st) = status {
            let target = match st.to_lowercase().as_str() {
                "open" => Some(VulnerabilityStatus::Open),
                "in_progress" | "inprogress" => Some(VulnerabilityStatus::InProgress),
                "remediated" => Some(VulnerabilityStatus::Remediated),
                "accepted" => Some(VulnerabilityStatus::Accepted),
                "false_positive" | "falsepositive" => Some(VulnerabilityStatus::FalsePositive),
                _ => None,
            };
            if let Some(target) = target {
                filtered.retain(|v| v.status == target);
            }
        }

        let summary = VulnerabilitySummary {
            critical: all_vulns
                .iter()
                .filter(|v| v.severity == Severity::Critical)
                .count(),
            high: all_vulns
                .iter()
                .filter(|v| v.severity == Severity::High)
                .count(),
            medium: all_vulns
                .iter()
                .filter(|v| v.severity == Severity::Medium)
                .count(),
            low: all_vulns
                .iter()
                .filter(|v| v.severity == Severity::Low)
                .count(),
            info: all_vulns
                .iter()
                .filter(|v| v.severity == Severity::Info)
                .count(),
        };
        let total = filtered.len();

        Ok(VulnerabilityResponse {
            vulnerabilities: filtered,
            total,
            summary,
        })
    }

    async fn get_posture_score(&self) -> Result<PostureScore> {
        // Fetch compliance assessments by known keys
        let keys = ["soc2", "iso27001", "hipaa", "pci-dss-4", "gdpr", "nist-csf", "cis"];
        let mut compliance_scores = Vec::new();
        let mut soc2_score = 80.0_f64;
        let mut pci_score = 75.0_f64;
        let mut gdpr_score = 80.0_f64;
        let mut hipaa_score = 80.0_f64;

        for key in &keys {
            if let Ok(Some(assessment)) = self.db.get::<ComplianceAssessment>("compliance_assessments", key).await {
                compliance_scores.push(assessment.score);
                match *key {
                    "soc2" => soc2_score = assessment.score,
                    "pci-dss-4" => pci_score = assessment.score,
                    "gdpr" => gdpr_score = assessment.score,
                    "hipaa" => hipaa_score = assessment.score,
                    _ => {}
                }
            }
        }

        let avg = if compliance_scores.is_empty() {
            0.0
        } else {
            compliance_scores.iter().sum::<f64>() / compliance_scores.len() as f64
        };

        let vulnerabilities: Vec<Vulnerability> = self
            .db
            .list("vulnerabilities")
            .await
            .unwrap_or_default();

        let open_critical = vulnerabilities
            .iter()
            .filter(|v| {
                v.severity == Severity::Critical
                    && (v.status == VulnerabilityStatus::Open
                        || v.status == VulnerabilityStatus::InProgress)
            })
            .count();
        let open_high = vulnerabilities
            .iter()
            .filter(|v| {
                v.severity == Severity::High
                    && (v.status == VulnerabilityStatus::Open
                        || v.status == VulnerabilityStatus::InProgress)
            })
            .count();

        let penalty = (open_critical as f64 * 3.0) + (open_high as f64 * 1.5);
        let score = (avg - penalty).max(0.0).min(100.0);
        let score = (score * 10.0).round() / 10.0;

        Ok(PostureScore {
            overall_score: score,
            category_scores: vec![
                CategoryScore {
                    name: "Identity & Access".to_string(),
                    score: soc2_score,
                    findings_count: open_critical.min(2),
                },
                CategoryScore {
                    name: "Network Security".to_string(),
                    score: pci_score,
                    findings_count: open_high.min(3),
                },
                CategoryScore {
                    name: "Data Protection".to_string(),
                    score: (gdpr_score + hipaa_score) / 2.0,
                    findings_count: 0,
                },
            ],
        })
    }
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

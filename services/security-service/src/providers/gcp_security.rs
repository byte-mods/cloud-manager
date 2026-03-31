use std::sync::Arc;

use async_trait::async_trait;
use chrono::Utc;
use uuid::Uuid;

use cloud_common::CredentialManager;

use crate::handlers::vulnerability::{Vulnerability, VulnerabilityStatus, VulnerabilitySummary};
use crate::models::compliance::{
    AssessmentSummary, ComplianceAssessment, ComplianceControl, ComplianceFramework, ControlStatus,
};
use crate::models::scan::{Finding, FindingStatus, Severity};
use crate::traits::security::{
    CategoryScore, FindingsResponse, PostureScore, Result, SecurityProviderError,
    VulnerabilityResponse,
};
use crate::traits::SecurityProvider;

/// GCP Security provider using Security Command Center REST API.
///
/// This is a REST-based implementation; the GCP Security Command Center does not
/// yet have a published Rust SDK crate, so we call the REST endpoints directly.
pub struct GcpSecurityProvider {
    credentials: Arc<CredentialManager>,
    project_id: String,
    http_client: reqwest::Client,
}

impl GcpSecurityProvider {
    pub fn new(credentials: Arc<CredentialManager>, project_id: String) -> Self {
        Self {
            credentials,
            project_id,
            http_client: reqwest::Client::new(),
        }
    }

    /// Base URL for Security Command Center v1 API.
    fn scc_base_url(&self) -> String {
        format!(
            "https://securitycenter.googleapis.com/v1/projects/{}/sources/-/findings",
            self.project_id
        )
    }

    /// Get a bearer token from the credential manager.
    async fn bearer_token(&self) -> Result<String> {
        self.credentials
            .gcp_token(&["https://www.googleapis.com/auth/cloud-platform"])
            .await
            .map_err(|e| SecurityProviderError::AuthenticationFailed(e.to_string()))
    }

    /// Map GCP severity string to internal severity.
    fn map_severity(sev: &str) -> Severity {
        match sev.to_uppercase().as_str() {
            "CRITICAL" => Severity::Critical,
            "HIGH" => Severity::High,
            "MEDIUM" => Severity::Medium,
            "LOW" => Severity::Low,
            _ => Severity::Info,
        }
    }
}

#[async_trait]
impl SecurityProvider for GcpSecurityProvider {
    async fn list_findings(&self, severity: Option<&str>) -> Result<FindingsResponse> {
        let token = self.bearer_token().await?;

        let mut url = self.scc_base_url();
        if let Some(sev) = severity {
            url = format!("{}?filter=severity%3D%22{}%22", url, sev.to_uppercase());
        }

        let resp = self
            .http_client
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| SecurityProviderError::Gcp(format!("SCC list findings: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(SecurityProviderError::Gcp(format!(
                "SCC list findings failed ({status}): {body}"
            )));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| SecurityProviderError::Gcp(format!("SCC parse response: {e}")))?;

        let findings: Vec<Finding> = body
            .get("listFindingsResults")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| {
                        let finding = item.get("finding")?;
                        Some(Finding {
                            id: Uuid::new_v4(),
                            title: finding
                                .get("category")
                                .and_then(|v| v.as_str())
                                .unwrap_or("Unknown")
                                .to_string(),
                            severity: Self::map_severity(
                                finding
                                    .get("severity")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("LOW"),
                            ),
                            cvss_score: finding
                                .get("vulnerability")
                                .and_then(|v| v.get("cvssScore"))
                                .and_then(|v| v.as_f64())
                                .unwrap_or(0.0),
                            description: finding
                                .get("description")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            remediation: finding
                                .get("nextSteps")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            affected_resource: finding
                                .get("resourceName")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            category: finding
                                .get("category")
                                .and_then(|v| v.as_str())
                                .unwrap_or("General")
                                .to_string(),
                            status: match finding
                                .get("state")
                                .and_then(|v| v.as_str())
                                .unwrap_or("ACTIVE")
                            {
                                "INACTIVE" => FindingStatus::Remediated,
                                _ => FindingStatus::Open,
                            },
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        let total = findings.len();
        Ok(FindingsResponse { findings, total })
    }

    async fn get_compliance_status(&self, framework: &str) -> Result<ComplianceAssessment> {
        // GCP SCC doesn't directly map to compliance frameworks like AWS Security Hub.
        // Return a basic assessment based on active findings count.
        let findings = self.list_findings(None).await?;

        let total = findings.total;
        let open_count = findings
            .findings
            .iter()
            .filter(|f| f.status == FindingStatus::Open)
            .count();
        let passed = total.saturating_sub(open_count);

        let score = if total > 0 {
            (passed as f64 / total as f64) * 100.0
        } else {
            100.0
        };

        let fw = ComplianceFramework::from_str(framework).unwrap_or(ComplianceFramework::Cis);

        Ok(ComplianceAssessment {
            framework: fw,
            score: (score * 10.0).round() / 10.0,
            controls: vec![ComplianceControl {
                id: "gcp-scc-aggregate".to_string(),
                name: format!("GCP SCC aggregate for {framework}"),
                description: "Aggregated compliance score from GCP Security Command Center findings"
                    .to_string(),
                status: if score >= 80.0 {
                    ControlStatus::Pass
                } else if score >= 60.0 {
                    ControlStatus::Partial
                } else {
                    ControlStatus::Fail
                },
                evidence: Some(format!(
                    "{passed} of {total} findings are resolved"
                )),
                last_checked: Utc::now(),
            }],
            assessed_at: Utc::now(),
            summary: AssessmentSummary {
                total_controls: total,
                passed,
                failed: open_count,
                partial: 0,
                not_assessed: 0,
            },
        })
    }

    async fn get_vulnerabilities(
        &self,
        severity: Option<&str>,
        _status: Option<&str>,
    ) -> Result<VulnerabilityResponse> {
        // Map SCC findings that have vulnerability info
        let findings_resp = self.list_findings(severity).await?;

        let vulns: Vec<Vulnerability> = findings_resp
            .findings
            .into_iter()
            .map(|f| Vulnerability {
                id: f.id,
                cve_id: None,
                title: f.title,
                description: f.description,
                severity: f.severity,
                cvss_score: f.cvss_score,
                affected_resources: vec![f.affected_resource],
                remediation: f.remediation,
                patch_available: false,
                discovered_at: Utc::now(),
                status: match f.status {
                    FindingStatus::Open => VulnerabilityStatus::Open,
                    FindingStatus::Remediated => VulnerabilityStatus::Remediated,
                    FindingStatus::Accepted => VulnerabilityStatus::Accepted,
                    _ => VulnerabilityStatus::Open,
                },
            })
            .collect();

        let summary = VulnerabilitySummary {
            critical: vulns.iter().filter(|v| v.severity == Severity::Critical).count(),
            high: vulns.iter().filter(|v| v.severity == Severity::High).count(),
            medium: vulns.iter().filter(|v| v.severity == Severity::Medium).count(),
            low: vulns.iter().filter(|v| v.severity == Severity::Low).count(),
            info: vulns.iter().filter(|v| v.severity == Severity::Info).count(),
        };
        let total = vulns.len();

        Ok(VulnerabilityResponse {
            vulnerabilities: vulns,
            total,
            summary,
        })
    }

    async fn get_posture_score(&self) -> Result<PostureScore> {
        let findings = self.list_findings(None).await?;
        let total = findings.total;
        let open = findings
            .findings
            .iter()
            .filter(|f| f.status == FindingStatus::Open)
            .count();

        let score = if total > 0 {
            ((total - open) as f64 / total as f64) * 100.0
        } else {
            100.0
        };

        Ok(PostureScore {
            overall_score: (score * 10.0).round() / 10.0,
            category_scores: vec![
                CategoryScore {
                    name: "GCP Security".to_string(),
                    score: (score * 10.0).round() / 10.0,
                    findings_count: total,
                },
            ],
        })
    }
}

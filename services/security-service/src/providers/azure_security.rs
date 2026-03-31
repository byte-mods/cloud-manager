use std::sync::Arc;

use async_trait::async_trait;
use azure_core::credentials::TokenCredential;
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

/// Azure Security provider using Microsoft Defender for Cloud / Security Center REST API.
///
/// Uses the Azure REST API since there is no first-party Rust SDK for Defender.
pub struct AzureSecurityProvider {
    credentials: Arc<CredentialManager>,
    subscription_id: String,
    http_client: reqwest::Client,
}

impl AzureSecurityProvider {
    pub fn new(credentials: Arc<CredentialManager>, subscription_id: String) -> Self {
        Self {
            credentials,
            subscription_id,
            http_client: reqwest::Client::new(),
        }
    }

    /// Defender for Cloud assessments endpoint.
    fn assessments_url(&self) -> String {
        format!(
            "https://management.azure.com/subscriptions/{}/providers/Microsoft.Security/assessments?api-version=2021-06-01",
            self.subscription_id
        )
    }

    /// Defender for Cloud alerts endpoint.
    fn alerts_url(&self) -> String {
        format!(
            "https://management.azure.com/subscriptions/{}/providers/Microsoft.Security/alerts?api-version=2022-01-01",
            self.subscription_id
        )
    }

    /// Get an Azure bearer token via the credential manager.
    async fn bearer_token(&self) -> Result<String> {
        let cred = self
            .credentials
            .azure_credential()
            .map_err(|e| SecurityProviderError::AuthenticationFailed(e.to_string()))?;

        let token_response = cred
            .get_token(&["https://management.azure.com/.default"])
            .await
            .map_err(|e| {
                SecurityProviderError::AuthenticationFailed(format!("Azure token: {e}"))
            })?;

        Ok(token_response.token.secret().to_string())
    }

    fn map_severity(sev: &str) -> Severity {
        match sev.to_lowercase().as_str() {
            "high" => Severity::High,
            "medium" => Severity::Medium,
            "low" => Severity::Low,
            _ => Severity::Info,
        }
    }
}

#[async_trait]
impl SecurityProvider for AzureSecurityProvider {
    async fn list_findings(&self, severity: Option<&str>) -> Result<FindingsResponse> {
        let token = self.bearer_token().await?;

        let resp = self
            .http_client
            .get(&self.alerts_url())
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| SecurityProviderError::Azure(format!("Defender alerts: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(SecurityProviderError::Azure(format!(
                "Defender alerts failed ({status}): {body}"
            )));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| SecurityProviderError::Azure(format!("Parse alerts: {e}")))?;

        let mut findings: Vec<Finding> = body
            .get("value")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| {
                        let props = item.get("properties")?;
                        Some(Finding {
                            id: Uuid::new_v4(),
                            title: props
                                .get("alertDisplayName")
                                .and_then(|v| v.as_str())
                                .unwrap_or("Unknown alert")
                                .to_string(),
                            severity: Self::map_severity(
                                props
                                    .get("severity")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("Low"),
                            ),
                            cvss_score: 0.0,
                            description: props
                                .get("description")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            remediation: props
                                .get("remediationSteps")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            affected_resource: props
                                .get("compromisedEntity")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            category: props
                                .get("alertType")
                                .and_then(|v| v.as_str())
                                .unwrap_or("General")
                                .to_string(),
                            status: match props
                                .get("status")
                                .and_then(|v| v.as_str())
                                .unwrap_or("Active")
                            {
                                "Resolved" | "Dismissed" => FindingStatus::Remediated,
                                _ => FindingStatus::Open,
                            },
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        // Filter by severity if provided
        if let Some(sev) = severity {
            let target = Self::map_severity(sev);
            findings.retain(|f| f.severity == target);
        }

        let total = findings.len();
        Ok(FindingsResponse { findings, total })
    }

    async fn get_compliance_status(&self, framework: &str) -> Result<ComplianceAssessment> {
        let token = self.bearer_token().await?;

        let resp = self
            .http_client
            .get(&self.assessments_url())
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| SecurityProviderError::Azure(format!("Defender assessments: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(SecurityProviderError::Azure(format!(
                "Defender assessments failed ({status}): {body}"
            )));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| SecurityProviderError::Azure(format!("Parse assessments: {e}")))?;

        let assessments = body
            .get("value")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let total = assessments.len();
        let mut passed = 0usize;
        let mut failed = 0usize;

        let controls: Vec<ComplianceControl> = assessments
            .iter()
            .filter_map(|item| {
                let props = item.get("properties")?;
                let code = props
                    .get("status")
                    .and_then(|s| s.get("code"))
                    .and_then(|c| c.as_str())
                    .unwrap_or("NotApplicable");

                let status = match code {
                    "Healthy" => {
                        passed += 1;
                        ControlStatus::Pass
                    }
                    "Unhealthy" => {
                        failed += 1;
                        ControlStatus::Fail
                    }
                    _ => ControlStatus::NotAssessed,
                };

                Some(ComplianceControl {
                    id: item
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string(),
                    name: props
                        .get("displayName")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Unknown")
                        .to_string(),
                    description: props
                        .get("description")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    status,
                    evidence: None,
                    last_checked: Utc::now(),
                })
            })
            .collect();

        let score = if total > 0 {
            (passed as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        let fw = ComplianceFramework::from_str(framework).unwrap_or(ComplianceFramework::Cis);
        let not_assessed = total.saturating_sub(passed + failed);

        Ok(ComplianceAssessment {
            framework: fw,
            score: (score * 10.0).round() / 10.0,
            controls,
            assessed_at: Utc::now(),
            summary: AssessmentSummary {
                total_controls: total,
                passed,
                failed,
                partial: 0,
                not_assessed,
            },
        })
    }

    async fn get_vulnerabilities(
        &self,
        severity: Option<&str>,
        _status: Option<&str>,
    ) -> Result<VulnerabilityResponse> {
        // Map Defender alerts to vulnerability format
        let findings = self.list_findings(severity).await?;

        let vulns: Vec<Vulnerability> = findings
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
        // Use Defender Secure Score
        let token = self.bearer_token().await?;

        let url = format!(
            "https://management.azure.com/subscriptions/{}/providers/Microsoft.Security/secureScores/ascScore?api-version=2020-01-01",
            self.subscription_id
        );

        let resp = self
            .http_client
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| SecurityProviderError::Azure(format!("Secure Score: {e}")))?;

        if !resp.status().is_success() {
            // Fallback: compute from findings
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
            return Ok(PostureScore {
                overall_score: (score * 10.0).round() / 10.0,
                category_scores: vec![CategoryScore {
                    name: "Azure Security".to_string(),
                    score: (score * 10.0).round() / 10.0,
                    findings_count: total,
                }],
            });
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| SecurityProviderError::Azure(format!("Parse secure score: {e}")))?;

        let score = body
            .get("properties")
            .and_then(|p| p.get("score"))
            .and_then(|s| s.get("percentage"))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0)
            * 100.0;

        Ok(PostureScore {
            overall_score: (score * 10.0).round() / 10.0,
            category_scores: vec![CategoryScore {
                name: "Azure Defender".to_string(),
                score: (score * 10.0).round() / 10.0,
                findings_count: 0,
            }],
        })
    }
}

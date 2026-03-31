use std::sync::Arc;

use async_trait::async_trait;
use aws_sdk_guardduty as guardduty;
use aws_sdk_inspector2 as inspector2;
use aws_sdk_securityhub as securityhub;
use chrono::Utc;
use uuid::Uuid;

use cloud_common::{cache::ttl, CredentialManager, RedisCache};

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

/// AWS Security provider that calls Security Hub, GuardDuty, and Inspector2.
pub struct AwsSecurityProvider {
    credentials: Arc<CredentialManager>,
    cache: Option<Arc<RedisCache>>,
}

impl AwsSecurityProvider {
    pub fn new(credentials: Arc<CredentialManager>, cache: Option<Arc<RedisCache>>) -> Self {
        Self { credentials, cache }
    }

    // ----------------------------------------------------------------
    // Internal helpers to construct SDK clients
    // ----------------------------------------------------------------

    fn securityhub_client(&self) -> Result<securityhub::Client> {
        let cfg = self
            .credentials
            .aws_config()
            .map_err(|e| SecurityProviderError::AuthenticationFailed(e.to_string()))?;
        Ok(securityhub::Client::new(cfg))
    }

    fn guardduty_client(&self) -> Result<guardduty::Client> {
        let cfg = self
            .credentials
            .aws_config()
            .map_err(|e| SecurityProviderError::AuthenticationFailed(e.to_string()))?;
        Ok(guardduty::Client::new(cfg))
    }

    fn inspector_client(&self) -> Result<inspector2::Client> {
        let cfg = self
            .credentials
            .aws_config()
            .map_err(|e| SecurityProviderError::AuthenticationFailed(e.to_string()))?;
        Ok(inspector2::Client::new(cfg))
    }

    // ----------------------------------------------------------------
    // Mapping helpers
    // ----------------------------------------------------------------

    fn map_severity(label: &str) -> Severity {
        match label.to_uppercase().as_str() {
            "CRITICAL" => Severity::Critical,
            "HIGH" => Severity::High,
            "MEDIUM" => Severity::Medium,
            "LOW" => Severity::Low,
            _ => Severity::Info,
        }
    }

    fn map_finding_status(status: &str) -> FindingStatus {
        match status.to_uppercase().as_str() {
            "RESOLVED" => FindingStatus::Remediated,
            "SUPPRESSED" => FindingStatus::Accepted,
            _ => FindingStatus::Open,
        }
    }

    fn map_vuln_status(status: &str) -> VulnerabilityStatus {
        match status.to_uppercase().as_str() {
            "CLOSED" | "RESOLVED" => VulnerabilityStatus::Remediated,
            "SUPPRESSED" => VulnerabilityStatus::Accepted,
            "ACTIVE" => VulnerabilityStatus::Open,
            _ => VulnerabilityStatus::Open,
        }
    }

    fn severity_filter(
        severity: Option<&str>,
    ) -> Option<securityhub::types::StringFilter> {
        severity.map(|s| {
            securityhub::types::StringFilter::builder()
                .value(s.to_uppercase())
                .comparison(securityhub::types::StringFilterComparison::Equals)
                .build()
        })
    }

    // ----------------------------------------------------------------
    // Real SDK calls
    // ----------------------------------------------------------------

    async fn fetch_securityhub_findings(
        &self,
        severity: Option<&str>,
    ) -> Result<Vec<Finding>> {
        let client = self.securityhub_client()?;

        let mut filters_builder = securityhub::types::AwsSecurityFindingFilters::builder();

        if let Some(filter) = Self::severity_filter(severity) {
            filters_builder = filters_builder.severity_label(filter);
        }

        let filters = filters_builder.build();

        let resp = client
            .get_findings()
            .filters(filters)
            .max_results(100)
            .send()
            .await
            .map_err(|e| SecurityProviderError::Aws(format!("SecurityHub GetFindings: {e}")))?;

        let findings = resp
            .findings()
            .iter()
            .map(|f| {
                let sev_label = f
                    .severity()
                    .and_then(|s| s.label())
                    .map(|l| l.as_str())
                    .unwrap_or("INFORMATIONAL");

                let cvss = f
                    .severity()
                    .and_then(|s| s.normalized())
                    .map(|n| n as f64 / 10.0)
                    .unwrap_or(0.0);

                let status_str = f
                    .workflow()
                    .and_then(|w| w.status())
                    .map(|s| s.as_str())
                    .unwrap_or("NEW");

                let resource_ids: Vec<String> = f
                    .resources()
                    .iter()
                    .filter_map(|r| r.id().map(|s| s.to_string()))
                    .collect();

                Finding {
                    id: Uuid::new_v4(),
                    title: f.title().unwrap_or("Untitled").to_string(),
                    severity: Self::map_severity(sev_label),
                    cvss_score: cvss.min(10.0),
                    description: f.description().unwrap_or("").to_string(),
                    remediation: f
                        .remediation()
                        .and_then(|r| r.recommendation())
                        .and_then(|rec| rec.text())
                        .unwrap_or("")
                        .to_string(),
                    affected_resource: resource_ids.first().cloned().unwrap_or_default(),
                    category: f
                        .types()
                        .first()
                        .cloned()
                        .unwrap_or_else(|| "General".to_string()),
                    status: Self::map_finding_status(status_str),
                }
            })
            .collect();

        Ok(findings)
    }

    async fn fetch_guardduty_findings(
        &self,
        severity: Option<&str>,
    ) -> Result<Vec<Finding>> {
        let client = self.guardduty_client()?;

        // First, list detector IDs
        let detectors_resp = client
            .list_detectors()
            .send()
            .await
            .map_err(|e| SecurityProviderError::Aws(format!("GuardDuty ListDetectors: {e}")))?;

        let detector_ids = detectors_resp.detector_ids();
        if detector_ids.is_empty() {
            return Ok(vec![]);
        }

        let detector_id = &detector_ids[0];

        // Build finding criteria based on severity
        let mut criteria_map = std::collections::HashMap::new();
        if let Some(sev) = severity {
            // GuardDuty severity is numeric: Low=1-3.9, Medium=4-6.9, High=7-8.9, Critical=9-10
            let (gte, lte): (i64, i64) = match sev.to_lowercase().as_str() {
                "critical" => (9, 10),
                "high" => (7, 9),
                "medium" => (4, 7),
                "low" => (1, 4),
                _ => (0, 10),
            };
            criteria_map.insert(
                "severity".to_string(),
                guardduty::types::Condition::builder()
                    .greater_than_or_equal(gte)
                    .less_than_or_equal(lte)
                    .build(),
            );
        }

        let criteria = guardduty::types::FindingCriteria::builder()
            .set_criterion(Some(criteria_map))
            .build();

        // List finding IDs
        let list_resp = client
            .list_findings()
            .detector_id(detector_id)
            .finding_criteria(criteria)
            .max_results(50)
            .send()
            .await
            .map_err(|e| SecurityProviderError::Aws(format!("GuardDuty ListFindings: {e}")))?;

        let finding_ids = list_resp.finding_ids();
        if finding_ids.is_empty() {
            return Ok(vec![]);
        }

        // Get full finding details
        let get_resp = client
            .get_findings()
            .detector_id(detector_id)
            .set_finding_ids(Some(finding_ids.to_vec()))
            .send()
            .await
            .map_err(|e| SecurityProviderError::Aws(format!("GuardDuty GetFindings: {e}")))?;

        let findings = get_resp
            .findings()
            .iter()
            .map(|f| {
                let sev_val = f.severity().unwrap_or(0.0);
                let severity = if sev_val >= 9.0 {
                    Severity::Critical
                } else if sev_val >= 7.0 {
                    Severity::High
                } else if sev_val >= 4.0 {
                    Severity::Medium
                } else if sev_val >= 1.0 {
                    Severity::Low
                } else {
                    Severity::Info
                };

                let resource_str = f
                    .resource()
                    .and_then(|r| r.instance_details())
                    .and_then(|d| d.instance_id())
                    .unwrap_or("unknown")
                    .to_string();

                Finding {
                    id: Uuid::new_v4(),
                    title: f.title().unwrap_or("GuardDuty Finding").to_string(),
                    severity,
                    cvss_score: sev_val,
                    description: f.description().unwrap_or("").to_string(),
                    remediation: format!(
                        "Review GuardDuty finding type: {}",
                        f.r#type().unwrap_or("unknown")
                    ),
                    affected_resource: resource_str,
                    category: f.r#type().unwrap_or("Threat Detection").to_string(),
                    status: if f.service()
                        .and_then(|s| s.archived())
                        == Some(true)
                    {
                        FindingStatus::Remediated
                    } else {
                        FindingStatus::Open
                    },
                }
            })
            .collect();

        Ok(findings)
    }

    async fn fetch_inspector_vulnerabilities(
        &self,
        severity: Option<&str>,
        status: Option<&str>,
    ) -> Result<Vec<Vulnerability>> {
        let client = self.inspector_client()?;

        let mut filter_builder = inspector2::types::FilterCriteria::builder();

        if let Some(sev) = severity {
            if let Ok(sf) = inspector2::types::StringFilter::builder()
                .value(sev.to_uppercase())
                .comparison(inspector2::types::StringComparison::Equals)
                .build()
            {
                filter_builder = filter_builder.severity(sf);
            }
        }

        if let Some(st) = status {
            if let Ok(sf) = inspector2::types::StringFilter::builder()
                .value(st.to_uppercase())
                .comparison(inspector2::types::StringComparison::Equals)
                .build()
            {
                filter_builder = filter_builder.finding_status(sf);
            }
        }

        let filter_criteria = filter_builder.build();

        let resp = client
            .list_findings()
            .filter_criteria(filter_criteria)
            .max_results(100)
            .send()
            .await
            .map_err(|e| SecurityProviderError::Aws(format!("Inspector2 ListFindings: {e}")))?;

        let vulns = resp
            .findings()
            .iter()
            .map(|f| {
                let sev_str = f.severity().as_str();
                let status_str = f.status().as_str();

                let cvss = f.inspector_score().unwrap_or(0.0);

                let affected: Vec<String> = f
                    .resources()
                    .iter()
                    .map(|r| r.id().to_string())
                    .collect();

                let title_str = f.title().unwrap_or("Untitled");
                let cve_id = if title_str.starts_with("CVE-") {
                    Some(
                        title_str
                            .split_whitespace()
                            .next()
                            .unwrap_or(title_str)
                            .to_string(),
                    )
                } else {
                    None
                };

                Vulnerability {
                    id: Uuid::new_v4(),
                    cve_id,
                    title: title_str.to_string(),
                    description: f.description().to_string(),
                    severity: Self::map_severity(sev_str),
                    cvss_score: cvss,
                    affected_resources: affected,
                    remediation: f
                        .remediation()
                        .and_then(|r| r.recommendation())
                        .and_then(|rec| rec.text())
                        .unwrap_or("")
                        .to_string(),
                    patch_available: f
                        .fix_available()
                        .map(|fa| fa.as_str() == "YES")
                        .unwrap_or(false),
                    discovered_at: Utc::now(),
                    status: Self::map_vuln_status(status_str),
                }
            })
            .collect();

        Ok(vulns)
    }
}

#[async_trait]
impl SecurityProvider for AwsSecurityProvider {
    async fn list_findings(&self, severity: Option<&str>) -> Result<FindingsResponse> {
        // Try cache first
        if let Some(cache) = &self.cache {
            let cache_key = format!("findings:{}", severity.unwrap_or("all"));
            let parts: Vec<&str> = vec!["security", "aws", &cache_key];
            let sev = severity.map(|s| s.to_string());
            match cache
                .get_or_fetch(&parts, ttl::SECURITY_FINDINGS, || async {
                    let findings = self
                        .fetch_securityhub_findings(sev.as_deref())
                        .await
                        .map_err(|e| cloud_common::CloudSdkError::Aws(e.to_string()))?;
                    let total = findings.len();
                    Ok(FindingsResponse { findings, total })
                })
                .await
            {
                Ok(resp) => return Ok(resp),
                Err(e) => {
                    tracing::warn!("Cache fetch failed, calling API directly: {e}");
                }
            }
        }

        // Combine SecurityHub + GuardDuty findings
        let mut findings = self.fetch_securityhub_findings(severity).await?;

        match self.fetch_guardduty_findings(severity).await {
            Ok(gd_findings) => findings.extend(gd_findings),
            Err(e) => tracing::warn!("GuardDuty fetch failed (continuing with SecurityHub only): {e}"),
        }

        let total = findings.len();
        Ok(FindingsResponse { findings, total })
    }

    async fn get_compliance_status(&self, framework: &str) -> Result<ComplianceAssessment> {
        // Fetch Security Hub compliance standards results
        let client = self.securityhub_client()?;

        // Use standards subscription ARN pattern based on framework
        let framework_lower = framework.to_lowercase();
        let standard_keyword = match framework_lower.as_str() {
            "cis" => "cis-aws",
            "pci-dss-4" | "pci_dss_4" | "pcidss4" => "pci-dss",
            "nist-csf" | "nist_csf" | "nistcsf" => "nist",
            "soc2" => "soc2",
            other => other,
        };

        // Fetch findings scoped to the compliance standard type
        let filters = securityhub::types::AwsSecurityFindingFilters::builder()
            .r#type(
                securityhub::types::StringFilter::builder()
                    .value(format!("Software and Configuration Checks/{standard_keyword}"))
                    .comparison(securityhub::types::StringFilterComparison::Prefix)
                    .build(),
            )
            .build();

        let resp = client
            .get_findings()
            .filters(filters)
            .max_results(100)
            .send()
            .await
            .map_err(|e| {
                SecurityProviderError::Aws(format!("SecurityHub compliance findings: {e}"))
            })?;

        let total = resp.findings().len();
        let mut passed = 0usize;
        let mut failed = 0usize;
        let mut not_assessed = 0usize;

        let controls: Vec<ComplianceControl> = resp
            .findings()
            .iter()
            .map(|f| {
                let ctrl_status = f
                    .compliance()
                    .and_then(|c| c.status())
                    .map(|s| s.as_str())
                    .unwrap_or("NOT_AVAILABLE");

                let status = match ctrl_status {
                    "PASSED" => {
                        passed += 1;
                        ControlStatus::Pass
                    }
                    "FAILED" => {
                        failed += 1;
                        ControlStatus::Fail
                    }
                    "WARNING" => {
                        failed += 1;
                        ControlStatus::Partial
                    }
                    _ => {
                        not_assessed += 1;
                        ControlStatus::NotAssessed
                    }
                };

                ComplianceControl {
                    id: f
                        .compliance()
                        .and_then(|c| {
                            c.associated_standards()
                                .first()
                                .and_then(|s| s.standards_id())
                                .map(|s| s.to_string())
                        })
                        .unwrap_or_else(|| Uuid::new_v4().to_string()),
                    name: f.title().unwrap_or("Unknown control").to_string(),
                    description: f.description().unwrap_or("").to_string(),
                    status,
                    evidence: f
                        .compliance()
                        .and_then(|c| {
                            c.status_reasons()
                                .first()
                                .and_then(|r| r.description())
                                .map(|d| d.to_string())
                        }),
                    last_checked: Utc::now(),
                }
            })
            .collect();

        let score = if total > 0 {
            (passed as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        let fw = ComplianceFramework::from_str(framework)
            .unwrap_or(ComplianceFramework::Cis);

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
        status: Option<&str>,
    ) -> Result<VulnerabilityResponse> {
        let vulns = self.fetch_inspector_vulnerabilities(severity, status).await?;

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
        // Aggregate scores from Security Hub standards compliance
        let client = self.securityhub_client()?;

        // Fetch overall compliance status for enabled standards
        let resp = client
            .get_findings()
            .filters(
                securityhub::types::AwsSecurityFindingFilters::builder()
                    .record_state(
                        securityhub::types::StringFilter::builder()
                            .value("ACTIVE")
                            .comparison(securityhub::types::StringFilterComparison::Equals)
                            .build(),
                    )
                    .build(),
            )
            .max_results(100)
            .send()
            .await
            .map_err(|e| SecurityProviderError::Aws(format!("SecurityHub posture: {e}")))?;

        let total = resp.findings().len();
        let passed = resp
            .findings()
            .iter()
            .filter(|f| {
                f.compliance()
                    .and_then(|c| c.status())
                    .map(|s| s.as_str() == "PASSED")
                    .unwrap_or(false)
            })
            .count();

        let overall_score = if total > 0 {
            (passed as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        // Build category scores from finding types
        let mut iam_total = 0usize;
        let mut iam_passed = 0usize;
        let mut network_total = 0usize;
        let mut network_passed = 0usize;
        let mut data_total = 0usize;
        let mut data_passed = 0usize;

        for f in resp.findings() {
            let category = f.types().first().cloned().unwrap_or_default();
            let is_passed = f
                .compliance()
                .and_then(|c| c.status())
                .map(|s| s.as_str() == "PASSED")
                .unwrap_or(false);

            if category.contains("IAM") || category.contains("Identity") {
                iam_total += 1;
                if is_passed {
                    iam_passed += 1;
                }
            } else if category.contains("Network") || category.contains("Firewall") {
                network_total += 1;
                if is_passed {
                    network_passed += 1;
                }
            } else {
                data_total += 1;
                if is_passed {
                    data_passed += 1;
                }
            }
        }

        let score_or = |p: usize, t: usize| -> f64 {
            if t > 0 {
                (p as f64 / t as f64) * 100.0
            } else {
                0.0
            }
        };

        Ok(PostureScore {
            overall_score: (overall_score * 10.0).round() / 10.0,
            category_scores: vec![
                CategoryScore {
                    name: "Identity & Access".to_string(),
                    score: (score_or(iam_passed, iam_total) * 10.0).round() / 10.0,
                    findings_count: iam_total,
                },
                CategoryScore {
                    name: "Network Security".to_string(),
                    score: (score_or(network_passed, network_total) * 10.0).round() / 10.0,
                    findings_count: network_total,
                },
                CategoryScore {
                    name: "Data Protection".to_string(),
                    score: (score_or(data_passed, data_total) * 10.0).round() / 10.0,
                    findings_count: data_total,
                },
            ],
        })
    }
}

use async_trait::async_trait;

use crate::handlers::vulnerability::{Vulnerability, VulnerabilitySummary};
use crate::models::compliance::ComplianceAssessment;
use crate::models::posture::SecurityPosture;
use crate::models::scan::Finding;

/// Result type for security provider operations.
pub type Result<T> = std::result::Result<T, SecurityProviderError>;

/// Error type for security provider operations.
#[derive(Debug, thiserror::Error)]
pub enum SecurityProviderError {
    #[error("AWS SDK error: {0}")]
    Aws(String),

    #[error("GCP API error: {0}")]
    Gcp(String),

    #[error("Azure API error: {0}")]
    Azure(String),

    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

/// Aggregated findings response from a security provider.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FindingsResponse {
    pub findings: Vec<Finding>,
    pub total: usize,
}

/// Aggregated vulnerability response from a security provider.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VulnerabilityResponse {
    pub vulnerabilities: Vec<Vulnerability>,
    pub total: usize,
    pub summary: VulnerabilitySummary,
}

/// Posture score from a security provider.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PostureScore {
    pub overall_score: f64,
    pub category_scores: Vec<CategoryScore>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CategoryScore {
    pub name: String,
    pub score: f64,
    pub findings_count: usize,
}

/// Trait for cloud security providers (AWS Security Hub, GCP SCC, Azure Defender).
///
/// Each provider implements this trait to provide security findings, compliance
/// assessments, vulnerability data, and posture scores from their respective
/// cloud security services.
#[async_trait]
pub trait SecurityProvider: Send + Sync {
    /// List security findings, optionally filtered by severity.
    async fn list_findings(&self, severity: Option<&str>) -> Result<FindingsResponse>;

    /// Get compliance assessment for a given framework.
    async fn get_compliance_status(&self, framework: &str) -> Result<ComplianceAssessment>;

    /// List vulnerabilities, optionally filtered by severity and status.
    async fn get_vulnerabilities(
        &self,
        severity: Option<&str>,
        status: Option<&str>,
    ) -> Result<VulnerabilityResponse>;

    /// Get overall security posture score.
    async fn get_posture_score(&self) -> Result<PostureScore>;
}

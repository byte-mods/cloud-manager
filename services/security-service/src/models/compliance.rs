use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceAssessment {
    pub framework: ComplianceFramework,
    pub score: f64,
    pub controls: Vec<ComplianceControl>,
    pub assessed_at: DateTime<Utc>,
    pub summary: AssessmentSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceControl {
    pub id: String,
    pub name: String,
    pub description: String,
    pub status: ControlStatus,
    pub evidence: Option<String>,
    pub last_checked: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssessmentSummary {
    pub total_controls: usize,
    pub passed: usize,
    pub failed: usize,
    pub partial: usize,
    pub not_assessed: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ComplianceFramework {
    Soc2,
    Iso27001,
    Hipaa,
    PciDss4,
    Gdpr,
    NistCsf,
    Cis,
}

impl ComplianceFramework {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "soc2" => Some(Self::Soc2),
            "iso27001" => Some(Self::Iso27001),
            "hipaa" => Some(Self::Hipaa),
            "pci-dss-4" | "pci_dss_4" | "pcidss4" => Some(Self::PciDss4),
            "gdpr" => Some(Self::Gdpr),
            "nist-csf" | "nist_csf" | "nistcsf" => Some(Self::NistCsf),
            "cis" => Some(Self::Cis),
            _ => None,
        }
    }
}

impl std::fmt::Display for ComplianceFramework {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ComplianceFramework::Soc2 => write!(f, "SOC 2"),
            ComplianceFramework::Iso27001 => write!(f, "ISO 27001"),
            ComplianceFramework::Hipaa => write!(f, "HIPAA"),
            ComplianceFramework::PciDss4 => write!(f, "PCI DSS 4.0"),
            ComplianceFramework::Gdpr => write!(f, "GDPR"),
            ComplianceFramework::NistCsf => write!(f, "NIST CSF"),
            ComplianceFramework::Cis => write!(f, "CIS"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ControlStatus {
    Pass,
    Fail,
    Partial,
    NotAssessed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssessFrameworkRequest {
    pub framework: String,
    pub scope: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceReportRequest {
    pub framework: String,
    pub format: Option<String>,
    pub include_evidence: bool,
}

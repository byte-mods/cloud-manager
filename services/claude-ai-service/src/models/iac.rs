use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IacRequest {
    pub description: String,
    pub provider: String,
    pub format: IacFormat,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum IacFormat {
    Terraform,
    CloudFormation,
    Pulumi,
    Bicep,
}

impl std::fmt::Display for IacFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IacFormat::Terraform => write!(f, "Terraform"),
            IacFormat::CloudFormation => write!(f, "CloudFormation"),
            IacFormat::Pulumi => write!(f, "Pulumi"),
            IacFormat::Bicep => write!(f, "Bicep"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IacResponse {
    pub code: String,
    pub format: IacFormat,
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyRequest {
    pub description: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyResponse {
    pub policy: String,
    pub explanation: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostRecommendationRequest {
    pub cost_data: serde_json::Value,
    pub provider: Option<String>,
    pub timeframe: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostRecommendationResponse {
    pub recommendations: Vec<String>,
    pub estimated_savings: Option<f64>,
    pub analysis: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityRemediationRequest {
    pub finding: serde_json::Value,
    pub provider: Option<String>,
    pub resource_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityRemediationResponse {
    pub remediation_steps: Vec<String>,
    pub code_fix: Option<String>,
    pub explanation: String,
    pub severity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryAssistantRequest {
    pub query: String,
    pub context: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryAssistantResponse {
    pub answer: String,
    pub sources: Vec<String>,
}

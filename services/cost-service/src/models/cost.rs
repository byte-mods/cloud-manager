use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostOverview {
    pub total_cost: f64,
    pub cost_by_provider: HashMap<String, f64>,
    pub cost_by_service: Vec<ServiceCost>,
    pub trend: Vec<DailyCost>,
    pub month_over_month_change: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceCost {
    pub service: String,
    pub provider: String,
    pub cost: f64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyCost {
    pub date: NaiveDate,
    pub cost: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Budget {
    pub id: Uuid,
    pub name: String,
    pub amount: f64,
    pub current_spend: f64,
    pub alert_threshold: f64,
    pub period: BudgetPeriod,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BudgetPeriod {
    Monthly,
    Quarterly,
    Annual,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateBudgetRequest {
    pub name: String,
    pub amount: f64,
    pub alert_threshold: f64,
    pub period: BudgetPeriod,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostRecommendation {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub estimated_savings: f64,
    pub category: RecommendationCategory,
    pub effort: EffortLevel,
    pub resource_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecommendationCategory {
    Rightsizing,
    ReservedInstances,
    UnusedResources,
    Architecture,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EffortLevel {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostForecast {
    pub historical: Vec<DailyCost>,
    pub projected: Vec<DailyCost>,
    pub confidence_lower: Vec<DailyCost>,
    pub confidence_upper: Vec<DailyCost>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reservation {
    pub id: Uuid,
    pub provider: String,
    pub resource_type: String,
    pub instance_type: String,
    pub region: String,
    pub term_months: u32,
    pub monthly_cost: f64,
    pub utilization_percent: f64,
    pub expiration_date: NaiveDate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WastedResource {
    pub id: Uuid,
    pub resource_id: String,
    pub resource_type: String,
    pub provider: String,
    pub region: String,
    pub monthly_cost: f64,
    pub reason: String,
    pub last_used: Option<NaiveDate>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CostExplorerQuery {
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub group_by: Option<String>,
    pub provider: Option<String>,
    pub service: Option<String>,
}

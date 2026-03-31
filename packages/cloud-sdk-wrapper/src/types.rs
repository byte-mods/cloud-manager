use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Aws,
    Gcp,
    Azure,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudResource {
    pub id: String,
    pub name: String,
    pub resource_type: String,
    pub provider: Provider,
    pub region: String,
    pub status: String,
    pub tags: HashMap<String, String>,
    pub created_at: String,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceList {
    pub resources: Vec<CloudResource>,
    pub total: usize,
    pub next_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListOptions {
    pub region: String,
    pub page_size: Option<usize>,
    pub next_token: Option<String>,
    pub filters: HashMap<String, String>,
}

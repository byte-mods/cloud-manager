use async_trait::async_trait;
use chrono::{Datelike, NaiveDate, Utc};
use uuid::Uuid;

use super::CostProvider;
use crate::error::CostError;
use crate::models::cost::{DailyCost, ServiceCost, WastedResource};

fn seeded_rand(seed: u64) -> f64 {
    let mut s = seed;
    s ^= s << 13;
    s ^= s >> 7;
    s ^= s << 17;
    (s % 10_000) as f64 / 10_000.0
}

fn daily_variance(date: NaiveDate, provider_seed: u64, base_daily: f64) -> f64 {
    let day_of_year = date.ordinal() as u64;
    let year = date.year() as u64;
    let seed = provider_seed
        .wrapping_mul(31)
        .wrapping_add(year.wrapping_mul(367))
        .wrapping_add(day_of_year.wrapping_mul(173));

    let rand_factor = seeded_rand(seed);
    let noise = (rand_factor - 0.5) * 0.16 * base_daily;

    let weekday = date.weekday().num_days_from_monday();
    let weekday_factor = if weekday < 5 { 1.05 } else { 0.72 };

    base_daily * weekday_factor + noise
}

/// Azure Cost Management API client stub.
///
/// Generates realistic, deterministic cost data seeded by the current date.
pub struct AzureCostProvider {
    _subscription_id: String,
}

impl AzureCostProvider {
    pub fn new(subscription_id: &str) -> Self {
        Self {
            _subscription_id: subscription_id.to_string(),
        }
    }

    fn base_daily_cost(&self) -> f64 {
        6_890.0 / 30.0
    }

    fn provider_seed(&self) -> u64 {
        0xA2E_7890_1234_u64
    }
}

#[async_trait]
impl CostProvider for AzureCostProvider {
    fn name(&self) -> &str {
        "azure"
    }

    async fn get_current_month_cost(&self) -> Result<f64, CostError> {
        let today = Utc::now().date_naive();
        let first_of_month = NaiveDate::from_ymd_opt(today.year(), today.month(), 1).unwrap();
        let daily_costs = self.get_daily_costs(first_of_month, today).await?;
        let total: f64 = daily_costs.iter().map(|d| d.cost).sum();
        Ok((total * 100.0).round() / 100.0)
    }

    async fn get_cost_by_service(&self) -> Result<Vec<ServiceCost>, CostError> {
        let today = Utc::now().date_naive();
        let day_seed = today.ordinal() as u64 + today.year() as u64 * 367;

        let services_base: Vec<(&str, f64)> = vec![
            ("Virtual Machines", 2_890.0),
            ("SQL Database", 1_340.0),
            ("Blob Storage", 430.0),
            ("AKS", 1_230.0),
            ("App Service", 450.0),
            ("Cosmos DB", 350.0),
            ("Other Azure Services", 200.0),
        ];

        let total_base: f64 = services_base.iter().map(|(_, c)| *c).sum();
        let month_cost = self.get_current_month_cost().await?;
        let scale = month_cost / total_base;

        let mut services: Vec<ServiceCost> = services_base
            .iter()
            .enumerate()
            .map(|(i, (name, base))| {
                let r = seeded_rand(day_seed.wrapping_add(i as u64 * 83));
                let variance = 1.0 + (r - 0.5) * 0.06;
                let cost = (base * scale * variance * 100.0).round() / 100.0;
                ServiceCost {
                    service: name.to_string(),
                    provider: "azure".to_string(),
                    cost,
                    percentage: 0.0,
                }
            })
            .collect();

        let total: f64 = services.iter().map(|s| s.cost).sum();
        for svc in &mut services {
            svc.percentage = ((svc.cost / total) * 1000.0).round() / 10.0;
        }

        Ok(services)
    }

    async fn get_daily_costs(
        &self,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<Vec<DailyCost>, CostError> {
        let base = self.base_daily_cost();
        let seed = self.provider_seed();
        let mut costs = Vec::new();
        let mut date = start;
        while date <= end {
            let cost = daily_variance(date, seed, base);
            costs.push(DailyCost {
                date,
                cost: (cost * 100.0).round() / 100.0,
            });
            date += chrono::Duration::days(1);
        }
        Ok(costs)
    }

    async fn get_wasted_resources(&self) -> Result<Vec<WastedResource>, CostError> {
        let today = Utc::now().date_naive();
        Ok(vec![
            WastedResource {
                id: Uuid::new_v4(),
                resource_id: "azure-vm-deallocated-001".to_string(),
                resource_type: "Virtual Machine".to_string(),
                provider: "azure".to_string(),
                region: "eastus".to_string(),
                monthly_cost: 95.0,
                reason: "VM deallocated but managed disk still incurring charges".to_string(),
                last_used: Some(today - chrono::Duration::days(20)),
            },
            WastedResource {
                id: Uuid::new_v4(),
                resource_id: "azure-app-svc-unused-002".to_string(),
                resource_type: "App Service Plan".to_string(),
                provider: "azure".to_string(),
                region: "westus2".to_string(),
                monthly_cost: 73.0,
                reason: "App Service plan with no deployed applications".to_string(),
                last_used: Some(today - chrono::Duration::days(35)),
            },
            WastedResource {
                id: Uuid::new_v4(),
                resource_id: "azure-sql-oversized-003".to_string(),
                resource_type: "SQL Database".to_string(),
                provider: "azure".to_string(),
                region: "eastus".to_string(),
                monthly_cost: 210.0,
                reason: "Oversized SQL Database: average DTU usage 15%, consider downgrading tier".to_string(),
                last_used: Some(today),
            },
        ])
    }
}

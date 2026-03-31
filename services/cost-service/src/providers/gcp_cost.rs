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

/// GCP Cloud Billing API client stub.
///
/// Generates realistic, deterministic cost data seeded by the current date.
pub struct GcpCostProvider {
    _project_id: String,
}

impl GcpCostProvider {
    pub fn new(project_id: &str) -> Self {
        Self {
            _project_id: project_id.to_string(),
        }
    }

    fn base_daily_cost(&self) -> f64 {
        8_320.0 / 30.0
    }

    fn provider_seed(&self) -> u64 {
        0x6C9_ABCD_EF01_u64
    }
}

#[async_trait]
impl CostProvider for GcpCostProvider {
    fn name(&self) -> &str {
        "gcp"
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
            ("Compute Engine", 3_450.0),
            ("Cloud SQL", 1_890.0),
            ("Cloud Storage", 560.0),
            ("GKE", 1_420.0),
            ("Cloud Functions", 180.0),
            ("BigQuery", 520.0),
            ("Other GCP Services", 300.0),
        ];

        let total_base: f64 = services_base.iter().map(|(_, c)| *c).sum();
        let month_cost = self.get_current_month_cost().await?;
        let scale = month_cost / total_base;

        let mut services: Vec<ServiceCost> = services_base
            .iter()
            .enumerate()
            .map(|(i, (name, base))| {
                let r = seeded_rand(day_seed.wrapping_add(i as u64 * 113));
                let variance = 1.0 + (r - 0.5) * 0.06;
                let cost = (base * scale * variance * 100.0).round() / 100.0;
                ServiceCost {
                    service: name.to_string(),
                    provider: "gcp".to_string(),
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
                resource_id: "gce-instance-idle-001".to_string(),
                resource_type: "Compute Engine Instance".to_string(),
                provider: "gcp".to_string(),
                region: "us-central1".to_string(),
                monthly_cost: 120.0,
                reason: "Instance idle for 21 days (CPU < 3%, no network activity)".to_string(),
                last_used: Some(today - chrono::Duration::days(21)),
            },
            WastedResource {
                id: Uuid::new_v4(),
                resource_id: "disk-unused-002".to_string(),
                resource_type: "Persistent Disk".to_string(),
                provider: "gcp".to_string(),
                region: "us-east1".to_string(),
                monthly_cost: 25.0,
                reason: "Persistent disk not attached to any instance for 30 days".to_string(),
                last_used: Some(today - chrono::Duration::days(30)),
            },
            WastedResource {
                id: Uuid::new_v4(),
                resource_id: "cloudsql-oversized-003".to_string(),
                resource_type: "Cloud SQL Instance".to_string(),
                provider: "gcp".to_string(),
                region: "us-central1".to_string(),
                monthly_cost: 280.0,
                reason: "Oversized Cloud SQL instance: average CPU 12%, consider downsizing".to_string(),
                last_used: Some(today),
            },
        ])
    }
}

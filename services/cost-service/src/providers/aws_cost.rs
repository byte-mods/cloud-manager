use async_trait::async_trait;
use chrono::{Datelike, NaiveDate, Utc};
use uuid::Uuid;

use super::CostProvider;
use crate::error::CostError;
use crate::models::cost::{DailyCost, ServiceCost, WastedResource};

/// Simple seeded pseudo-random number generator (xorshift-based).
/// Produces a deterministic f64 in [0, 1) from a u64 seed.
fn seeded_rand(seed: u64) -> f64 {
    let mut s = seed;
    s ^= s << 13;
    s ^= s >> 7;
    s ^= s << 17;
    (s % 10_000) as f64 / 10_000.0
}

/// Returns a variance factor for a given date, providing day-level determinism.
/// Weekdays get higher costs than weekends.
fn daily_variance(date: NaiveDate, provider_seed: u64, base_daily: f64) -> f64 {
    let day_of_year = date.ordinal() as u64;
    let year = date.year() as u64;
    let seed = provider_seed
        .wrapping_mul(31)
        .wrapping_add(year.wrapping_mul(367))
        .wrapping_add(day_of_year.wrapping_mul(173));

    let rand_factor = seeded_rand(seed); // 0..1
    // +/- 8% random variance
    let noise = (rand_factor - 0.5) * 0.16 * base_daily;

    // Weekday/weekend factor: Mon-Fri higher, Sat-Sun lower
    let weekday = date.weekday().num_days_from_monday(); // 0=Mon .. 6=Sun
    let weekday_factor = if weekday < 5 { 1.05 } else { 0.72 };

    base_daily * weekday_factor + noise
}

/// AWS Cost Explorer API client stub.
///
/// Generates realistic, deterministic cost data seeded by the current date.
pub struct AwsCostProvider {
    _region: String,
}

impl AwsCostProvider {
    pub fn new(region: &str) -> Self {
        Self {
            _region: region.to_string(),
        }
    }

    /// Monthly base cost ~$12,450. Daily average ~$415.
    fn base_daily_cost(&self) -> f64 {
        12_450.0 / 30.0
    }

    /// Seed unique to this provider.
    fn provider_seed(&self) -> u64 {
        0xA05_1234_5678_u64
    }
}

#[async_trait]
impl CostProvider for AwsCostProvider {
    fn name(&self) -> &str {
        "aws"
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

        // Base costs with small daily variance
        let services_base: Vec<(&str, f64)> = vec![
            ("Amazon EC2", 5_230.0),
            ("Amazon RDS", 2_180.0),
            ("Amazon S3", 890.0),
            ("AWS Lambda", 340.0),
            ("Amazon EKS", 1_560.0),
            ("Amazon CloudFront", 450.0),
            ("Amazon Route 53", 50.0),
            ("Other AWS Services", 1_750.0),
        ];

        let total_base: f64 = services_base.iter().map(|(_, c)| *c).sum();
        let month_cost = self.get_current_month_cost().await?;
        let scale = month_cost / total_base;

        let mut services: Vec<ServiceCost> = services_base
            .iter()
            .enumerate()
            .map(|(i, (name, base))| {
                let r = seeded_rand(day_seed.wrapping_add(i as u64 * 97));
                let variance = 1.0 + (r - 0.5) * 0.06; // +/- 3%
                let cost = (base * scale * variance * 100.0).round() / 100.0;
                ServiceCost {
                    service: name.to_string(),
                    provider: "aws".to_string(),
                    cost,
                    percentage: 0.0, // calculated below
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
                resource_id: "i-0abc123def456".to_string(),
                resource_type: "EC2 Instance".to_string(),
                provider: "aws".to_string(),
                region: "us-east-1".to_string(),
                monthly_cost: 180.0,
                reason: "Instance CPU utilization below 5% for 30 days".to_string(),
                last_used: Some(today - chrono::Duration::days(30)),
            },
            WastedResource {
                id: Uuid::new_v4(),
                resource_id: "vol-0def456abc789".to_string(),
                resource_type: "EBS Volume".to_string(),
                provider: "aws".to_string(),
                region: "us-west-2".to_string(),
                monthly_cost: 45.0,
                reason: "Unattached EBS volume for 45 days".to_string(),
                last_used: Some(today - chrono::Duration::days(45)),
            },
            WastedResource {
                id: Uuid::new_v4(),
                resource_id: "eip-0ghi789jkl012".to_string(),
                resource_type: "Elastic IP".to_string(),
                provider: "aws".to_string(),
                region: "us-east-1".to_string(),
                monthly_cost: 3.60,
                reason: "Elastic IP not associated with any running instance".to_string(),
                last_used: Some(today - chrono::Duration::days(60)),
            },
            WastedResource {
                id: Uuid::new_v4(),
                resource_id: "db-staging-001".to_string(),
                resource_type: "RDS Instance".to_string(),
                provider: "aws".to_string(),
                region: "us-east-1".to_string(),
                monthly_cost: 340.0,
                reason: "Oversized RDS instance: average CPU 8%, consider downsizing".to_string(),
                last_used: Some(today),
            },
        ])
    }
}

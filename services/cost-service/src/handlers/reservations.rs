use actix_web::HttpResponse;
use chrono::NaiveDate;
use uuid::Uuid;

use crate::error::CostError;
use crate::models::cost::Reservation;

/// GET /api/v1/cost/reservations
///
/// Returns all Reserved Instances and Committed Use Discounts across providers
/// with realistic utilization data and expiration dates.
pub async fn list_reservations() -> Result<HttpResponse, CostError> {
    let reservations = vec![
        // AWS: 3 Reserved Instances
        Reservation {
            id: Uuid::new_v4(),
            provider: "aws".to_string(),
            resource_type: "EC2".to_string(),
            instance_type: "r5.xlarge".to_string(),
            region: "us-east-1".to_string(),
            term_months: 12,
            monthly_cost: 310.0,
            utilization_percent: 94.2,
            expiration_date: NaiveDate::from_ymd_opt(2027, 1, 15).unwrap(),
        },
        Reservation {
            id: Uuid::new_v4(),
            provider: "aws".to_string(),
            resource_type: "RDS".to_string(),
            instance_type: "db.r6g.large".to_string(),
            region: "us-east-1".to_string(),
            term_months: 36,
            monthly_cost: 220.0,
            utilization_percent: 98.1,
            expiration_date: NaiveDate::from_ymd_opt(2028, 6, 1).unwrap(),
        },
        Reservation {
            id: Uuid::new_v4(),
            provider: "aws".to_string(),
            resource_type: "EC2".to_string(),
            instance_type: "m5.2xlarge".to_string(),
            region: "us-west-2".to_string(),
            term_months: 12,
            monthly_cost: 425.0,
            utilization_percent: 87.6,
            expiration_date: NaiveDate::from_ymd_opt(2026, 11, 30).unwrap(),
        },
        // GCP: 2 Committed Use Discounts
        Reservation {
            id: Uuid::new_v4(),
            provider: "gcp".to_string(),
            resource_type: "Compute Engine".to_string(),
            instance_type: "n2-standard-4".to_string(),
            region: "us-central1".to_string(),
            term_months: 12,
            monthly_cost: 195.0,
            utilization_percent: 82.4,
            expiration_date: NaiveDate::from_ymd_opt(2026, 12, 15).unwrap(),
        },
        Reservation {
            id: Uuid::new_v4(),
            provider: "gcp".to_string(),
            resource_type: "Cloud SQL".to_string(),
            instance_type: "db-custom-4-16384".to_string(),
            region: "us-central1".to_string(),
            term_months: 36,
            monthly_cost: 285.0,
            utilization_percent: 96.8,
            expiration_date: NaiveDate::from_ymd_opt(2028, 9, 1).unwrap(),
        },
        // Azure: 2 Reserved Instances
        Reservation {
            id: Uuid::new_v4(),
            provider: "azure".to_string(),
            resource_type: "Virtual Machine".to_string(),
            instance_type: "Standard_D4s_v3".to_string(),
            region: "eastus".to_string(),
            term_months: 12,
            monthly_cost: 245.0,
            utilization_percent: 91.3,
            expiration_date: NaiveDate::from_ymd_opt(2027, 2, 1).unwrap(),
        },
        Reservation {
            id: Uuid::new_v4(),
            provider: "azure".to_string(),
            resource_type: "SQL Database".to_string(),
            instance_type: "Business Critical Gen5 4 vCore".to_string(),
            region: "eastus".to_string(),
            term_months: 36,
            monthly_cost: 380.0,
            utilization_percent: 75.9,
            expiration_date: NaiveDate::from_ymd_opt(2028, 4, 15).unwrap(),
        },
    ];

    Ok(HttpResponse::Ok().json(reservations))
}

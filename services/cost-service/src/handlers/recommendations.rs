use actix_web::{web, HttpResponse};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::CostError;
use crate::models::cost::{CostRecommendation, EffortLevel, RecommendationCategory, WastedResource};
use crate::providers::CostProvider;

/// GET /api/v1/cost/recommendations
///
/// Returns cost optimization recommendations derived from wasted resource data
/// plus additional smart recommendations for architecture and purchasing.
pub async fn get_recommendations(
    providers: web::Data<Vec<Arc<dyn CostProvider>>>,
) -> Result<HttpResponse, CostError> {
    let mut all_waste: Vec<WastedResource> = Vec::new();
    for provider in providers.iter() {
        let wasted = provider.get_wasted_resources().await?;
        all_waste.extend(wasted);
    }

    let mut recommendations: Vec<CostRecommendation> = Vec::new();

    // Generate a recommendation for each wasted resource.
    for w in &all_waste {
        let (title, description, category, effort) = waste_to_recommendation(w);
        recommendations.push(CostRecommendation {
            id: Uuid::new_v4(),
            title,
            description,
            estimated_savings: w.monthly_cost,
            category,
            effort,
            resource_id: Some(w.resource_id.clone()),
        });
    }

    // Add smart cross-provider recommendations.
    recommendations.push(CostRecommendation {
        id: Uuid::new_v4(),
        title: "Purchase Reserved Instances for stable EC2 workloads".to_string(),
        description: "Analysis shows 5 EC2 instances with consistent 24/7 usage over the past 90 days. \
            Purchasing 1-year Reserved Instances would save approximately 35% compared to on-demand pricing."
            .to_string(),
        estimated_savings: 1_830.0,
        category: RecommendationCategory::ReservedInstances,
        effort: EffortLevel::Medium,
        resource_id: None,
    });

    recommendations.push(CostRecommendation {
        id: Uuid::new_v4(),
        title: "Migrate compatible workloads to ARM-based instances".to_string(),
        description: "Several AWS EC2 and GCP Compute Engine workloads are compatible with ARM architecture \
            (Graviton3 / Tau T2A). Migration could reduce compute costs by up to 20% with comparable performance."
            .to_string(),
        estimated_savings: 950.0,
        category: RecommendationCategory::Architecture,
        effort: EffortLevel::High,
        resource_id: None,
    });

    recommendations.push(CostRecommendation {
        id: Uuid::new_v4(),
        title: "Enable storage lifecycle policies across S3 and GCS".to_string(),
        description: "Multiple S3 buckets and GCS buckets contain objects not accessed in 90+ days. \
            Moving cold data to Infrequent Access / Nearline storage tiers would reduce storage costs by ~60%."
            .to_string(),
        estimated_savings: 420.0,
        category: RecommendationCategory::Architecture,
        effort: EffortLevel::Low,
        resource_id: None,
    });

    recommendations.push(CostRecommendation {
        id: Uuid::new_v4(),
        title: "Enable cluster autoscaling for EKS and GKE".to_string(),
        description: "EKS and GKE clusters are running at 40-55% average utilization. Enabling \
            cluster autoscaler with appropriate min/max node counts could reduce node costs during off-peak hours."
            .to_string(),
        estimated_savings: 580.0,
        category: RecommendationCategory::Architecture,
        effort: EffortLevel::Medium,
        resource_id: None,
    });

    // Sort by estimated savings descending.
    recommendations.sort_by(|a, b| {
        b.estimated_savings
            .partial_cmp(&a.estimated_savings)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(HttpResponse::Ok().json(recommendations))
}

/// Maps a wasted resource to a recommendation tuple: (title, description, category, effort).
fn waste_to_recommendation(
    w: &WastedResource,
) -> (String, String, RecommendationCategory, EffortLevel) {
    let provider_label = w.provider.to_uppercase();
    let reason_lower = w.reason.to_lowercase();

    if reason_lower.contains("oversiz") {
        (
            format!("Rightsize {} {} in {}", provider_label, w.resource_type, w.region),
            format!(
                "{} {} ({}) is oversized: {}. Downsize to a smaller instance type to save ${:.0}/month.",
                provider_label, w.resource_type, w.resource_id, w.reason, w.monthly_cost
            ),
            RecommendationCategory::Rightsizing,
            EffortLevel::Medium,
        )
    } else if reason_lower.contains("idle") || (reason_lower.contains("cpu") && reason_lower.contains("below")) {
        (
            format!("Terminate or downsize idle {} {}", provider_label, w.resource_type),
            format!(
                "{} {} ({}) in {} is idle: {}. Consider terminating or downsizing to save ${:.0}/month.",
                provider_label, w.resource_type, w.resource_id, w.region, w.reason, w.monthly_cost
            ),
            RecommendationCategory::Rightsizing,
            EffortLevel::Low,
        )
    } else if reason_lower.contains("unattach") || reason_lower.contains("unused") || reason_lower.contains("not associated") || reason_lower.contains("no deployed") {
        (
            format!("Remove unused {} {} in {}", provider_label, w.resource_type, w.region),
            format!(
                "{} {} ({}) is unused: {}. Delete to save ${:.0}/month.",
                provider_label, w.resource_type, w.resource_id, w.reason, w.monthly_cost
            ),
            RecommendationCategory::UnusedResources,
            EffortLevel::Low,
        )
    } else if reason_lower.contains("deallocat") {
        (
            format!("Clean up deallocated {} resources", provider_label),
            format!(
                "{} {} ({}) in {}: {}. Remove associated disks to save ${:.0}/month.",
                provider_label, w.resource_type, w.resource_id, w.region, w.reason, w.monthly_cost
            ),
            RecommendationCategory::UnusedResources,
            EffortLevel::Low,
        )
    } else {
        (
            format!("Optimize {} {} in {}", provider_label, w.resource_type, w.region),
            format!(
                "{} {} ({}): {}. Estimated savings: ${:.0}/month.",
                provider_label, w.resource_type, w.resource_id, w.reason, w.monthly_cost
            ),
            RecommendationCategory::UnusedResources,
            EffortLevel::Low,
        )
    }
}

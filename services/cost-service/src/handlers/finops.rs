use actix_web::{web, HttpResponse};
use cloud_common::Database;

/// GET /api/v1/cost/finops/team-allocations
pub async fn get_team_allocations(db: web::Data<Database>) -> HttpResponse {
    let allocations: Vec<serde_json::Value> = db.list("finops_team_allocations").await.unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "allocations": allocations,
        "total": allocations.len(),
    }))
}

/// POST /api/v1/cost/finops/team-allocations
pub async fn create_team_allocation(
    db: web::Data<Database>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let mut data = body.into_inner();
    if let Some(obj) = data.as_object_mut() {
        obj.insert("id".into(), serde_json::json!(id));
        obj.insert("updated_at".into(), serde_json::json!(chrono::Utc::now().to_rfc3339()));
    }

    match db.create_with_id::<serde_json::Value>("finops_team_allocations", &id, data).await {
        Ok(_) => HttpResponse::Created().json(serde_json::json!({ "id": id })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e.to_string() })),
    }
}

/// GET /api/v1/cost/finops/unit-economics
pub async fn get_unit_economics(db: web::Data<Database>) -> HttpResponse {
    let data: Vec<serde_json::Value> = db.list("finops_unit_economics").await.unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "unit_economics": data,
        "total": data.len(),
    }))
}

/// GET /api/v1/cost/finops/ri-recommendations
pub async fn get_ri_recommendations(db: web::Data<Database>) -> HttpResponse {
    let data: Vec<serde_json::Value> = db.list("finops_ri_recommendations").await.unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "recommendations": data,
        "total": data.len(),
    }))
}

/// GET /api/v1/cost/finops/waste-categories
pub async fn get_waste_categories(db: web::Data<Database>) -> HttpResponse {
    let data: Vec<serde_json::Value> = db.list("finops_waste_categories").await.unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "categories": data,
        "total": data.len(),
    }))
}

/// GET /api/v1/cost/finops/kpis
pub async fn get_kpis(db: web::Data<Database>) -> HttpResponse {
    // Aggregate from team allocations and unit economics
    let allocations: Vec<serde_json::Value> = db.list("finops_team_allocations").await.unwrap_or_default();
    let total_spend: f64 = allocations
        .iter()
        .filter_map(|a| a.get("current_spend").and_then(|v| v.as_f64()))
        .sum();
    let total_budget: f64 = allocations
        .iter()
        .filter_map(|a| a.get("budget").and_then(|v| v.as_f64()))
        .sum();

    HttpResponse::Ok().json(serde_json::json!({
        "total_spend": total_spend,
        "total_budget": total_budget,
        "utilization_pct": if total_budget > 0.0 { (total_spend / total_budget * 100.0 * 100.0).round() / 100.0 } else { 0.0 },
        "teams_count": allocations.len(),
    }))
}

use actix_web::{test, web, App};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

use cost_service::handlers;
use cost_service::models::cost::Budget;
use cost_service::providers::{
    aws_cost::AwsCostProvider, azure_cost::AzureCostProvider, gcp_cost::GcpCostProvider,
    CostProvider,
};

async fn health() -> actix_web::HttpResponse {
    actix_web::HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "cost-service",
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

macro_rules! build_app {
    () => {{
        let cost_providers: Vec<Arc<dyn CostProvider>> = vec![
            Arc::new(AwsCostProvider::new("us-east-1")) as Arc<dyn CostProvider>,
            Arc::new(GcpCostProvider::new("my-project")) as Arc<dyn CostProvider>,
            Arc::new(AzureCostProvider::new("my-subscription")) as Arc<dyn CostProvider>,
        ];

        let providers_data = web::Data::new(cost_providers);
        let budget_store = web::Data::new(Mutex::new(HashMap::<Uuid, Budget>::new()));

        test::init_service(
            App::new()
                .app_data(providers_data.clone())
                .app_data(budget_store.clone())
                .route("/health", web::get().to(health))
                .route("/api/v1/cost/overview", web::get().to(handlers::overview::get_overview))
                .route("/api/v1/cost/explorer", web::get().to(handlers::explorer::explore_costs))
                .route("/api/v1/cost/budgets", web::get().to(handlers::budgets::list_budgets))
                .route("/api/v1/cost/budgets", web::post().to(handlers::budgets::create_budget))
                .route("/api/v1/cost/recommendations", web::get().to(handlers::recommendations::get_recommendations))
                .route("/api/v1/cost/reservations", web::get().to(handlers::reservations::list_reservations))
                .route("/api/v1/cost/forecast", web::get().to(handlers::forecast::get_forecast))
                .route("/api/v1/cost/waste", web::get().to(handlers::waste::detect_waste)),
        )
        .await
    }};
}

// ─── Health ──────────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_health_check() {
    let app = build_app!();
    let req = test::TestRequest::get().uri("/health").to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "healthy");
    assert_eq!(body["service"], "cost-service");
    assert!(body["timestamp"].as_str().is_some());
}

// ─── Cost Overview ───────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_cost_overview() {
    let app = build_app!();
    let req = test::TestRequest::get()
        .uri("/api/v1/cost/overview")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;

    let total_cost = body["total_cost"].as_f64().unwrap();
    assert!(total_cost > 0.0, "Total cost should be > 0, got {}", total_cost);

    let by_provider = body["cost_by_provider"].as_object().unwrap();
    assert!(by_provider.contains_key("aws"), "Should have AWS cost breakdown");
    assert!(by_provider.contains_key("gcp"), "Should have GCP cost breakdown");
    assert!(by_provider.contains_key("azure"), "Should have Azure cost breakdown");

    for (provider, cost) in by_provider {
        assert!(cost.as_f64().unwrap() > 0.0, "{} cost should be positive", provider);
    }

    let services = body["cost_by_service"].as_array().unwrap();
    assert!(services.len() > 0, "Should have service breakdown");

    let trend = body["trend"].as_array().unwrap();
    assert!(trend.len() > 0, "Should have trend data");
}

// ─── Cost Explorer ───────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_cost_explorer() {
    let app = build_app!();
    let req = test::TestRequest::get()
        .uri("/api/v1/cost/explorer")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    let results = body.as_array().unwrap();

    assert_eq!(results.len(), 3, "Should have 3 provider results");

    for result in results {
        assert_eq!(result["group_by"], "date");
        let data = result["data"].as_array().unwrap();
        assert!(data.len() > 0, "Each provider should have daily cost data");

        let first_point = &data[0];
        assert!(first_point["date"].as_str().is_some());
        assert!(first_point["cost"].as_f64().unwrap() > 0.0);
    }
}

#[actix_web::test]
async fn test_cost_explorer_group_by_service() {
    let app = build_app!();
    let req = test::TestRequest::get()
        .uri("/api/v1/cost/explorer?group_by=service")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    let results = body.as_array().unwrap();

    for result in results {
        assert_eq!(result["group_by"], "service");
        let data = result["data"].as_array().unwrap();
        assert!(data.len() > 0, "Should have service data");

        let first = &data[0];
        assert!(first["service"].as_str().is_some());
        assert!(first["provider"].as_str().is_some());
        assert!(first["cost"].as_f64().unwrap() > 0.0);
    }
}

#[actix_web::test]
async fn test_cost_explorer_provider_filter() {
    let app = build_app!();
    let req = test::TestRequest::get()
        .uri("/api/v1/cost/explorer?provider=aws")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    let results = body.as_array().unwrap();

    assert_eq!(results.len(), 1, "Filtering by aws should return 1 provider result");
    assert_eq!(results[0]["provider"], "aws");
}

// ─── Budgets ─────────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_create_budget() {
    let app = build_app!();

    let payload = serde_json::json!({
        "name": "Engineering Q1 Budget",
        "amount": 50000.0,
        "alert_threshold": 0.8,
        "period": "monthly"
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/cost/budgets")
        .set_json(&payload)
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 201);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["name"], "Engineering Q1 Budget");
    assert_eq!(body["amount"], 50000.0);
    assert_eq!(body["alert_threshold"], 0.8);
    assert_eq!(body["current_spend"], 0.0);
    assert!(body["id"].as_str().is_some());
}

#[actix_web::test]
async fn test_create_budget_invalid() {
    let app = build_app!();

    let payload = serde_json::json!({
        "name": "Bad Budget",
        "amount": -100.0,
        "alert_threshold": 0.8,
        "period": "monthly"
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/cost/budgets")
        .set_json(&payload)
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 400);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["error"], "bad_request");
}

#[actix_web::test]
async fn test_list_budgets() {
    let app = build_app!();

    let budget1 = serde_json::json!({
        "name": "Budget A",
        "amount": 10000.0,
        "alert_threshold": 0.9,
        "period": "monthly"
    });
    let budget2 = serde_json::json!({
        "name": "Budget B",
        "amount": 25000.0,
        "alert_threshold": 0.75,
        "period": "quarterly"
    });

    for payload in [&budget1, &budget2] {
        let req = test::TestRequest::post()
            .uri("/api/v1/cost/budgets")
            .set_json(payload)
            .to_request();
        let resp: actix_web::dev::ServiceResponse = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 201);
    }

    let req = test::TestRequest::get()
        .uri("/api/v1/cost/budgets")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    let budgets = body.as_array().unwrap();
    assert_eq!(budgets.len(), 2, "Should have 2 budgets");

    let names: Vec<&str> = budgets.iter().map(|b| b["name"].as_str().unwrap()).collect();
    assert!(names.contains(&"Budget A"));
    assert!(names.contains(&"Budget B"));
}

// ─── Recommendations ─────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_cost_recommendations() {
    let app = build_app!();
    let req = test::TestRequest::get()
        .uri("/api/v1/cost/recommendations")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    let recommendations = body.as_array().unwrap();

    assert!(recommendations.len() > 0, "Should have cost recommendations");

    let total_savings: f64 = recommendations
        .iter()
        .map(|r| r["estimated_savings"].as_f64().unwrap())
        .sum();
    assert!(total_savings > 0.0, "Total estimated savings should be > 0, got {}", total_savings);

    let first = &recommendations[0];
    assert!(first["title"].as_str().is_some());
    assert!(first["description"].as_str().is_some());
    assert!(first["estimated_savings"].as_f64().unwrap() > 0.0);
    assert!(first["category"].as_str().is_some());
    assert!(first["effort"].as_str().is_some());

    // Should be sorted by savings descending
    for i in 1..recommendations.len() {
        let prev = recommendations[i - 1]["estimated_savings"].as_f64().unwrap();
        let curr = recommendations[i]["estimated_savings"].as_f64().unwrap();
        assert!(prev >= curr, "Recommendations should be sorted by savings descending");
    }
}

// ─── Reservations ────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_cost_reservations() {
    let app = build_app!();
    let req = test::TestRequest::get()
        .uri("/api/v1/cost/reservations")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    let reservations = body.as_array().unwrap();

    assert_eq!(reservations.len(), 7, "Should have 7 reservations (3 AWS + 2 GCP + 2 Azure)");

    for reservation in reservations {
        let utilization = reservation["utilization_percent"].as_f64().unwrap();
        assert!(
            utilization > 0.0 && utilization <= 100.0,
            "Utilization should be 0-100, got {}",
            utilization
        );
        assert!(reservation["monthly_cost"].as_f64().unwrap() > 0.0);
        assert!(reservation["provider"].as_str().is_some());
        assert!(reservation["instance_type"].as_str().is_some());
        assert!(reservation["expiration_date"].as_str().is_some());
    }

    let providers: Vec<&str> = reservations.iter().map(|r| r["provider"].as_str().unwrap()).collect();
    assert!(providers.contains(&"aws"));
    assert!(providers.contains(&"gcp"));
    assert!(providers.contains(&"azure"));
}

// ─── Forecast ────────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_cost_forecast() {
    let app = build_app!();
    let req = test::TestRequest::get()
        .uri("/api/v1/cost/forecast")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;

    let historical = body["historical"].as_array().unwrap();
    assert!(historical.len() > 0, "Should have historical data");

    let projected = body["projected"].as_array().unwrap();
    assert_eq!(projected.len(), 30, "Should have 30 days of projected data");

    let lower = body["confidence_lower"].as_array().unwrap();
    let upper = body["confidence_upper"].as_array().unwrap();
    assert_eq!(lower.len(), 30);
    assert_eq!(upper.len(), 30);

    // Verify confidence bounds: lower <= projected <= upper
    for i in 0..projected.len() {
        let proj = projected[i]["cost"].as_f64().unwrap();
        let lo = lower[i]["cost"].as_f64().unwrap();
        let hi = upper[i]["cost"].as_f64().unwrap();
        assert!(
            lo <= proj && proj <= hi,
            "Confidence bounds violated at index {}: {} <= {} <= {}",
            i, lo, proj, hi
        );
    }

    for hp in historical {
        assert!(hp["cost"].as_f64().unwrap() > 0.0);
        assert!(hp["date"].as_str().is_some());
    }
}

// ─── Waste Detection ─────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_cost_waste() {
    let app = build_app!();
    let req = test::TestRequest::get()
        .uri("/api/v1/cost/waste")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;

    let total_waste = body["total_monthly_waste"].as_f64().unwrap();
    assert!(total_waste > 0.0, "Total monthly waste should be > 0, got {}", total_waste);

    let resource_count = body["resource_count"].as_u64().unwrap();
    assert!(resource_count > 0, "Should have wasted resources");

    let resources = body["resources"].as_array().unwrap();
    assert_eq!(resources.len(), resource_count as usize);

    for resource in resources {
        assert!(resource["resource_id"].as_str().is_some());
        assert!(resource["resource_type"].as_str().is_some());
        assert!(resource["provider"].as_str().is_some());
        assert!(resource["monthly_cost"].as_f64().unwrap() > 0.0);
        assert!(resource["reason"].as_str().is_some());
    }

    // Verify total matches sum of individual costs
    let calculated_total: f64 = resources
        .iter()
        .map(|r| r["monthly_cost"].as_f64().unwrap())
        .sum();
    assert!(
        (total_waste - calculated_total).abs() < 0.01,
        "Total waste {} should match sum of resources {}",
        total_waste,
        calculated_total
    );

    let providers: Vec<&str> = resources.iter().map(|r| r["provider"].as_str().unwrap()).collect();
    assert!(providers.contains(&"aws"));
}

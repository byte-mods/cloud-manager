use actix_web::{test, web, App};
use serde_json::Value;
use std::sync::Arc;

use cloud_service::handlers;
use cloud_service::providers::store;
use cloud_service::providers::ProviderContext;

async fn health_check() -> actix_web::HttpResponse {
    actix_web::HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "cloud-service",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

macro_rules! build_app {
    () => {{
        let cloud_store = Arc::new(store::create_seeded_store());
        let ctx = Arc::new(ProviderContext {
            store: cloud_store,
            credentials: None,
            cache: None,
            flags: cloud_common::FeatureFlags {
                use_mock_data: true,
                enable_cache: false,
                enable_rate_limiting: false,
            },
        });
        test::init_service(
            App::new()
                .app_data(web::Data::new(ctx.clone()))
                .route("/health", web::get().to(health_check))
                .service(
                    web::scope("/api/v1/cloud/{provider}/compute")
                        .route("/instances", web::get().to(handlers::compute::list_instances))
                        .route("/instances", web::post().to(handlers::compute::create_instance))
                        .route("/instances/{id}", web::get().to(handlers::compute::get_instance))
                        .route("/instances/{id}", web::delete().to(handlers::compute::delete_instance))
                        .route("/instances/{id}/actions/{action}", web::post().to(handlers::compute::instance_action)),
                )
                .service(
                    web::scope("/api/v1/cloud/{provider}/storage")
                        .route("/buckets", web::get().to(handlers::storage::list_buckets))
                        .route("/buckets", web::post().to(handlers::storage::create_bucket))
                        .route("/buckets/{id}", web::get().to(handlers::storage::get_bucket))
                        .route("/buckets/{id}", web::delete().to(handlers::storage::delete_bucket))
                        .route("/buckets/{id}/objects", web::get().to(handlers::storage::list_objects))
                        .route("/buckets/{id}/objects", web::post().to(handlers::storage::upload_object))
                        .route("/buckets/{bucket}/objects/{key}", web::delete().to(handlers::storage::delete_object)),
                )
                .service(
                    web::scope("/api/v1/cloud/{provider}/networking")
                        .route("/vpcs", web::get().to(handlers::networking::list_vpcs))
                        .route("/vpcs", web::post().to(handlers::networking::create_vpc))
                        .route("/vpcs/{id}", web::get().to(handlers::networking::get_vpc))
                        .route("/vpcs/{id}", web::delete().to(handlers::networking::delete_vpc))
                        .route("/vpcs/{vpc_id}/subnets", web::get().to(handlers::networking::list_subnets))
                        .route("/subnets", web::post().to(handlers::networking::create_subnet))
                        .route("/subnets/{id}", web::delete().to(handlers::networking::delete_subnet))
                        .route("/load-balancers", web::get().to(handlers::networking::list_load_balancers))
                        .route("/load-balancers/{id}", web::get().to(handlers::networking::get_load_balancer))
                        .route("/load-balancers/{id}", web::delete().to(handlers::networking::delete_load_balancer))
                        .route("/security-groups", web::get().to(handlers::networking::list_security_groups)),
                )
                .service(
                    web::scope("/api/v1/cloud/{provider}/database")
                        .route("/instances", web::get().to(handlers::database::list_databases))
                        .route("/instances", web::post().to(handlers::database::create_database))
                        .route("/instances/{id}", web::get().to(handlers::database::get_database))
                        .route("/instances/{id}", web::delete().to(handlers::database::delete_database))
                        .route("/instances/{id}/actions/{action}", web::post().to(handlers::database::database_action)),
                ),
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
    assert_eq!(body["service"], "cloud-service");
}

// ─── Compute: AWS ────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_aws_instances() {
    let app = build_app!();
    let req = test::TestRequest::get()
        .uri("/api/v1/cloud/aws/compute/instances")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["total"], 4, "AWS should have 4 seeded instances");

    let resources = body["resources"].as_array().unwrap();
    assert_eq!(resources.len(), 4);

    let names: Vec<&str> = resources.iter().map(|r| r["name"].as_str().unwrap()).collect();
    assert!(names.contains(&"web-server-1"), "Should contain web-server-1");
    assert!(names.contains(&"batch-worker-1"), "Should contain batch-worker-1");
}

#[actix_web::test]
async fn test_list_gcp_instances() {
    let app = build_app!();
    let req = test::TestRequest::get()
        .uri("/api/v1/cloud/gcp/compute/instances")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["total"], 3, "GCP should have 3 seeded instances");

    let resources = body["resources"].as_array().unwrap();
    let names: Vec<&str> = resources.iter().map(|r| r["name"].as_str().unwrap()).collect();
    assert!(names.contains(&"gcp-web-1"));
    assert!(names.contains(&"gcp-ml-worker"));
}

#[actix_web::test]
async fn test_list_azure_instances() {
    let app = build_app!();
    let req = test::TestRequest::get()
        .uri("/api/v1/cloud/azure/compute/instances")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["total"], 3, "Azure should have 3 seeded instances");

    let resources = body["resources"].as_array().unwrap();
    let names: Vec<&str> = resources.iter().map(|r| r["name"].as_str().unwrap()).collect();
    assert!(names.contains(&"azure-web-1"));
    assert!(names.contains(&"azure-dev-1"));
}

#[actix_web::test]
async fn test_get_instance_not_found() {
    let app = build_app!();
    // Use a valid UUID format that does not correspond to any seeded resource
    let req = test::TestRequest::get()
        .uri("/api/v1/cloud/aws/compute/instances/00000000-0000-0000-0000-000000000000")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 404);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["error"], "not_found");
}

#[actix_web::test]
async fn test_create_instance() {
    let app = build_app!();

    let payload = serde_json::json!({
        "name": "test-instance",
        "instance_type": "t3.micro",
        "image_id": "ami-12345678",
        "region": "us-east-1",
        "subnet_id": null,
        "security_group_ids": [],
        "key_pair": null,
        "tags": {"env": "test"},
        "user_data": null
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/cloud/aws/compute/instances")
        .set_json(&payload)
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 201);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["name"], "test-instance");
    assert_eq!(body["provider"], "aws");
    assert!(body["id"].as_str().is_some(), "Should have an id field");
    assert_eq!(body["region"], "us-east-1");
}

#[actix_web::test]
async fn test_delete_instance() {
    let app = build_app!();

    // Create an instance
    let payload = serde_json::json!({
        "name": "delete-me-instance",
        "instance_type": "t3.micro",
        "image_id": "ami-12345678",
        "region": "us-east-1",
        "subnet_id": null,
        "security_group_ids": [],
        "key_pair": null,
        "tags": {},
        "user_data": null
    });
    let req = test::TestRequest::post()
        .uri("/api/v1/cloud/aws/compute/instances")
        .set_json(&payload)
        .to_request();
    let resp: actix_web::dev::ServiceResponse = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);
    let created: Value = test::read_body_json(resp).await;
    let instance_id = created["id"].as_str().unwrap();

    // Delete it
    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/cloud/aws/compute/instances/{}", instance_id))
        .to_request();
    let resp: actix_web::dev::ServiceResponse = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 204);

    // Confirm it is gone
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/cloud/aws/compute/instances/{}", instance_id))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

#[actix_web::test]
async fn test_start_stop_instance() {
    let app = build_app!();

    // Create an instance
    let payload = serde_json::json!({
        "name": "action-test-instance",
        "instance_type": "t3.micro",
        "image_id": "ami-12345678",
        "region": "us-east-1",
        "subnet_id": null,
        "security_group_ids": [],
        "key_pair": null,
        "tags": {},
        "user_data": null
    });
    let req = test::TestRequest::post()
        .uri("/api/v1/cloud/aws/compute/instances")
        .set_json(&payload)
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);
    let created: Value = test::read_body_json(resp).await;
    let instance_id = created["id"].as_str().unwrap();

    // Stop it
    let action_body = serde_json::json!({"parameters": null});
    let req = test::TestRequest::post()
        .uri(&format!("/api/v1/cloud/aws/compute/instances/{}/actions/stop", instance_id))
        .set_json(&action_body)
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "accepted");
    assert_eq!(body["action"], "stop");

    // Start it
    let req = test::TestRequest::post()
        .uri(&format!("/api/v1/cloud/aws/compute/instances/{}/actions/start", instance_id))
        .set_json(&action_body)
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "accepted");
    assert_eq!(body["action"], "start");
}

// ─── Storage ─────────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_aws_buckets() {
    let app = build_app!();
    let req = test::TestRequest::get()
        .uri("/api/v1/cloud/aws/storage/buckets")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["total"], 3, "AWS should have 3 seeded buckets");

    let resources = body["resources"].as_array().unwrap();
    let names: Vec<&str> = resources.iter().map(|r| r["name"].as_str().unwrap()).collect();
    assert!(names.contains(&"app-assets-prod"));
    assert!(names.contains(&"data-lake-raw"));
    assert!(names.contains(&"backup-vault-2024"));
}

#[actix_web::test]
async fn test_create_bucket() {
    let app = build_app!();

    let payload = serde_json::json!({
        "name": "test-bucket-new",
        "region": "us-east-1",
        "versioning": true,
        "encryption": true,
        "public_access": false,
        "tags": {"env": "test"}
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/cloud/aws/storage/buckets")
        .set_json(&payload)
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 201);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["name"], "test-bucket-new");
    assert_eq!(body["provider"], "aws");
    assert_eq!(body["region"], "us-east-1");
}

// ─── Networking ──────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_vpcs() {
    let app = build_app!();
    let req = test::TestRequest::get()
        .uri("/api/v1/cloud/aws/networking/vpcs")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["total"], 2, "AWS should have 2 seeded VPCs");

    let resources = body["resources"].as_array().unwrap();
    let names: Vec<&str> = resources.iter().map(|r| r["name"].as_str().unwrap()).collect();
    assert!(names.contains(&"prod-vpc"));
    assert!(names.contains(&"dev-vpc"));
}

#[actix_web::test]
async fn test_list_subnets() {
    let app = build_app!();

    // Get the VPC list to find the prod VPC id
    let req = test::TestRequest::get()
        .uri("/api/v1/cloud/aws/networking/vpcs")
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;

    let vpcs = body["resources"].as_array().unwrap();
    let prod_vpc = vpcs.iter().find(|v| v["name"] == "prod-vpc").expect("prod-vpc should exist");
    let vpc_id = prod_vpc["id"].as_str().unwrap();

    // List subnets for the prod VPC
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/cloud/aws/networking/vpcs/{}/subnets", vpc_id))
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["total"], 4, "prod-vpc should have 4 subnets");
}

#[actix_web::test]
async fn test_list_load_balancers() {
    let app = build_app!();
    let req = test::TestRequest::get()
        .uri("/api/v1/cloud/aws/networking/load-balancers")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["total"], 2, "AWS should have 2 seeded load balancers");

    let resources = body["resources"].as_array().unwrap();
    let names: Vec<&str> = resources.iter().map(|r| r["name"].as_str().unwrap()).collect();
    assert!(names.contains(&"prod-alb"));
    assert!(names.contains(&"internal-nlb"));
}

#[actix_web::test]
async fn test_list_security_groups() {
    let app = build_app!();
    let req = test::TestRequest::get()
        .uri("/api/v1/cloud/aws/networking/security-groups")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["total"], 3, "AWS should have 3 seeded security groups");

    let resources = body["resources"].as_array().unwrap();
    let names: Vec<&str> = resources.iter().map(|r| r["name"].as_str().unwrap()).collect();
    assert!(names.contains(&"web-sg"));
    assert!(names.contains(&"api-sg"));
    assert!(names.contains(&"db-sg"));
}

// ─── Database ────────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_databases() {
    let app = build_app!();
    let req = test::TestRequest::get()
        .uri("/api/v1/cloud/aws/database/instances")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["total"], 2, "AWS should have 2 seeded databases");

    let resources = body["resources"].as_array().unwrap();
    let names: Vec<&str> = resources.iter().map(|r| r["name"].as_str().unwrap()).collect();
    assert!(names.contains(&"prod-postgres"));
    assert!(names.contains(&"analytics-mysql"));
}

#[actix_web::test]
async fn test_create_database() {
    let app = build_app!();

    let payload = serde_json::json!({
        "name": "test-db",
        "engine": "postgresql",
        "engine_version": "16.0",
        "instance_class": "db.t3.medium",
        "storage_gb": 100,
        "region": "us-east-1",
        "multi_az": false,
        "tags": {"env": "test"}
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/cloud/aws/database/instances")
        .set_json(&payload)
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 201);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["name"], "test-db");
    assert_eq!(body["provider"], "aws");
    assert!(body["id"].as_str().is_some());
}

// ─── Invalid provider ────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_invalid_provider() {
    let app = build_app!();
    let req = test::TestRequest::get()
        .uri("/api/v1/cloud/invalid/compute/instances")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 400);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["error"], "bad_request");
    assert!(body["message"].as_str().unwrap().contains("Unknown provider"));
}

// ─── Region filtering ────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_region_filtering() {
    let app = build_app!();

    // GCP instances are in us-central1; querying with us-east-1 should return 0
    let req = test::TestRequest::get()
        .uri("/api/v1/cloud/gcp/compute/instances?region=us-east-1")
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["total"], 0, "GCP instances in us-east-1 should be empty");

    // GCP instances in us-central1 should return 3
    let req = test::TestRequest::get()
        .uri("/api/v1/cloud/gcp/compute/instances?region=us-central1")
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["total"], 3, "GCP instances in us-central1 should be 3");
}

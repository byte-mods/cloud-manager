use actix_web::{test, web, App};
use serde_json::Value;

use security_service::config::AppConfig;
use security_service::handlers;

async fn health_check() -> actix_web::HttpResponse {
    actix_web::HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "security-service",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

/// Create a temporary SurrealDB database and seed it for testing.
async fn setup_test_db() -> cloud_common::Database {
    // Use a unique temp path per test to avoid conflicts
    let unique_id = uuid::Uuid::new_v4();
    let db_path = format!("/tmp/security_test_{}", unique_id);

    let db = cloud_common::Database::new(&db_path)
        .await
        .expect("Failed to create test DB");
    db.init_and_seed().await.ok();
    security_service::store::seed_if_empty(&db).await;
    db
}

macro_rules! build_app {
    ($db:expr) => { build_app!($db, ddos_enabled: true) };
    ($db:expr, ddos_enabled: $enabled:expr) => {{
        let mut config = AppConfig::default();
        config.ddos.enabled = $enabled;
        config.ddos.max_duration_seconds = 3600;

        let app_config = web::Data::new(config);
        let db_data = web::Data::new($db);

        test::init_service(
            App::new()
                .app_data(app_config.clone())
                .app_data(db_data.clone())
                .route("/health", web::get().to(health_check))
                .service(
                    web::scope("/api/v1/security/scans")
                        .route("", web::get().to(handlers::scans::list_scans))
                        .route("", web::post().to(handlers::scans::create_scan))
                        .route("/{id}", web::get().to(handlers::scans::get_scan))
                        .route("/{id}/findings", web::get().to(handlers::scans::get_scan_findings)),
                )
                .service(
                    web::scope("/api/v1/security/compliance")
                        .route("/assess", web::post().to(handlers::compliance::assess_framework))
                        .route("/report", web::post().to(handlers::compliance::generate_report))
                        .route("/{framework}", web::get().to(handlers::compliance::get_assessment)),
                )
                .service(
                    web::scope("/api/v1/security/posture")
                        .route("/score", web::get().to(handlers::posture::get_score))
                        .route("/categories", web::get().to(handlers::posture::get_categories))
                        .route("/trend", web::get().to(handlers::posture::get_trend)),
                )
                .service(
                    web::scope("/api/v1/security/vulnerabilities")
                        .route("", web::get().to(handlers::vulnerability::list_vulnerabilities))
                        .route("/scan", web::post().to(handlers::vulnerability::scan_vulnerabilities))
                        .route("/{id}", web::get().to(handlers::vulnerability::get_vulnerability)),
                )
                .service(
                    web::scope("/api/v1/security/ddos-tests")
                        .route("", web::post().to(handlers::ddos::create_test))
                        .route("/{id}", web::get().to(handlers::ddos::get_results))
                        .route("/{id}/stop", web::post().to(handlers::ddos::stop_test))
                        .route("/{id}/audit", web::get().to(handlers::ddos::audit_trail)),
                ),
        )
        .await
    }};
}

// ─── Health ──────────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_health_check() {
    let db = setup_test_db().await;
    let app = build_app!(db);
    let req = test::TestRequest::get().uri("/health").to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "healthy");
    assert_eq!(body["service"], "security-service");
}

// ─── Scans ───────────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_scans() {
    let db = setup_test_db().await;
    let app = build_app!(db);
    let req = test::TestRequest::get()
        .uri("/api/v1/security/scans")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["total"], 4, "Should have 4 seeded scans");
    let scans = body["scans"].as_array().unwrap();
    assert_eq!(scans.len(), 4);
}

#[actix_web::test]
async fn test_get_scan() {
    let db = setup_test_db().await;
    let app = build_app!(db);

    // List scans to get a real scan ID
    let req = test::TestRequest::get().uri("/api/v1/security/scans").to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    let scans = body["scans"].as_array().unwrap();
    let scan_id = scans[0]["id"].as_str().unwrap();

    // Get that specific scan
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/security/scans/{}", scan_id))
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["id"], scan_id);
    assert!(body["scan_type"].as_str().is_some());
    assert!(body["target"].as_str().is_some());
    assert!(body["status"].as_str().is_some());
}

#[actix_web::test]
async fn test_create_scan() {
    let db = setup_test_db().await;
    let app = build_app!(db);

    let payload = serde_json::json!({
        "scan_type": "vulnerability",
        "target": "test.example.com",
        "parameters": {"depth": "deep"}
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/security/scans")
        .set_json(&payload)
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 201);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["target"], "test.example.com");
    assert_eq!(body["status"], "pending");
    assert_eq!(body["scan_type"], "vulnerability");
    assert!(body["id"].as_str().is_some());
}

#[actix_web::test]
async fn test_get_scan_findings() {
    let db = setup_test_db().await;
    let app = build_app!(db);

    // List scans and find a completed one with findings
    let req = test::TestRequest::get().uri("/api/v1/security/scans").to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    let scans = body["scans"].as_array().unwrap();

    let completed_scan = scans
        .iter()
        .find(|s| s["status"] == "completed" && s["findings"].as_array().unwrap().len() > 0)
        .expect("Should have at least one completed scan with findings");
    let scan_id = completed_scan["id"].as_str().unwrap();

    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/security/scans/{}/findings", scan_id))
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["scan_id"], scan_id);

    let findings = body["findings"].as_array().unwrap();
    assert!(findings.len() > 0, "Completed scan should have findings");
    assert_eq!(body["total"], findings.len());

    // Verify finding structure
    let first = &findings[0];
    assert!(first["title"].as_str().is_some());
    assert!(first["severity"].as_str().is_some());
    assert!(first["cvss_score"].as_f64().is_some());
}

// ─── Compliance ──────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_get_compliance_soc2() {
    let db = setup_test_db().await;
    let app = build_app!(db);
    let req = test::TestRequest::get()
        .uri("/api/v1/security/compliance/soc2")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;

    let score = body["score"].as_f64().unwrap();
    assert!(
        (score - 87.0).abs() < 0.1,
        "SOC2 score should be ~87, got {}",
        score
    );
    assert_eq!(body["framework"], "soc2");
    assert!(body["controls"].as_array().is_some());
    assert!(body["summary"]["total_controls"].as_u64().unwrap() >= 45);
    assert!(body["summary"]["passed"].as_u64().unwrap() >= 38);
}

#[actix_web::test]
async fn test_get_compliance_all_frameworks() {
    let db = setup_test_db().await;
    let app = build_app!(db);

    let frameworks = vec!["soc2", "iso27001", "hipaa", "pci-dss-4", "gdpr", "nist-csf", "cis"];

    for framework in frameworks {
        let req = test::TestRequest::get()
            .uri(&format!("/api/v1/security/compliance/{}", framework))
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 200, "Framework {} should return 200", framework);
        let body: Value = test::read_body_json(resp).await;
        assert!(body["score"].as_f64().unwrap() > 0.0, "Framework {} should have positive score", framework);
        assert!(body["controls"].as_array().unwrap().len() > 0, "Framework {} should have controls", framework);
    }
}

#[actix_web::test]
async fn test_assess_framework() {
    let db = setup_test_db().await;
    let app = build_app!(db);

    let payload = serde_json::json!({
        "framework": "soc2",
        "scope": ["all"]
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/security/compliance/assess")
        .set_json(&payload)
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert!(body["score"].as_f64().is_some());
    assert!(body["controls"].as_array().is_some());
}

#[actix_web::test]
async fn test_generate_report() {
    let db = setup_test_db().await;
    let app = build_app!(db);

    let payload = serde_json::json!({
        "framework": "soc2",
        "format": "pdf",
        "include_evidence": true
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/security/compliance/report")
        .set_json(&payload)
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "generated");
    assert_eq!(body["format"], "pdf");
    assert!(body["score"].as_f64().unwrap() > 0.0);
    assert!(body["download_url"].as_str().is_some());
    assert_eq!(body["include_evidence"], true);
}

// ─── Posture ─────────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_posture_score() {
    let db = setup_test_db().await;
    let app = build_app!(db);
    let req = test::TestRequest::get()
        .uri("/api/v1/security/posture/score")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;

    let score = body["overall_score"].as_f64().unwrap();
    assert!(score >= 0.0 && score <= 100.0, "Score should be 0-100, got {}", score);

    let grade = body["grade"].as_str().unwrap();
    assert!(
        ["a", "b", "c", "d", "f"].contains(&grade),
        "Grade should be a valid letter grade, got {}",
        grade
    );

    assert!(body["categories"].as_array().is_some());
    assert!(body["drift_detected"].as_bool().is_some());
    assert!(body["assessed_at"].as_str().is_some());
}

#[actix_web::test]
async fn test_posture_categories() {
    let db = setup_test_db().await;
    let app = build_app!(db);
    let req = test::TestRequest::get()
        .uri("/api/v1/security/posture/categories")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;

    let categories = body["categories"].as_array().unwrap();
    assert_eq!(categories.len(), 5, "Should have 5 posture categories");

    let names: Vec<&str> = categories.iter().map(|c| c["name"].as_str().unwrap()).collect();
    assert!(names.contains(&"Identity & Access"));
    assert!(names.contains(&"Network Security"));
    assert!(names.contains(&"Data Protection"));
    assert!(names.contains(&"Compute Security"));
    assert!(names.contains(&"Logging & Monitoring"));

    for cat in categories {
        assert!(cat["score"].as_f64().unwrap() >= 0.0);
        assert!(cat["weight"].as_f64().unwrap() > 0.0);
    }
}

#[actix_web::test]
async fn test_posture_trend() {
    let db = setup_test_db().await;
    let app = build_app!(db);
    let req = test::TestRequest::get()
        .uri("/api/v1/security/posture/trend")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;

    let data_points = body["data_points"].as_array().unwrap();
    assert_eq!(data_points.len(), 30, "Should have 30 days of trend data");

    for dp in data_points {
        assert!(dp["timestamp"].as_str().is_some());
        let score = dp["score"].as_f64().unwrap();
        assert!(score >= 0.0 && score <= 100.0);
    }

    let direction = body["direction"].as_str().unwrap();
    assert!(
        ["improving", "stable", "declining"].contains(&direction),
        "Direction should be valid, got {}",
        direction
    );

    assert!(body["change_percent"].as_f64().is_some());
}

// ─── Vulnerabilities ─────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_vulnerabilities() {
    let db = setup_test_db().await;
    let app = build_app!(db);
    let req = test::TestRequest::get()
        .uri("/api/v1/security/vulnerabilities")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;

    let total = body["total"].as_u64().unwrap();
    assert!(total >= 15, "Should have at least 15 seeded vulnerabilities, got {}", total);

    let vulns = body["vulnerabilities"].as_array().unwrap();
    assert!(vulns.len() > 0);

    let summary = &body["summary"];
    assert!(summary["critical"].as_u64().unwrap() > 0);
    assert!(summary["high"].as_u64().unwrap() > 0);
    assert!(summary["medium"].as_u64().unwrap() > 0);
}

#[actix_web::test]
async fn test_filter_vulnerabilities_by_severity() {
    let db = setup_test_db().await;
    let app = build_app!(db);

    let req = test::TestRequest::get()
        .uri("/api/v1/security/vulnerabilities?severity=critical")
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;

    let vulns = body["vulnerabilities"].as_array().unwrap();
    assert!(vulns.len() > 0, "Should have critical vulnerabilities");

    for vuln in vulns {
        assert_eq!(vuln["severity"], "critical", "Filtered results should all be critical");
    }

    // Summary should still reflect all vulnerabilities (unfiltered)
    let summary = &body["summary"];
    assert!(summary["high"].as_u64().unwrap() > 0);
}

#[actix_web::test]
async fn test_get_vulnerability() {
    let db = setup_test_db().await;
    let app = build_app!(db);

    // List vulnerabilities to get a real ID
    let req = test::TestRequest::get().uri("/api/v1/security/vulnerabilities").to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    let vulns = body["vulnerabilities"].as_array().unwrap();
    let vuln_id = vulns[0]["id"].as_str().unwrap();

    // Get specific vulnerability
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/security/vulnerabilities/{}", vuln_id))
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["id"], vuln_id);
    assert!(body["title"].as_str().is_some());
    assert!(body["severity"].as_str().is_some());
    assert!(body["cvss_score"].as_f64().is_some());
    assert!(body["affected_resources"].as_array().is_some());
}

#[actix_web::test]
async fn test_scan_vulnerabilities() {
    let db = setup_test_db().await;
    let app = build_app!(db);

    let payload = serde_json::json!({
        "target": "new-target.example.com",
        "scan_depth": "deep"
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/security/vulnerabilities/scan")
        .set_json(&payload)
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 202);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["target"], "new-target.example.com");
    assert_eq!(body["status"], "pending");
    assert!(body["scan_id"].as_str().is_some());
}

// ─── DDoS Tests ──────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_create_ddos_test() {
    let db = setup_test_db().await;
    let app = build_app!(db);

    let payload = serde_json::json!({
        "target": "test-target.example.com",
        "duration_seconds": 120,
        "attack_type": "http_flood",
        "rate_limit": 1000,
        "authorization_document_id": "AUTH-TEST-001",
        "authorized_by": "test-admin@example.com"
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/security/ddos-tests")
        .set_json(&payload)
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 201);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["target"], "test-target.example.com");
    assert_eq!(body["attack_type"], "http_flood");
    assert_eq!(body["status"], "pending");
    assert_eq!(body["authorization_document_id"], "AUTH-TEST-001");
    assert_eq!(body["authorized_by"], "test-admin@example.com");
    assert!(body["id"].as_str().is_some());
}

#[actix_web::test]
async fn test_create_ddos_without_auth() {
    let db = setup_test_db().await;
    let app = build_app!(db);

    let payload = serde_json::json!({
        "target": "test-target.example.com",
        "duration_seconds": 120,
        "attack_type": "http_flood",
        "rate_limit": 1000,
        "authorization_document_id": "",
        "authorized_by": "test-admin@example.com"
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/security/ddos-tests")
        .set_json(&payload)
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 403);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["error"], "ddos_not_authorized");
}

#[actix_web::test]
async fn test_stop_ddos_test() {
    let db = setup_test_db().await;
    let app = build_app!(db);

    // First create a test
    let payload = serde_json::json!({
        "target": "stop-me.example.com",
        "duration_seconds": 60,
        "attack_type": "syn_flood",
        "rate_limit": 500,
        "authorization_document_id": "AUTH-STOP-001",
        "authorized_by": "admin@example.com"
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/security/ddos-tests")
        .set_json(&payload)
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);
    let created: Value = test::read_body_json(resp).await;
    let test_id = created["id"].as_str().unwrap();

    // Stop it
    let req = test::TestRequest::post()
        .uri(&format!("/api/v1/security/ddos-tests/{}/stop", test_id))
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "stopped");
    assert!(!body["stopped_at"].is_null(), "stopped_at should not be null");
    assert!(body["message"].as_str().unwrap().contains("kill switch"));
}

#[actix_web::test]
async fn test_get_ddos_results() {
    let db = setup_test_db().await;
    let app = build_app!(db);

    // Create a DDoS test first
    let payload = serde_json::json!({
        "target": "results-target.example.com",
        "duration_seconds": 60,
        "attack_type": "http_flood",
        "rate_limit": 500,
        "authorization_document_id": "AUTH-RES-001",
        "authorized_by": "admin@example.com"
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/security/ddos-tests")
        .set_json(&payload)
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);
    let created: Value = test::read_body_json(resp).await;
    let test_id = created["id"].as_str().unwrap();

    // Get results
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/security/ddos-tests/{}", test_id))
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["id"], test_id);
    assert_eq!(body["target"], "results-target.example.com");
    assert!(body["total_requests_sent"].as_u64().is_some());
    assert!(body["avg_response_time_ms"].as_f64().is_some());
}

#[actix_web::test]
async fn test_ddos_audit_trail() {
    let db = setup_test_db().await;
    let app = build_app!(db);

    // Create a test and then stop it to generate audit entries
    let payload = serde_json::json!({
        "target": "audit-target.example.com",
        "duration_seconds": 60,
        "attack_type": "http_flood",
        "rate_limit": 500,
        "authorization_document_id": "AUTH-AUDIT-001",
        "authorized_by": "auditor@example.com"
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/security/ddos-tests")
        .set_json(&payload)
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);
    let created: Value = test::read_body_json(resp).await;
    let test_id = created["id"].as_str().unwrap();

    // Stop it to generate another audit entry
    let req = test::TestRequest::post()
        .uri(&format!("/api/v1/security/ddos-tests/{}/stop", test_id))
        .to_request();
    let resp: actix_web::dev::ServiceResponse = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // Get audit trail
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/security/ddos-tests/{}/audit", test_id))
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["test_id"], test_id);

    let entries = body["audit_entries"].as_array().unwrap();
    assert!(
        entries.len() >= 2,
        "Should have at least 2 audit entries (create + stop), got {}",
        entries.len()
    );

    let first = &entries[0];
    assert!(first["action"].as_str().is_some());
    assert!(first["performed_by"].as_str().is_some());
    assert!(first["timestamp"].as_str().is_some());

    let actions: Vec<&str> = entries.iter().map(|e| e["action"].as_str().unwrap()).collect();
    assert!(actions.contains(&"test_created"));
    assert!(actions.contains(&"test_stopped"));
}

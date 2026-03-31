use chrono::Utc;
use serde::Deserialize;
use tokio::process::Command;
use uuid::Uuid;

use crate::models::scan::{Finding, FindingStatus, ScanStatus, SecurityScan, Severity};

// ---------------------------------------------------------------------------
// Trivy JSON output structures
// ---------------------------------------------------------------------------
#[derive(Debug, Deserialize)]
struct TrivyOutput {
    #[serde(rename = "Results", default)]
    results: Vec<TrivyResult>,
}

#[derive(Debug, Deserialize)]
struct TrivyResult {
    #[serde(rename = "Target", default)]
    target: String,
    #[serde(rename = "Vulnerabilities", default)]
    vulnerabilities: Vec<TrivyVulnerability>,
}

#[derive(Debug, Deserialize)]
struct TrivyVulnerability {
    #[serde(rename = "VulnerabilityID", default)]
    vulnerability_id: String,
    #[serde(rename = "Title", default)]
    title: String,
    #[serde(rename = "Description", default)]
    description: String,
    #[serde(rename = "Severity", default)]
    severity: String,
    #[serde(rename = "PkgName", default)]
    pkg_name: String,
    #[serde(rename = "InstalledVersion", default)]
    installed_version: String,
    #[serde(rename = "FixedVersion", default)]
    fixed_version: String,
    #[serde(rename = "CVSS", default)]
    cvss: Option<serde_json::Value>,
}

// ---------------------------------------------------------------------------
// Nuclei JSONL output structure
// ---------------------------------------------------------------------------
#[derive(Debug, Deserialize)]
struct NucleiResult {
    #[serde(default)]
    info: NucleiInfo,
    #[serde(default)]
    host: String,
    #[serde(rename = "matched-at", default)]
    matched_at: String,
    #[serde(rename = "template-id", default)]
    template_id: String,
}

#[derive(Debug, Default, Deserialize)]
struct NucleiInfo {
    #[serde(default)]
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    severity: String,
    #[serde(default)]
    remediation: String,
    #[serde(default)]
    classification: Option<NucleiClassification>,
}

#[derive(Debug, Deserialize)]
struct NucleiClassification {
    #[serde(rename = "cvss-score", default)]
    cvss_score: Option<f64>,
}

// ---------------------------------------------------------------------------
// ZAP API alert structure
// ---------------------------------------------------------------------------
#[derive(Debug, Deserialize)]
struct ZapAlertsResponse {
    #[serde(default)]
    alerts: Vec<ZapAlert>,
}

#[derive(Debug, Deserialize)]
struct ZapAlert {
    #[serde(default)]
    name: String,
    #[serde(default)]
    risk: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    solution: String,
    #[serde(default)]
    url: String,
    #[serde(rename = "cweid", default)]
    cwe_id: String,
}

// ---------------------------------------------------------------------------
// DB-backed scan execution (public entry point for handlers)
// ---------------------------------------------------------------------------

/// Execute a scan asynchronously, updating SurrealDB with progress and results.
pub async fn execute_scan_with_db(
    db: &cloud_common::Database,
    scan_id: Uuid,
    scan_type: &str,
    target: &str,
) {
    tracing::info!(scan_id = %scan_id, scan_type = %scan_type, target = %target, "Starting scan execution");

    // Mark as Running
    update_scan_status_db(db, scan_id, ScanStatus::Running).await;

    let result = match scan_type {
        "vapt" | "vulnerability" => run_trivy(target).await,
        "pentest" => run_nuclei(target).await,
        "ddos_test" => {
            tracing::info!(scan_id = %scan_id, "DDoS scans are handled by the ddos-test endpoint");
            Ok(vec![])
        }
        other => {
            tracing::warn!(scan_type = %other, "Unknown scan type, attempting trivy");
            run_trivy(target).await
        }
    };

    match result {
        Ok(findings) => {
            let count = findings.len();
            tracing::info!(scan_id = %scan_id, findings = count, "Scan completed successfully");
            store_findings_and_complete_db(db, scan_id, findings).await;
        }
        Err(e) => {
            tracing::error!(scan_id = %scan_id, error = %e, "Scan failed");
            update_scan_status_with_error_db(db, scan_id, &format!("{}", e)).await;
        }
    }
}

// -----------------------------------------------------------------------
// Trivy: container image and filesystem scanning
// -----------------------------------------------------------------------
async fn run_trivy(target: &str) -> Result<Vec<Finding>, anyhow::Error> {
    // Detect whether the target looks like a container image or a filesystem path
    let (subcommand, label) = if target.starts_with('/') || target.starts_with('.') {
        ("fs", "filesystem")
    } else {
        ("image", "container image")
    };

    tracing::info!(target = %target, mode = %label, "Running Trivy scan");

    let output = Command::new("trivy")
        .args([subcommand, "--format", "json", "--quiet", target])
        .output()
        .await
        .map_err(|e| {
            anyhow::anyhow!(
                "Failed to execute trivy (is it installed and in PATH?): {}",
                e
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("Trivy exited with {}: {}", output.status, stderr));
    }

    let parsed: TrivyOutput = serde_json::from_slice(&output.stdout)
        .map_err(|e| anyhow::anyhow!("Failed to parse Trivy JSON output: {}", e))?;

    let findings: Vec<Finding> = parsed
        .results
        .into_iter()
        .flat_map(|r| {
            let result_target = r.target.clone();
            r.vulnerabilities.into_iter().map(move |v| {
                let severity = map_severity(&v.severity);
                let cvss_score = extract_cvss_score(&v.cvss).unwrap_or(0.0);
                let remediation = if v.fixed_version.is_empty() {
                    "No fix version available yet. Monitor for upstream patches.".to_string()
                } else {
                    format!("Upgrade {} from {} to {}", v.pkg_name, v.installed_version, v.fixed_version)
                };
                Finding {
                    id: Uuid::new_v4(),
                    title: if v.title.is_empty() {
                        format!("{} in {}", v.vulnerability_id, v.pkg_name)
                    } else {
                        v.title
                    },
                    severity,
                    cvss_score,
                    description: v.description,
                    remediation,
                    affected_resource: format!("{} ({}@{})", result_target, v.pkg_name, v.installed_version),
                    category: "Vulnerable Dependencies".to_string(),
                    status: FindingStatus::Open,
                }
            })
        })
        .collect();

    Ok(findings)
}

// -----------------------------------------------------------------------
// Nuclei: template-based vulnerability scanning
// -----------------------------------------------------------------------
async fn run_nuclei(target: &str) -> Result<Vec<Finding>, anyhow::Error> {
    tracing::info!(target = %target, "Running Nuclei scan");

    let output = Command::new("nuclei")
        .args(["-u", target, "-jsonl", "-silent"])
        .output()
        .await
        .map_err(|e| {
            anyhow::anyhow!(
                "Failed to execute nuclei (is it installed and in PATH?): {}",
                e
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if output.stdout.is_empty() {
            return Err(anyhow::anyhow!("Nuclei exited with {}: {}", output.status, stderr));
        }
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let findings: Vec<Finding> = stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| {
            let nr: NucleiResult = match serde_json::from_str(line) {
                Ok(v) => v,
                Err(e) => {
                    tracing::warn!(error = %e, line = %line, "Skipping unparseable Nuclei line");
                    return None;
                }
            };
            let severity = map_severity(&nr.info.severity);
            let cvss_score = nr
                .info
                .classification
                .as_ref()
                .and_then(|c| c.cvss_score)
                .unwrap_or(0.0);
            Some(Finding {
                id: Uuid::new_v4(),
                title: nr.info.name,
                severity,
                cvss_score,
                description: nr.info.description,
                remediation: if nr.info.remediation.is_empty() {
                    "Refer to the Nuclei template documentation for remediation guidance.".to_string()
                } else {
                    nr.info.remediation
                },
                affected_resource: if nr.matched_at.is_empty() {
                    nr.host
                } else {
                    nr.matched_at
                },
                category: format!("nuclei/{}", nr.template_id),
                status: FindingStatus::Open,
            })
        })
        .collect();

    Ok(findings)
}

// -----------------------------------------------------------------------
// ZAP: web application scanning via the ZAP REST API
// -----------------------------------------------------------------------
#[allow(dead_code)]
async fn run_zap_scan(target: &str) -> Result<Vec<Finding>, anyhow::Error> {
    let zap_base =
        std::env::var("ZAP_API_URL").unwrap_or_else(|_| "http://localhost:8090".to_string());
    let api_key = std::env::var("ZAP_API_KEY").unwrap_or_default();

    tracing::info!(target = %target, zap_base = %zap_base, "Running ZAP spider + active scan");

    // 1. Start the spider
    let client = reqwest::Client::new();
    let _spider = client
        .get(format!(
            "{}/JSON/spider/action/scan/?apikey={}&url={}",
            zap_base, api_key, target
        ))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("ZAP spider request failed (is ZAP running?): {}", e))?;

    // Wait briefly for spider to finish (real impl would poll status)
    tokio::time::sleep(std::time::Duration::from_secs(10)).await;

    // 2. Start active scan
    let _scan = client
        .get(format!(
            "{}/JSON/ascan/action/scan/?apikey={}&url={}",
            zap_base, api_key, target
        ))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("ZAP active scan request failed: {}", e))?;

    // Poll for completion (simplified: wait fixed time)
    tokio::time::sleep(std::time::Duration::from_secs(30)).await;

    // 3. Fetch alerts
    let alerts_resp = client
        .get(format!(
            "{}/JSON/alert/view/alerts/?apikey={}&baseurl={}",
            zap_base, api_key, target
        ))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("ZAP alerts fetch failed: {}", e))?;

    let body = alerts_resp.text().await?;
    let zap_alerts: ZapAlertsResponse = serde_json::from_str(&body)
        .map_err(|e| anyhow::anyhow!("Failed to parse ZAP alerts JSON: {}", e))?;

    let findings: Vec<Finding> = zap_alerts
        .alerts
        .into_iter()
        .map(|a| {
            let severity = map_severity(&a.risk);
            Finding {
                id: Uuid::new_v4(),
                title: a.name,
                severity,
                cvss_score: 0.0,
                description: a.description,
                remediation: a.solution,
                affected_resource: a.url,
                category: format!("CWE-{}", a.cwe_id),
                status: FindingStatus::Open,
            }
        })
        .collect();

    Ok(findings)
}

// -----------------------------------------------------------------------
// DB helpers for scan engine
// -----------------------------------------------------------------------
async fn update_scan_status_db(db: &cloud_common::Database, scan_id: Uuid, status: ScanStatus) {
    let id_str = scan_id.to_string();
    if let Ok(Some(mut scan)) = db.get::<SecurityScan>("security_scans", &id_str).await {
        scan.status = status;
        let _ = db.update("security_scans", &id_str, scan).await;
    }
}

async fn store_findings_and_complete_db(db: &cloud_common::Database, scan_id: Uuid, findings: Vec<Finding>) {
    let id_str = scan_id.to_string();
    if let Ok(Some(mut scan)) = db.get::<SecurityScan>("security_scans", &id_str).await {
        scan.findings = findings;
        scan.status = ScanStatus::Completed;
        scan.completed_at = Some(Utc::now());
        let _ = db.update("security_scans", &id_str, scan).await;
    }
}

async fn update_scan_status_with_error_db(db: &cloud_common::Database, scan_id: Uuid, error_msg: &str) {
    let id_str = scan_id.to_string();
    if let Ok(Some(mut scan)) = db.get::<SecurityScan>("security_scans", &id_str).await {
        scan.status = ScanStatus::Failed;
        scan.completed_at = Some(Utc::now());
        scan.metadata = serde_json::json!({
            "error": error_msg,
            "original_metadata": scan.metadata.clone(),
        });
        let _ = db.update("security_scans", &id_str, scan).await;
    }
}

// ---------------------------------------------------------------------------
// DDoS load test engine (DB-backed)
// ---------------------------------------------------------------------------

/// Parsed metrics from a load test run.
#[derive(Debug, Default)]
pub struct LoadTestMetrics {
    pub total_requests: u64,
    pub successful: u64,
    pub failed: u64,
    pub avg_response_ms: f64,
    pub max_response_ms: f64,
}

/// Execute a load test against `target` for `duration_seconds` at `rate` RPS.
/// Updates the DDoS test record in SurrealDB.
pub async fn execute_load_test_with_db(
    db: &cloud_common::Database,
    test_id: Uuid,
    target: &str,
    duration_seconds: u64,
    rate: u64,
) {
    use crate::handlers::ddos::DdosTestStatus;

    tracing::info!(test_id = %test_id, target = %target, "Starting load test execution");

    // Mark Running
    update_ddos_status_db(db, test_id, DdosTestStatus::Running).await;

    let result = run_hey(target, duration_seconds, rate)
        .await
        .or_else(|e| {
            tracing::warn!(error = %e, "hey not available, trying curl fallback");
            Err(e)
        });

    // If hey failed, try curl-based sequential requests as last resort
    let result = match result {
        Ok(m) => Ok(m),
        Err(_) => run_curl_fallback(target, duration_seconds, rate).await,
    };

    match result {
        Ok(metrics) => {
            tracing::info!(test_id = %test_id, total = metrics.total_requests, "Load test completed");
            store_ddos_results_db(db, test_id, &metrics, DdosTestStatus::Completed).await;
        }
        Err(e) => {
            tracing::error!(test_id = %test_id, error = %e, "Load test failed");
            store_ddos_results_db(
                db,
                test_id,
                &LoadTestMetrics::default(),
                DdosTestStatus::Failed,
            )
            .await;
        }
    }
}

/// Use the `hey` HTTP load generator.
async fn run_hey(
    target: &str,
    duration_seconds: u64,
    rate: u64,
) -> Result<LoadTestMetrics, anyhow::Error> {
    let output = Command::new("hey")
        .args([
            "-z",
            &format!("{}s", duration_seconds),
            "-q",
            &rate.to_string(),
            "-c",
            &std::cmp::min(rate, 200).to_string(),
            target,
        ])
        .output()
        .await
        .map_err(|e| anyhow::anyhow!("Failed to execute hey: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("hey exited with {}: {}", output.status, stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_hey_output(&stdout))
}

/// Fallback: send sequential curl requests for the specified duration.
async fn run_curl_fallback(
    target: &str,
    duration_seconds: u64,
    _rate: u64,
) -> Result<LoadTestMetrics, anyhow::Error> {
    tracing::info!("Falling back to curl-based load test");

    let deadline = tokio::time::Instant::now()
        + std::time::Duration::from_secs(duration_seconds);
    let mut total: u64 = 0;
    let mut success: u64 = 0;
    let mut failed: u64 = 0;
    let mut max_ms: f64 = 0.0;
    let mut sum_ms: f64 = 0.0;

    while tokio::time::Instant::now() < deadline {
        let start = std::time::Instant::now();
        let output = Command::new("curl")
            .args(["-s", "-o", "/dev/null", "-w", "%{http_code} %{time_total}", target])
            .output()
            .await
            .map_err(|e| anyhow::anyhow!("curl not available: {}", e))?;

        let elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;
        total += 1;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let parts: Vec<&str> = stdout.trim().split_whitespace().collect();
        let status_code: u16 = parts
            .first()
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        if (200..400).contains(&status_code) {
            success += 1;
        } else {
            failed += 1;
        }

        if elapsed_ms > max_ms {
            max_ms = elapsed_ms;
        }
        sum_ms += elapsed_ms;
    }

    Ok(LoadTestMetrics {
        total_requests: total,
        successful: success,
        failed,
        avg_response_ms: if total > 0 { sum_ms / total as f64 } else { 0.0 },
        max_response_ms: max_ms,
    })
}

async fn update_ddos_status_db(
    db: &cloud_common::Database,
    test_id: Uuid,
    status: crate::handlers::ddos::DdosTestStatus,
) {
    let id_str = test_id.to_string();
    if let Ok(Some(mut test)) = db.get::<crate::handlers::ddos::DdosTestResult>("ddos_tests", &id_str).await {
        test.status = status;
        let _ = db.update("ddos_tests", &id_str, test).await;
    }
}

async fn store_ddos_results_db(
    db: &cloud_common::Database,
    test_id: Uuid,
    metrics: &LoadTestMetrics,
    status: crate::handlers::ddos::DdosTestStatus,
) {
    let id_str = test_id.to_string();
    if let Ok(Some(mut test)) = db.get::<crate::handlers::ddos::DdosTestResult>("ddos_tests", &id_str).await {
        test.status = status;
        test.total_requests_sent = metrics.total_requests;
        test.successful_responses = metrics.successful;
        test.failed_responses = metrics.failed;
        test.avg_response_time_ms = metrics.avg_response_ms;
        test.max_response_time_ms = metrics.max_response_ms;
        test.completed_at = Some(Utc::now());
        let _ = db.update("ddos_tests", &id_str, test).await;
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn map_severity(s: &str) -> Severity {
    match s.to_uppercase().as_str() {
        "CRITICAL" => Severity::Critical,
        "HIGH" => Severity::High,
        "MEDIUM" | "MODERATE" => Severity::Medium,
        "LOW" => Severity::Low,
        _ => Severity::Info,
    }
}

fn extract_cvss_score(cvss: &Option<serde_json::Value>) -> Option<f64> {
    let map = cvss.as_ref()?.as_object()?;
    // Trivy CVSS structure: { "nvd": { "V3Score": 7.5 }, ... }
    for (_source, data) in map {
        if let Some(score) = data.get("V3Score").and_then(|v| v.as_f64()) {
            return Some(score);
        }
    }
    None
}

/// Parse the human-readable summary output from `hey`.
fn parse_hey_output(output: &str) -> LoadTestMetrics {
    let mut metrics = LoadTestMetrics::default();

    for line in output.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("Average:") {
            if let Some(val) = extract_seconds_from_hey_line(trimmed) {
                metrics.avg_response_ms = val * 1000.0;
            }
        } else if trimmed.starts_with("Slowest:") {
            if let Some(val) = extract_seconds_from_hey_line(trimmed) {
                metrics.max_response_ms = val * 1000.0;
            }
        } else if trimmed.contains("requests in") {
            if let Some(n) = trimmed.split_whitespace().next().and_then(|s| s.parse::<u64>().ok()) {
                metrics.total_requests = n;
            }
        } else if trimmed.starts_with("[200]") || trimmed.starts_with("[201]") || trimmed.starts_with("[204]") {
            if let Some(n) = trimmed.split_whitespace().nth(1).and_then(|s| s.parse::<u64>().ok()) {
                metrics.successful += n;
            }
        }
    }

    if metrics.total_requests > 0 && metrics.successful > 0 {
        metrics.failed = metrics.total_requests.saturating_sub(metrics.successful);
    }

    metrics
}

fn extract_seconds_from_hey_line(line: &str) -> Option<f64> {
    line.split_whitespace()
        .find(|token| token.parse::<f64>().is_ok())
        .and_then(|t| t.parse::<f64>().ok())
}

use chrono::{Duration, Utc};
use uuid::Uuid;

use crate::handlers::ddos::{AuditEntry, DdosTestResult, DdosTestStatus};
use crate::handlers::vulnerability::{Vulnerability, VulnerabilityStatus};
use crate::models::compliance::{
    AssessmentSummary, ComplianceAssessment, ComplianceControl, ComplianceFramework, ControlStatus,
};
use crate::models::scan::{
    Finding, FindingStatus, ScanStatus, ScanType, SecurityScan, Severity,
};

/// Seed the SurrealDB tables if empty. Preserves all original seed data.
pub async fn seed_if_empty(db: &cloud_common::Database) {
    // Check if already seeded
    let existing: Vec<SecurityScan> = db.list("security_scans").await.unwrap_or_default();
    if !existing.is_empty() {
        tracing::info!("SurrealDB security tables already seeded ({} scans)", existing.len());
        return;
    }

    tracing::info!("Seeding SurrealDB security tables...");

    {
        let mut scans = Vec::new();
        let mut vulnerabilities = Vec::new();
        let mut ddos_tests = Vec::new();
        let mut audit_entries = Vec::new();
        let mut compliance_assessments = Vec::new();

        // -------------------------------------------------------
        // Seed scans & findings
        // -------------------------------------------------------
        let now = Utc::now();

        // Scan 1: VAPT on prod-api.example.com - completed, 12 findings
        let scan1_id = Uuid::new_v4();
        let scan1_findings = vec![
            Finding {
                id: Uuid::new_v4(),
                title: "SQL Injection in /api/v1/users".to_string(),
                severity: Severity::Critical,
                cvss_score: 9.8,
                description: "The users endpoint is vulnerable to SQL injection via the 'id' parameter. An attacker can extract sensitive data from the database.".to_string(),
                remediation: "Use parameterized queries or prepared statements. Validate and sanitize all user inputs.".to_string(),
                affected_resource: "prod-api.example.com/api/v1/users".to_string(),
                category: "Injection".to_string(),
                status: FindingStatus::Open,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "Exposed AWS Credentials in Environment Variables".to_string(),
                severity: Severity::Critical,
                cvss_score: 9.9,
                description: "AWS access keys were found exposed in application environment variables accessible via the /debug/env endpoint.".to_string(),
                remediation: "Remove credentials from environment variables. Use IAM roles or AWS Secrets Manager. Rotate compromised keys immediately.".to_string(),
                affected_resource: "prod-api.example.com/debug/env".to_string(),
                category: "Secrets Management".to_string(),
                status: FindingStatus::Open,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "Cross-Site Scripting in Search Endpoint".to_string(),
                severity: Severity::High,
                cvss_score: 7.5,
                description: "Reflected XSS vulnerability in the search endpoint. User input in the 'q' parameter is rendered without sanitization.".to_string(),
                remediation: "Implement output encoding. Use Content-Security-Policy headers. Sanitize all user inputs before rendering.".to_string(),
                affected_resource: "prod-api.example.com/api/v1/search".to_string(),
                category: "Cross-Site Scripting".to_string(),
                status: FindingStatus::Acknowledged,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "Outdated OpenSSL Library CVE-2024-0727".to_string(),
                severity: Severity::High,
                cvss_score: 7.4,
                description: "The server is running OpenSSL 1.1.1w which is vulnerable to CVE-2024-0727, allowing denial of service via malformed PKCS12 files.".to_string(),
                remediation: "Upgrade OpenSSL to version 3.0.13 or later. Apply vendor security patches.".to_string(),
                affected_resource: "prod-api.example.com".to_string(),
                category: "Vulnerable Dependencies".to_string(),
                status: FindingStatus::Open,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "Insecure Direct Object Reference in /api/v1/orders".to_string(),
                severity: Severity::High,
                cvss_score: 7.1,
                description: "Users can access other users' order data by manipulating the order ID parameter without proper authorization checks.".to_string(),
                remediation: "Implement proper authorization checks. Validate that the requesting user owns the requested resource.".to_string(),
                affected_resource: "prod-api.example.com/api/v1/orders".to_string(),
                category: "Broken Access Control".to_string(),
                status: FindingStatus::Open,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "TLS 1.0 Enabled".to_string(),
                severity: Severity::Medium,
                cvss_score: 5.3,
                description: "The server accepts TLS 1.0 connections which are considered insecure and vulnerable to BEAST and POODLE attacks.".to_string(),
                remediation: "Disable TLS 1.0 and TLS 1.1. Configure the server to only accept TLS 1.2 and TLS 1.3.".to_string(),
                affected_resource: "prod-api.example.com:443".to_string(),
                category: "Transport Security".to_string(),
                status: FindingStatus::Remediated,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "Weak Password Policy".to_string(),
                severity: Severity::Medium,
                cvss_score: 5.0,
                description: "The application allows passwords with fewer than 8 characters and does not enforce complexity requirements.".to_string(),
                remediation: "Enforce minimum 12-character passwords with complexity requirements. Implement bcrypt or argon2 for password hashing.".to_string(),
                affected_resource: "prod-api.example.com/api/v1/auth".to_string(),
                category: "Authentication".to_string(),
                status: FindingStatus::Open,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "Missing Rate Limiting on Authentication Endpoint".to_string(),
                severity: Severity::Medium,
                cvss_score: 5.9,
                description: "The login endpoint does not implement rate limiting, allowing brute force attacks on user credentials.".to_string(),
                remediation: "Implement rate limiting (e.g., 5 attempts per minute). Add account lockout after consecutive failures. Consider CAPTCHA after failed attempts.".to_string(),
                affected_resource: "prod-api.example.com/api/v1/auth/login".to_string(),
                category: "Authentication".to_string(),
                status: FindingStatus::Open,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "CORS Misconfiguration Allows Wildcard Origin".to_string(),
                severity: Severity::Medium,
                cvss_score: 4.7,
                description: "The server returns Access-Control-Allow-Origin: * which allows any origin to make cross-origin requests.".to_string(),
                remediation: "Configure CORS to only allow trusted origins. Remove wildcard (*) origin configuration.".to_string(),
                affected_resource: "prod-api.example.com".to_string(),
                category: "Security Misconfiguration".to_string(),
                status: FindingStatus::Acknowledged,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "Missing Content-Security-Policy Header".to_string(),
                severity: Severity::Low,
                cvss_score: 3.1,
                description: "The application does not set a Content-Security-Policy header, increasing the risk of XSS and data injection attacks.".to_string(),
                remediation: "Add a Content-Security-Policy header with appropriate directives for script-src, style-src, and other resource types.".to_string(),
                affected_resource: "prod-api.example.com".to_string(),
                category: "Security Headers".to_string(),
                status: FindingStatus::Open,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "Missing X-Frame-Options Header".to_string(),
                severity: Severity::Low,
                cvss_score: 3.0,
                description: "The X-Frame-Options header is not set, potentially allowing clickjacking attacks.".to_string(),
                remediation: "Set the X-Frame-Options header to DENY or SAMEORIGIN.".to_string(),
                affected_resource: "prod-api.example.com".to_string(),
                category: "Security Headers".to_string(),
                status: FindingStatus::Open,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "Server Version Disclosure".to_string(),
                severity: Severity::Info,
                cvss_score: 0.0,
                description: "The server discloses version information in the Server HTTP header (nginx/1.24.0).".to_string(),
                remediation: "Configure the web server to suppress version information in response headers.".to_string(),
                affected_resource: "prod-api.example.com".to_string(),
                category: "Information Disclosure".to_string(),
                status: FindingStatus::Accepted,
            },
        ];
        scans.push((scan1_id, SecurityScan {
            id: scan1_id,
            scan_type: ScanType::Vapt,
            target: "prod-api.example.com".to_string(),
            status: ScanStatus::Completed,
            findings: scan1_findings,
            started_at: now - Duration::hours(48),
            completed_at: Some(now - Duration::hours(46)),
            created_by: "security-team".to_string(),
            metadata: serde_json::json!({"scan_profile": "full", "authenticated": true}),
        }));

        // Scan 2: Vulnerability scan on 10.0.0.0/16 - completed, 8 findings
        let scan2_id = Uuid::new_v4();
        let scan2_findings = vec![
            Finding {
                id: Uuid::new_v4(),
                title: "Apache Log4j Remote Code Execution (CVE-2021-44228)".to_string(),
                severity: Severity::Critical,
                cvss_score: 10.0,
                description: "Log4j vulnerability detected on internal service allowing remote code execution via JNDI lookup.".to_string(),
                remediation: "Upgrade Log4j to version 2.17.1 or later. Set log4j2.formatMsgNoLookups=true as immediate mitigation.".to_string(),
                affected_resource: "10.0.1.45:8080".to_string(),
                category: "Vulnerable Dependencies".to_string(),
                status: FindingStatus::Remediated,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "SSH Server Using Weak Key Exchange Algorithms".to_string(),
                severity: Severity::High,
                cvss_score: 7.0,
                description: "SSH server accepts weak key exchange algorithms including diffie-hellman-group1-sha1.".to_string(),
                remediation: "Configure SSH to only use strong key exchange algorithms such as curve25519-sha256 or diffie-hellman-group16-sha512.".to_string(),
                affected_resource: "10.0.2.10:22".to_string(),
                category: "Transport Security".to_string(),
                status: FindingStatus::Open,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "Unpatched Redis Server Exposed".to_string(),
                severity: Severity::High,
                cvss_score: 7.2,
                description: "Redis 6.0.9 is running without authentication and is accessible from the internal network.".to_string(),
                remediation: "Enable Redis authentication with a strong password. Restrict network access via firewall rules. Upgrade to latest version.".to_string(),
                affected_resource: "10.0.3.20:6379".to_string(),
                category: "Security Misconfiguration".to_string(),
                status: FindingStatus::Open,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "PostgreSQL Default Credentials".to_string(),
                severity: Severity::Medium,
                cvss_score: 6.5,
                description: "PostgreSQL database is accessible with default 'postgres' credentials from the internal network.".to_string(),
                remediation: "Change default credentials immediately. Implement strong password policy for database accounts. Restrict network access.".to_string(),
                affected_resource: "10.0.3.25:5432".to_string(),
                category: "Authentication".to_string(),
                status: FindingStatus::Remediated,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "SMB Signing Not Required".to_string(),
                severity: Severity::Medium,
                cvss_score: 5.4,
                description: "SMB signing is not required on the file server, allowing potential man-in-the-middle attacks.".to_string(),
                remediation: "Enable mandatory SMB signing in Group Policy or server configuration.".to_string(),
                affected_resource: "10.0.1.100:445".to_string(),
                category: "Transport Security".to_string(),
                status: FindingStatus::Open,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "SNMP Community String 'public'".to_string(),
                severity: Severity::Medium,
                cvss_score: 5.0,
                description: "Network device responds to SNMP queries with the default community string 'public'.".to_string(),
                remediation: "Change SNMP community strings to non-default values. Consider upgrading to SNMPv3 with authentication.".to_string(),
                affected_resource: "10.0.0.1:161".to_string(),
                category: "Security Misconfiguration".to_string(),
                status: FindingStatus::Acknowledged,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "SSL Certificate Expiring Within 30 Days".to_string(),
                severity: Severity::Low,
                cvss_score: 3.7,
                description: "The SSL certificate for the internal API gateway expires in 22 days.".to_string(),
                remediation: "Renew the SSL certificate before expiration. Implement automated certificate management.".to_string(),
                affected_resource: "10.0.1.50:443".to_string(),
                category: "Transport Security".to_string(),
                status: FindingStatus::Open,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "NTP Service Information Disclosure".to_string(),
                severity: Severity::Info,
                cvss_score: 0.0,
                description: "NTP service responds to monlist queries, disclosing recently connected clients.".to_string(),
                remediation: "Disable monlist or restrict NTP service to trusted clients only.".to_string(),
                affected_resource: "10.0.0.5:123".to_string(),
                category: "Information Disclosure".to_string(),
                status: FindingStatus::Accepted,
            },
        ];
        scans.push((scan2_id, SecurityScan {
            id: scan2_id,
            scan_type: ScanType::Vulnerability,
            target: "10.0.0.0/16".to_string(),
            status: ScanStatus::Completed,
            findings: scan2_findings,
            started_at: now - Duration::hours(24),
            completed_at: Some(now - Duration::hours(22)),
            created_by: "vulnerability-scanner".to_string(),
            metadata: serde_json::json!({"scan_profile": "network", "port_range": "1-65535"}),
        }));

        // Scan 3: Pentest on staging.example.com - completed, 5 findings
        let scan3_id = Uuid::new_v4();
        let scan3_findings = vec![
            Finding {
                id: Uuid::new_v4(),
                title: "Server-Side Request Forgery (SSRF) in Webhook Handler".to_string(),
                severity: Severity::High,
                cvss_score: 8.1,
                description: "The webhook processing endpoint can be abused to make requests to internal services via crafted URLs.".to_string(),
                remediation: "Implement URL allowlisting for webhook targets. Block requests to internal IP ranges. Validate and sanitize URLs.".to_string(),
                affected_resource: "staging.example.com/api/v1/webhooks".to_string(),
                category: "Server-Side Request Forgery".to_string(),
                status: FindingStatus::Open,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "JWT Token Does Not Expire".to_string(),
                severity: Severity::High,
                cvss_score: 7.3,
                description: "JWT tokens issued by the authentication service have no expiration claim, allowing indefinite session hijacking.".to_string(),
                remediation: "Set appropriate token expiration (e.g., 15 minutes for access tokens). Implement token refresh mechanism.".to_string(),
                affected_resource: "staging.example.com/api/v1/auth/token".to_string(),
                category: "Authentication".to_string(),
                status: FindingStatus::Open,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "Debug Endpoints Accessible in Staging".to_string(),
                severity: Severity::Medium,
                cvss_score: 5.5,
                description: "Application debug endpoints (/debug/pprof, /debug/vars) are accessible without authentication.".to_string(),
                remediation: "Disable debug endpoints in staging. If needed, restrict access to authenticated admin users.".to_string(),
                affected_resource: "staging.example.com/debug/*".to_string(),
                category: "Security Misconfiguration".to_string(),
                status: FindingStatus::Remediated,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "Verbose Error Messages Expose Stack Traces".to_string(),
                severity: Severity::Low,
                cvss_score: 3.5,
                description: "Application returns detailed stack traces in error responses, revealing internal implementation details.".to_string(),
                remediation: "Implement generic error messages for production. Log detailed errors server-side only.".to_string(),
                affected_resource: "staging.example.com".to_string(),
                category: "Information Disclosure".to_string(),
                status: FindingStatus::Open,
            },
            Finding {
                id: Uuid::new_v4(),
                title: "Cookie Without Secure Flag".to_string(),
                severity: Severity::Low,
                cvss_score: 3.1,
                description: "Session cookies are set without the Secure flag, allowing transmission over unencrypted connections.".to_string(),
                remediation: "Set the Secure flag on all cookies. Also ensure HttpOnly and SameSite flags are set.".to_string(),
                affected_resource: "staging.example.com".to_string(),
                category: "Session Management".to_string(),
                status: FindingStatus::Open,
            },
        ];
        scans.push((scan3_id, SecurityScan {
            id: scan3_id,
            scan_type: ScanType::Pentest,
            target: "staging.example.com".to_string(),
            status: ScanStatus::Completed,
            findings: scan3_findings,
            started_at: now - Duration::hours(72),
            completed_at: Some(now - Duration::hours(68)),
            created_by: "pentest-team".to_string(),
            metadata: serde_json::json!({"scope": "web_application", "methodology": "OWASP"}),
        }));

        // Scan 4: Vulnerability scan on prod-cluster - running, 0 findings
        let scan4_id = Uuid::new_v4();
        scans.push((scan4_id, SecurityScan {
            id: scan4_id,
            scan_type: ScanType::Vulnerability,
            target: "prod-cluster".to_string(),
            status: ScanStatus::Running,
            findings: vec![],
            started_at: now - Duration::minutes(15),
            completed_at: None,
            created_by: "ci-pipeline".to_string(),
            metadata: serde_json::json!({"cluster": "prod-eks-01", "namespaces": ["default", "app", "monitoring"]}),
        }));

        // -------------------------------------------------------
        // Seed vulnerabilities (15-20 with CVEs)
        // -------------------------------------------------------
        vulnerabilities.extend(vec![
            Vulnerability {
                id: Uuid::new_v4(),
                cve_id: Some("CVE-2024-0727".to_string()),
                title: "OpenSSL PKCS12 Decoding Crash".to_string(),
                description: "Processing a maliciously crafted PKCS12 file can cause OpenSSL to crash leading to a denial of service attack.".to_string(),
                severity: Severity::High,
                cvss_score: 7.4,
                affected_resources: vec!["prod-api.example.com".to_string(), "staging.example.com".to_string()],
                remediation: "Upgrade OpenSSL to version 3.0.13, 3.1.5, or 3.2.1.".to_string(),
                patch_available: true,
                discovered_at: now - Duration::days(14),
                status: VulnerabilityStatus::InProgress,
            },
            Vulnerability {
                id: Uuid::new_v4(),
                cve_id: Some("CVE-2024-21626".to_string()),
                title: "runc Container Escape via /proc/self/fd".to_string(),
                description: "A file descriptor leak in runc allows container escape to the host filesystem.".to_string(),
                severity: Severity::Critical,
                cvss_score: 8.6,
                affected_resources: vec!["prod-cluster".to_string(), "staging-cluster".to_string()],
                remediation: "Upgrade runc to version 1.1.12 or later. Update container runtime.".to_string(),
                patch_available: true,
                discovered_at: now - Duration::days(10),
                status: VulnerabilityStatus::Open,
            },
            Vulnerability {
                id: Uuid::new_v4(),
                cve_id: Some("CVE-2024-3094".to_string()),
                title: "XZ Utils Backdoor".to_string(),
                description: "Malicious code was injected into XZ Utils versions 5.6.0 and 5.6.1, creating a backdoor in SSH authentication.".to_string(),
                severity: Severity::Critical,
                cvss_score: 10.0,
                affected_resources: vec!["build-server-01".to_string()],
                remediation: "Downgrade XZ Utils to version 5.4.x. Audit systems for signs of compromise.".to_string(),
                patch_available: true,
                discovered_at: now - Duration::days(7),
                status: VulnerabilityStatus::Remediated,
            },
            Vulnerability {
                id: Uuid::new_v4(),
                cve_id: Some("CVE-2023-44487".to_string()),
                title: "HTTP/2 Rapid Reset Attack (DDoS)".to_string(),
                description: "An attacker can abuse HTTP/2 stream reset functionality to cause excessive resource consumption on the server.".to_string(),
                severity: Severity::High,
                cvss_score: 7.5,
                affected_resources: vec!["prod-api.example.com".to_string(), "cdn.example.com".to_string()],
                remediation: "Update web server software. Configure HTTP/2 stream limits. Apply vendor patches.".to_string(),
                patch_available: true,
                discovered_at: now - Duration::days(30),
                status: VulnerabilityStatus::Remediated,
            },
            Vulnerability {
                id: Uuid::new_v4(),
                cve_id: Some("CVE-2024-1086".to_string()),
                title: "Linux Kernel nf_tables Use-After-Free".to_string(),
                description: "A use-after-free vulnerability in nf_tables allows local privilege escalation to root.".to_string(),
                severity: Severity::High,
                cvss_score: 7.8,
                affected_resources: vec!["worker-node-01".to_string(), "worker-node-02".to_string(), "worker-node-03".to_string()],
                remediation: "Update Linux kernel to patched version. Apply vendor security updates.".to_string(),
                patch_available: true,
                discovered_at: now - Duration::days(20),
                status: VulnerabilityStatus::InProgress,
            },
            Vulnerability {
                id: Uuid::new_v4(),
                cve_id: Some("CVE-2024-22252".to_string()),
                title: "VMware ESXi Use-After-Free in XHCI Controller".to_string(),
                description: "A use-after-free vulnerability in the XHCI USB controller allows code execution on the hypervisor.".to_string(),
                severity: Severity::Critical,
                cvss_score: 9.3,
                affected_resources: vec!["esxi-host-01.internal".to_string()],
                remediation: "Apply VMware security patches. Disable XHCI USB controller if not needed.".to_string(),
                patch_available: true,
                discovered_at: now - Duration::days(5),
                status: VulnerabilityStatus::Open,
            },
            Vulnerability {
                id: Uuid::new_v4(),
                cve_id: Some("CVE-2023-50164".to_string()),
                title: "Apache Struts Path Traversal RCE".to_string(),
                description: "Path traversal vulnerability in Apache Struts file upload logic allows remote code execution.".to_string(),
                severity: Severity::Critical,
                cvss_score: 9.8,
                affected_resources: vec!["legacy-app.internal:8080".to_string()],
                remediation: "Upgrade Apache Struts to version 6.3.0.2 or 2.5.33. Apply WAF rules as interim mitigation.".to_string(),
                patch_available: true,
                discovered_at: now - Duration::days(45),
                status: VulnerabilityStatus::Remediated,
            },
            Vulnerability {
                id: Uuid::new_v4(),
                cve_id: Some("CVE-2024-27198".to_string()),
                title: "JetBrains TeamCity Authentication Bypass".to_string(),
                description: "Critical authentication bypass allowing unauthenticated attackers to gain admin access to TeamCity server.".to_string(),
                severity: Severity::Critical,
                cvss_score: 9.8,
                affected_resources: vec!["teamcity.internal:8111".to_string()],
                remediation: "Upgrade TeamCity to version 2023.11.4 or later. Restrict network access to TeamCity.".to_string(),
                patch_available: true,
                discovered_at: now - Duration::days(3),
                status: VulnerabilityStatus::Open,
            },
            Vulnerability {
                id: Uuid::new_v4(),
                cve_id: Some("CVE-2024-0567".to_string()),
                title: "GnuTLS Certificate Verification Bypass".to_string(),
                description: "GnuTLS fails to properly verify certificate chains with specific constraints, allowing MITM attacks.".to_string(),
                severity: Severity::Medium,
                cvss_score: 5.9,
                affected_resources: vec!["mail-server.internal".to_string()],
                remediation: "Upgrade GnuTLS to version 3.8.3 or later.".to_string(),
                patch_available: true,
                discovered_at: now - Duration::days(25),
                status: VulnerabilityStatus::InProgress,
            },
            Vulnerability {
                id: Uuid::new_v4(),
                cve_id: Some("CVE-2023-6246".to_string()),
                title: "glibc syslog() Heap Buffer Overflow".to_string(),
                description: "Heap buffer overflow in glibc's __vsyslog_internal() function allows local privilege escalation.".to_string(),
                severity: Severity::High,
                cvss_score: 7.8,
                affected_resources: vec!["prod-api.example.com".to_string(), "worker-node-01".to_string()],
                remediation: "Update glibc to version 2.39 or later. Apply distribution security patches.".to_string(),
                patch_available: true,
                discovered_at: now - Duration::days(35),
                status: VulnerabilityStatus::Remediated,
            },
            Vulnerability {
                id: Uuid::new_v4(),
                cve_id: Some("CVE-2024-28849".to_string()),
                title: "Node.js follow-redirects Authorization Header Leak".to_string(),
                description: "The follow-redirects npm package leaks Authorization headers to third-party hosts during cross-origin redirects.".to_string(),
                severity: Severity::Medium,
                cvss_score: 6.5,
                affected_resources: vec!["frontend-app.example.com".to_string()],
                remediation: "Upgrade follow-redirects to version 1.15.6 or later.".to_string(),
                patch_available: true,
                discovered_at: now - Duration::days(12),
                status: VulnerabilityStatus::Open,
            },
            Vulnerability {
                id: Uuid::new_v4(),
                cve_id: Some("CVE-2024-24786".to_string()),
                title: "Golang protobuf Infinite Loop".to_string(),
                description: "Unmarshaling certain forms of invalid protobuf messages can cause an infinite loop in Go protobuf library.".to_string(),
                severity: Severity::Medium,
                cvss_score: 5.3,
                affected_resources: vec!["grpc-gateway.internal".to_string()],
                remediation: "Upgrade google.golang.org/protobuf to version 1.33.0 or later.".to_string(),
                patch_available: true,
                discovered_at: now - Duration::days(18),
                status: VulnerabilityStatus::Open,
            },
            Vulnerability {
                id: Uuid::new_v4(),
                cve_id: Some("CVE-2024-22195".to_string()),
                title: "Jinja2 XSS via xmlattr Filter".to_string(),
                description: "Jinja2 xmlattr filter allows injection of arbitrary HTML attributes, enabling cross-site scripting.".to_string(),
                severity: Severity::Medium,
                cvss_score: 5.4,
                affected_resources: vec!["admin-panel.internal".to_string()],
                remediation: "Upgrade Jinja2 to version 3.1.3 or later.".to_string(),
                patch_available: true,
                discovered_at: now - Duration::days(22),
                status: VulnerabilityStatus::Remediated,
            },
            Vulnerability {
                id: Uuid::new_v4(),
                cve_id: Some("CVE-2024-0985".to_string()),
                title: "PostgreSQL Non-Owner REFRESH MATERIALIZED VIEW".to_string(),
                description: "PostgreSQL allows non-owner users to execute arbitrary SQL functions during REFRESH MATERIALIZED VIEW.".to_string(),
                severity: Severity::High,
                cvss_score: 8.0,
                affected_resources: vec!["db-primary.internal:5432".to_string(), "db-replica.internal:5432".to_string()],
                remediation: "Upgrade PostgreSQL to the latest minor version. Review materialized view ownership.".to_string(),
                patch_available: true,
                discovered_at: now - Duration::days(28),
                status: VulnerabilityStatus::InProgress,
            },
            Vulnerability {
                id: Uuid::new_v4(),
                cve_id: None,
                title: "Kubernetes Dashboard Exposed Without Authentication".to_string(),
                description: "Kubernetes dashboard is accessible without authentication via NodePort, allowing cluster management access.".to_string(),
                severity: Severity::Critical,
                cvss_score: 9.0,
                affected_resources: vec!["prod-cluster:30443".to_string()],
                remediation: "Disable NodePort access. Configure RBAC and OIDC authentication for the dashboard. Consider removing dashboard entirely.".to_string(),
                patch_available: false,
                discovered_at: now - Duration::days(2),
                status: VulnerabilityStatus::Open,
            },
            Vulnerability {
                id: Uuid::new_v4(),
                cve_id: None,
                title: "S3 Bucket with Public Read Access".to_string(),
                description: "An S3 bucket containing application logs is configured with public read access, exposing sensitive data.".to_string(),
                severity: Severity::High,
                cvss_score: 7.5,
                affected_resources: vec!["s3://app-logs-prod-2024".to_string()],
                remediation: "Remove public access. Enable S3 Block Public Access at the account level. Audit bucket policies.".to_string(),
                patch_available: false,
                discovered_at: now - Duration::days(1),
                status: VulnerabilityStatus::Open,
            },
            Vulnerability {
                id: Uuid::new_v4(),
                cve_id: None,
                title: "Outdated Node.js Runtime (14.x EOL)".to_string(),
                description: "Application is running on Node.js 14.x which has reached end-of-life and no longer receives security updates.".to_string(),
                severity: Severity::Medium,
                cvss_score: 5.0,
                affected_resources: vec!["frontend-app.example.com".to_string(), "api-gateway.internal".to_string()],
                remediation: "Upgrade to Node.js 20 LTS or later.".to_string(),
                patch_available: false,
                discovered_at: now - Duration::days(60),
                status: VulnerabilityStatus::InProgress,
            },
        ]);

        // -------------------------------------------------------
        // Seed compliance assessments
        // -------------------------------------------------------
        compliance_assessments.push(("soc2".to_string(), build_compliance_assessment(
            ComplianceFramework::Soc2, 87.0, 45, 38, 3, 2, 2,
            &soc2_controls(),
        )));
        compliance_assessments.push(("iso27001".to_string(), build_compliance_assessment(
            ComplianceFramework::Iso27001, 82.0, 35, 27, 4, 2, 2,
            &iso27001_controls(),
        )));
        compliance_assessments.push(("hipaa".to_string(), build_compliance_assessment(
            ComplianceFramework::Hipaa, 91.0, 25, 22, 1, 1, 1,
            &hipaa_controls(),
        )));
        compliance_assessments.push(("pci-dss-4".to_string(), build_compliance_assessment(
            ComplianceFramework::PciDss4, 78.0, 50, 37, 6, 4, 3,
            &pcidss_controls(),
        )));
        compliance_assessments.push(("gdpr".to_string(), build_compliance_assessment(
            ComplianceFramework::Gdpr, 85.0, 20, 16, 2, 1, 1,
            &gdpr_controls(),
        )));
        compliance_assessments.push(("nist-csf".to_string(), build_compliance_assessment(
            ComplianceFramework::NistCsf, 80.0, 40, 30, 5, 3, 2,
            &nist_csf_controls(),
        )));
        compliance_assessments.push(("cis".to_string(), build_compliance_assessment(
            ComplianceFramework::Cis, 88.0, 30, 25, 2, 2, 1,
            &cis_controls(),
        )));

        // -------------------------------------------------------
        // Seed DDoS tests
        // -------------------------------------------------------
        let ddos1_id = Uuid::new_v4();
        let ddos2_id = Uuid::new_v4();

        ddos_tests.push((ddos1_id, DdosTestResult {
            id: ddos1_id,
            target: "loadtest.example.com".to_string(),
            attack_type: "http_flood".to_string(),
            status: DdosTestStatus::Completed,
            duration_seconds: 300,
            total_requests_sent: 50000,
            successful_responses: 49000,
            failed_responses: 1000,
            avg_response_time_ms: 245.7,
            max_response_time_ms: 4820.3,
            started_at: now - Duration::hours(72),
            completed_at: Some(now - Duration::hours(72) + Duration::minutes(5)),
            authorization_document_id: "AUTH-2024-001".to_string(),
            authorized_by: "ciso@example.com".to_string(),
        }));

        ddos_tests.push((ddos2_id, DdosTestResult {
            id: ddos2_id,
            target: "staging-lb.example.com".to_string(),
            attack_type: "syn_flood".to_string(),
            status: DdosTestStatus::Completed,
            duration_seconds: 180,
            total_requests_sent: 30000,
            successful_responses: 28500,
            failed_responses: 1500,
            avg_response_time_ms: 312.4,
            max_response_time_ms: 5100.8,
            started_at: now - Duration::hours(48),
            completed_at: Some(now - Duration::hours(48) + Duration::minutes(3)),
            authorization_document_id: "AUTH-2024-002".to_string(),
            authorized_by: "security-lead@example.com".to_string(),
        }));

        // Audit entries for DDoS tests
        audit_entries.extend(vec![
            AuditEntry {
                id: Uuid::new_v4(),
                test_id: ddos1_id,
                action: "test_created".to_string(),
                performed_by: "ciso@example.com".to_string(),
                timestamp: now - Duration::hours(72),
                details: serde_json::json!({"target": "loadtest.example.com", "attack_type": "http_flood", "authorization_document_id": "AUTH-2024-001"}),
            },
            AuditEntry {
                id: Uuid::new_v4(),
                test_id: ddos1_id,
                action: "test_started".to_string(),
                performed_by: "system".to_string(),
                timestamp: now - Duration::hours(72) + Duration::seconds(2),
                details: serde_json::json!({"status": "running"}),
            },
            AuditEntry {
                id: Uuid::new_v4(),
                test_id: ddos1_id,
                action: "test_completed".to_string(),
                performed_by: "system".to_string(),
                timestamp: now - Duration::hours(72) + Duration::minutes(5),
                details: serde_json::json!({"total_requests_sent": 50000, "success_rate": 0.98}),
            },
            AuditEntry {
                id: Uuid::new_v4(),
                test_id: ddos2_id,
                action: "test_created".to_string(),
                performed_by: "security-lead@example.com".to_string(),
                timestamp: now - Duration::hours(48),
                details: serde_json::json!({"target": "staging-lb.example.com", "attack_type": "syn_flood", "authorization_document_id": "AUTH-2024-002"}),
            },
            AuditEntry {
                id: Uuid::new_v4(),
                test_id: ddos2_id,
                action: "test_started".to_string(),
                performed_by: "system".to_string(),
                timestamp: now - Duration::hours(48) + Duration::seconds(1),
                details: serde_json::json!({"status": "running"}),
            },
            AuditEntry {
                id: Uuid::new_v4(),
                test_id: ddos2_id,
                action: "test_completed".to_string(),
                performed_by: "system".to_string(),
                timestamp: now - Duration::hours(48) + Duration::minutes(3),
                details: serde_json::json!({"total_requests_sent": 30000, "success_rate": 0.95}),
            },
        ]);

        // Persist to SurrealDB
        let scan_count = scans.len();
        let vuln_count = vulnerabilities.len();
        let compliance_count = compliance_assessments.len();
        let ddos_count = ddos_tests.len();
        let audit_count = audit_entries.len();

        for (id, scan) in scans {
            let _ = db.create_with_id("security_scans", &id.to_string(), scan).await;
        }

        for vuln in vulnerabilities {
            let id_str = vuln.id.to_string();
            let _ = db.create_with_id("vulnerabilities", &id_str, vuln).await;
        }

        for (key, assessment) in compliance_assessments {
            let _ = db.create_with_id("compliance_assessments", &key, assessment).await;
        }

        for (id, test) in ddos_tests {
            let _ = db.create_with_id("ddos_tests", &id.to_string(), test).await;
        }

        for entry in audit_entries {
            let id_str = entry.id.to_string();
            let _ = db.create_with_id("security_audit_entries", &id_str, entry).await;
        }

        tracing::info!(
            "SurrealDB seeded: {} scans, {} vulns, {} compliance, {} ddos tests, {} audit entries",
            scan_count,
            vuln_count,
            compliance_count,
            ddos_count,
            audit_count,
        );
    }
}

fn build_compliance_assessment(
    framework: ComplianceFramework,
    score: f64,
    total: usize,
    passed: usize,
    failed: usize,
    partial: usize,
    not_assessed: usize,
    control_names: &[(String, String, String)],
) -> ComplianceAssessment {
    let now = Utc::now();
    let mut controls = Vec::new();

    for (i, (id, name, desc)) in control_names.iter().enumerate() {
        let status = if i < passed {
            ControlStatus::Pass
        } else if i < passed + failed {
            ControlStatus::Fail
        } else if i < passed + failed + partial {
            ControlStatus::Partial
        } else {
            ControlStatus::NotAssessed
        };

        controls.push(ComplianceControl {
            id: id.clone(),
            name: name.clone(),
            description: desc.clone(),
            status,
            evidence: if status == ControlStatus::Pass {
                Some("Automated check passed. Evidence collected.".to_string())
            } else {
                None
            },
            last_checked: now - Duration::hours(i as i64),
        });
    }

    // Pad to total if control_names is smaller
    while controls.len() < total {
        let idx = controls.len();
        let status = if idx < passed {
            ControlStatus::Pass
        } else if idx < passed + failed {
            ControlStatus::Fail
        } else if idx < passed + failed + partial {
            ControlStatus::Partial
        } else {
            ControlStatus::NotAssessed
        };
        controls.push(ComplianceControl {
            id: format!("{}-{}", framework.to_string().to_lowercase().replace(' ', ""), idx + 1),
            name: format!("Control {}", idx + 1),
            description: format!("Auto-generated control {} for {}", idx + 1, framework),
            status,
            evidence: if status == ControlStatus::Pass {
                Some("Automated check passed.".to_string())
            } else {
                None
            },
            last_checked: now - Duration::hours(idx as i64),
        });
    }

    ComplianceAssessment {
        framework,
        score,
        controls,
        assessed_at: now - Duration::hours(6),
        summary: AssessmentSummary {
            total_controls: total,
            passed,
            failed,
            partial,
            not_assessed,
        },
    }
}

fn soc2_controls() -> Vec<(String, String, String)> {
    vec![
        ("CC1.1".into(), "CC1.1 - COSO Principle 1: Integrity and Ethical Values".into(), "The entity demonstrates a commitment to integrity and ethical values.".into()),
        ("CC1.2".into(), "CC1.2 - COSO Principle 2: Board Independence".into(), "The board of directors demonstrates independence from management.".into()),
        ("CC1.3".into(), "CC1.3 - COSO Principle 3: Management Oversight".into(), "Management establishes structures, reporting lines, and appropriate authorities.".into()),
        ("CC2.1".into(), "CC2.1 - Information and Communication".into(), "The entity obtains or generates relevant, quality information.".into()),
        ("CC2.2".into(), "CC2.2 - Internal Communication".into(), "The entity internally communicates information necessary to support functioning of internal control.".into()),
        ("CC3.1".into(), "CC3.1 - Risk Assessment Objectives".into(), "The entity specifies objectives with sufficient clarity to identify and assess risks.".into()),
        ("CC3.2".into(), "CC3.2 - Risk Identification and Analysis".into(), "The entity identifies risks to the achievement of objectives.".into()),
        ("CC3.3".into(), "CC3.3 - Fraud Risk Assessment".into(), "The entity considers the potential for fraud in assessing risks.".into()),
        ("CC4.1".into(), "CC4.1 - Monitoring Activities".into(), "The entity selects and performs monitoring activities.".into()),
        ("CC5.1".into(), "CC5.1 - Control Activities Selection".into(), "The entity selects and develops control activities to mitigate risks.".into()),
        ("CC5.2".into(), "CC5.2 - Technology General Controls".into(), "The entity selects and develops general control activities over technology.".into()),
        ("CC5.3".into(), "CC5.3 - Control Activity Policies".into(), "The entity deploys control activities through policies and procedures.".into()),
        ("CC6.1".into(), "CC6.1 - Logical and Physical Access Controls".into(), "The entity implements logical access security over protected information assets.".into()),
        ("CC6.2".into(), "CC6.2 - System Access Registration".into(), "Prior to issuing system credentials, the entity registers and authorizes new users.".into()),
        ("CC6.3".into(), "CC6.3 - Access Management".into(), "The entity authorizes, modifies, or removes access based on role changes.".into()),
        ("CC6.6".into(), "CC6.6 - System Boundaries".into(), "The entity implements logical access security to protect against threats from outside system boundaries.".into()),
        ("CC6.7".into(), "CC6.7 - Data Transmission Security".into(), "The entity restricts transmission of data to authorized channels.".into()),
        ("CC6.8".into(), "CC6.8 - Malicious Software Prevention".into(), "The entity implements controls to prevent or detect malicious software.".into()),
        ("CC7.1".into(), "CC7.1 - Security Monitoring".into(), "To meet its objectives, the entity uses detection and monitoring procedures.".into()),
        ("CC7.2".into(), "CC7.2 - Anomaly Detection".into(), "The entity monitors system components for anomalies indicative of malicious acts.".into()),
        ("CC7.3".into(), "CC7.3 - Incident Evaluation".into(), "The entity evaluates security events to determine whether they constitute incidents.".into()),
        ("CC7.4".into(), "CC7.4 - Incident Response".into(), "The entity responds to identified security incidents.".into()),
        ("CC7.5".into(), "CC7.5 - Incident Recovery".into(), "The entity identifies, develops, and implements activities to recover from incidents.".into()),
        ("CC8.1".into(), "CC8.1 - Change Management".into(), "The entity authorizes, designs, develops, configures, documents, tests, approves, and implements changes.".into()),
        ("CC9.1".into(), "CC9.1 - Risk Mitigation".into(), "The entity identifies, selects, and develops risk mitigation activities.".into()),
        ("A1.1".into(), "A1.1 - Availability Commitments".into(), "The entity maintains system availability in accordance with commitments.".into()),
        ("A1.2".into(), "A1.2 - Recovery Planning".into(), "The entity maintains environmental protections and recovery infrastructure.".into()),
        ("A1.3".into(), "A1.3 - Recovery Testing".into(), "The entity tests recovery plan procedures supporting system recovery.".into()),
        ("C1.1".into(), "C1.1 - Confidentiality Identification".into(), "The entity identifies and maintains confidential information.".into()),
        ("C1.2".into(), "C1.2 - Confidentiality Disposal".into(), "The entity disposes of confidential information in accordance with policy.".into()),
        ("PI1.1".into(), "PI1.1 - Processing Integrity Definitions".into(), "The entity obtains or generates relevant, quality processing objectives.".into()),
        ("PI1.2".into(), "PI1.2 - Processing Accuracy".into(), "System processing is complete, valid, accurate, timely, and authorized.".into()),
    ]
}

fn iso27001_controls() -> Vec<(String, String, String)> {
    vec![
        ("A.5.1".into(), "A.5.1 - Information Security Policies".into(), "Policies for information security shall be defined and approved by management.".into()),
        ("A.5.2".into(), "A.5.2 - Review of Information Security Policies".into(), "Policies shall be reviewed at planned intervals or if significant changes occur.".into()),
        ("A.6.1".into(), "A.6.1 - Internal Organization".into(), "A management framework shall be established to control implementation of information security.".into()),
        ("A.6.2".into(), "A.6.2 - Mobile Devices and Teleworking".into(), "Security measures for mobile devices and teleworking shall be adopted.".into()),
        ("A.7.1".into(), "A.7.1 - Prior to Employment Screening".into(), "Background verification checks on all candidates shall be carried out.".into()),
        ("A.8.1".into(), "A.8.1 - Asset Inventory".into(), "Assets associated with information shall be identified and an inventory maintained.".into()),
        ("A.8.2".into(), "A.8.2 - Information Classification".into(), "Information shall be classified in terms of legal requirements, value, and sensitivity.".into()),
        ("A.9.1".into(), "A.9.1 - Access Control Policy".into(), "An access control policy shall be established, documented, and reviewed.".into()),
        ("A.9.2".into(), "A.9.2 - User Access Management".into(), "Formal user registration and de-registration procedures shall be implemented.".into()),
        ("A.9.4".into(), "A.9.4 - System and Application Access Control".into(), "Access to systems and applications shall be controlled by a secure log-on procedure.".into()),
        ("A.10.1".into(), "A.10.1 - Cryptographic Controls".into(), "A policy on the use of cryptographic controls shall be developed.".into()),
        ("A.11.1".into(), "A.11.1 - Secure Areas".into(), "Security perimeters shall be defined and used to protect areas containing sensitive information.".into()),
        ("A.12.1".into(), "A.12.1 - Operational Procedures".into(), "Operating procedures shall be documented and made available.".into()),
        ("A.12.2".into(), "A.12.2 - Protection from Malware".into(), "Detection, prevention, and recovery controls against malware shall be implemented.".into()),
        ("A.12.3".into(), "A.12.3 - Backup".into(), "Backup copies of information and software shall be taken and tested regularly.".into()),
        ("A.12.4".into(), "A.12.4 - Logging and Monitoring".into(), "Event logs recording user activities and security events shall be produced and kept.".into()),
        ("A.13.1".into(), "A.13.1 - Network Security Management".into(), "Networks shall be managed and controlled to protect information.".into()),
        ("A.13.2".into(), "A.13.2 - Information Transfer".into(), "Formal transfer policies and procedures shall protect information transfer.".into()),
        ("A.14.1".into(), "A.14.1 - Security Requirements of Information Systems".into(), "Information security requirements shall be included in new or enhanced systems.".into()),
        ("A.14.2".into(), "A.14.2 - Secure Development".into(), "Rules for the development of software shall be established and applied.".into()),
        ("A.16.1".into(), "A.16.1 - Incident Management".into(), "Management responsibilities and procedures shall ensure effective incident response.".into()),
        ("A.17.1".into(), "A.17.1 - Business Continuity".into(), "Information security continuity shall be embedded in business continuity management.".into()),
        ("A.18.1".into(), "A.18.1 - Compliance with Legal Requirements".into(), "All relevant statutory, regulatory, and contractual requirements shall be identified.".into()),
        ("A.18.2".into(), "A.18.2 - Information Security Reviews".into(), "The organization's approach to managing information security shall be reviewed independently.".into()),
    ]
}

fn hipaa_controls() -> Vec<(String, String, String)> {
    vec![
        ("164.308(a)(1)".into(), "Security Management Process".into(), "Implement policies and procedures to prevent, detect, contain, and correct security violations.".into()),
        ("164.308(a)(2)".into(), "Assigned Security Responsibility".into(), "Identify the security official responsible for developing security policies.".into()),
        ("164.308(a)(3)".into(), "Workforce Security".into(), "Implement policies to ensure workforce members have appropriate access to ePHI.".into()),
        ("164.308(a)(4)".into(), "Information Access Management".into(), "Implement policies authorizing access to ePHI consistent with the Privacy Rule.".into()),
        ("164.308(a)(5)".into(), "Security Awareness and Training".into(), "Implement a security awareness and training program for all members of the workforce.".into()),
        ("164.308(a)(6)".into(), "Security Incident Procedures".into(), "Implement policies to address security incidents.".into()),
        ("164.308(a)(7)".into(), "Contingency Plan".into(), "Establish policies for responding to an emergency or other occurrence that damages ePHI.".into()),
        ("164.308(a)(8)".into(), "Evaluation".into(), "Perform periodic technical and nontechnical evaluation of security policies.".into()),
        ("164.310(a)(1)".into(), "Facility Access Controls".into(), "Implement policies to limit physical access to electronic information systems.".into()),
        ("164.310(b)".into(), "Workstation Use".into(), "Implement policies specifying proper functions and physical attributes of workstations.".into()),
        ("164.310(c)".into(), "Workstation Security".into(), "Implement physical safeguards for workstations that access ePHI.".into()),
        ("164.310(d)(1)".into(), "Device and Media Controls".into(), "Implement policies governing receipt and removal of hardware and electronic media.".into()),
        ("164.312(a)(1)".into(), "Access Control".into(), "Implement technical policies to allow access only to authorized persons.".into()),
        ("164.312(b)".into(), "Audit Controls".into(), "Implement mechanisms to record and examine activity in systems containing ePHI.".into()),
        ("164.312(c)(1)".into(), "Integrity".into(), "Implement policies and procedures to protect ePHI from improper alteration.".into()),
        ("164.312(d)".into(), "Person or Entity Authentication".into(), "Implement procedures to verify person or entity seeking access to ePHI.".into()),
        ("164.312(e)(1)".into(), "Transmission Security".into(), "Implement technical security measures to guard against unauthorized access during electronic transmission.".into()),
        ("164.314(a)(1)".into(), "Business Associate Contracts".into(), "A covered entity may permit a business associate to create, receive, maintain, or transmit ePHI.".into()),
        ("164.316(a)".into(), "Policies and Procedures".into(), "Implement reasonable and appropriate policies and procedures to comply with standards.".into()),
        ("164.316(b)(1)".into(), "Documentation".into(), "Maintain documentation of policies and procedures for 6 years from creation date.".into()),
    ]
}

fn pcidss_controls() -> Vec<(String, String, String)> {
    vec![
        ("1.1.1".into(), "1.1.1 - Network Security Controls".into(), "Processes and mechanisms for network security controls are defined and understood.".into()),
        ("1.2.1".into(), "1.2.1 - Network Security Configuration".into(), "Inbound and outbound network traffic is restricted to that which is necessary.".into()),
        ("1.3.1".into(), "1.3.1 - Cardholder Data Environment Access".into(), "Access to the CDE from untrusted networks is restricted.".into()),
        ("1.4.1".into(), "1.4.1 - Network Connections Between Trusted and Untrusted".into(), "NSCs are implemented between trusted and untrusted networks.".into()),
        ("2.1.1".into(), "2.1.1 - Secure Configurations".into(), "Processes for applying secure configurations are defined and understood.".into()),
        ("2.2.1".into(), "2.2.1 - System Configuration Standards".into(), "Configuration standards are developed and maintained for all system components.".into()),
        ("3.1.1".into(), "3.1.1 - Account Data Protection".into(), "Processes for protecting stored account data are defined and understood.".into()),
        ("3.2.1".into(), "3.2.1 - SAD Storage Limitations".into(), "Sensitive authentication data is not stored after authorization.".into()),
        ("3.3.1".into(), "3.3.1 - PAN Display Masking".into(), "PAN is masked when displayed according to defined policies.".into()),
        ("3.5.1".into(), "3.5.1 - PAN Encryption".into(), "PAN is secured wherever it is stored using strong cryptography.".into()),
        ("4.1.1".into(), "4.1.1 - Transmission Encryption".into(), "Processes for protecting cardholder data transmissions are defined.".into()),
        ("4.2.1".into(), "4.2.1 - PAN Transmission Security".into(), "PAN is protected with strong cryptography during transmission over open networks.".into()),
        ("5.1.1".into(), "5.1.1 - Malicious Software Protection".into(), "Processes for protecting against malicious software are defined.".into()),
        ("5.2.1".into(), "5.2.1 - Anti-Malware Mechanisms".into(), "An anti-malware solution is deployed on all applicable systems.".into()),
        ("5.3.1".into(), "5.3.1 - Anti-Malware Active and Monitored".into(), "Anti-malware mechanisms and processes are active, maintained, and monitored.".into()),
        ("6.1.1".into(), "6.1.1 - Secure Software Development".into(), "Processes for developing secure systems and software are defined.".into()),
        ("6.2.1".into(), "6.2.1 - Bespoke Software Security".into(), "Bespoke and custom software is developed securely.".into()),
        ("6.3.1".into(), "6.3.1 - Security Vulnerability Identification".into(), "Security vulnerabilities are identified and addressed.".into()),
        ("6.4.1".into(), "6.4.1 - Public-Facing Web Application Protection".into(), "Attacks on public-facing web applications are detected and prevented.".into()),
        ("7.1.1".into(), "7.1.1 - Access Control Management".into(), "Processes for restricting access to system components are defined.".into()),
        ("7.2.1".into(), "7.2.1 - Appropriate Access Defined".into(), "Access is assigned to users based on job classification and function.".into()),
        ("8.1.1".into(), "8.1.1 - User Identification".into(), "Processes for identification and authentication are defined.".into()),
        ("8.2.1".into(), "8.2.1 - Unique User IDs".into(), "All users are assigned a unique ID before access to system components.".into()),
        ("8.3.1".into(), "8.3.1 - Authentication Factor Management".into(), "All user access to system components is authenticated via at least one factor.".into()),
        ("8.6.1".into(), "8.6.1 - Application and System Account Management".into(), "Use of application and system accounts is managed.".into()),
        ("9.1.1".into(), "9.1.1 - Physical Access Controls".into(), "Processes for restricting physical access are defined and understood.".into()),
        ("9.2.1".into(), "9.2.1 - Facility Entry Controls".into(), "Appropriate facility entry controls are in place.".into()),
        ("10.1.1".into(), "10.1.1 - Audit Log Management".into(), "Processes for logging and monitoring are defined.".into()),
        ("10.2.1".into(), "10.2.1 - Audit Log Coverage".into(), "Audit logs capture all required events for system components.".into()),
        ("10.3.1".into(), "10.3.1 - Audit Log Protection".into(), "Audit logs are protected from destruction and unauthorized modifications.".into()),
        ("10.4.1".into(), "10.4.1 - Audit Log Review".into(), "Audit logs are reviewed to identify anomalies or suspicious activity.".into()),
        ("11.1.1".into(), "11.1.1 - Security Testing".into(), "Processes for regular security testing are defined.".into()),
        ("11.2.1".into(), "11.2.1 - Wireless Access Point Management".into(), "Authorized and unauthorized wireless access points are managed.".into()),
        ("11.3.1".into(), "11.3.1 - Vulnerability Scanning".into(), "External and internal vulnerabilities are regularly identified and addressed.".into()),
        ("11.4.1".into(), "11.4.1 - Penetration Testing".into(), "External and internal penetration testing is regularly performed.".into()),
        ("12.1.1".into(), "12.1.1 - Information Security Policy".into(), "An overall information security policy is established and maintained.".into()),
        ("12.2.1".into(), "12.2.1 - Acceptable Use Policies".into(), "Acceptable use policies for end-user technologies are defined.".into()),
        ("12.3.1".into(), "12.3.1 - Risks to CDE Formally Identified".into(), "Risks to the CDE are formally identified, evaluated, and managed.".into()),
        ("12.6.1".into(), "12.6.1 - Security Awareness Program".into(), "A formal security awareness program is implemented.".into()),
        ("12.8.1".into(), "12.8.1 - Service Provider Management".into(), "A list of TPSPs with whom account data is shared is maintained.".into()),
        ("12.10.1".into(), "12.10.1 - Incident Response Plan".into(), "An incident response plan exists and is ready to be activated.".into()),
    ]
}

fn gdpr_controls() -> Vec<(String, String, String)> {
    vec![
        ("Art.5".into(), "Article 5 - Principles of Processing".into(), "Personal data shall be processed lawfully, fairly, and in a transparent manner.".into()),
        ("Art.6".into(), "Article 6 - Lawfulness of Processing".into(), "Processing shall be lawful if at least one legal basis applies.".into()),
        ("Art.7".into(), "Article 7 - Conditions for Consent".into(), "Where consent is the legal basis, the controller must be able to demonstrate consent.".into()),
        ("Art.12".into(), "Article 12 - Transparent Communication".into(), "The controller shall take appropriate measures to provide information in a concise, transparent manner.".into()),
        ("Art.13".into(), "Article 13 - Information to Data Subjects".into(), "Information shall be provided to the data subject at the time data is obtained.".into()),
        ("Art.15".into(), "Article 15 - Right of Access".into(), "The data subject has the right to obtain confirmation of processing and access to data.".into()),
        ("Art.17".into(), "Article 17 - Right to Erasure".into(), "The data subject has the right to obtain erasure of personal data.".into()),
        ("Art.20".into(), "Article 20 - Right to Data Portability".into(), "The data subject has the right to receive personal data in a structured, common format.".into()),
        ("Art.25".into(), "Article 25 - Data Protection by Design".into(), "The controller shall implement appropriate technical and organizational measures.".into()),
        ("Art.28".into(), "Article 28 - Processor".into(), "Processing by a processor shall be governed by a contract.".into()),
        ("Art.30".into(), "Article 30 - Records of Processing".into(), "Each controller shall maintain a record of processing activities.".into()),
        ("Art.32".into(), "Article 32 - Security of Processing".into(), "The controller shall implement appropriate technical and organizational security measures.".into()),
        ("Art.33".into(), "Article 33 - Notification of Breach to Authority".into(), "In case of a breach, the controller shall notify the supervisory authority within 72 hours.".into()),
        ("Art.34".into(), "Article 34 - Communication of Breach to Data Subject".into(), "When the breach is likely to result in high risk, the controller shall communicate to the data subject.".into()),
        ("Art.35".into(), "Article 35 - Data Protection Impact Assessment".into(), "Where processing is likely to result in high risk, a DPIA shall be carried out.".into()),
        ("Art.37".into(), "Article 37 - Data Protection Officer".into(), "The controller and processor shall designate a DPO where required.".into()),
        ("Art.44".into(), "Article 44 - International Transfers".into(), "Any transfer of personal data to a third country shall comply with GDPR conditions.".into()),
    ]
}

fn nist_csf_controls() -> Vec<(String, String, String)> {
    vec![
        ("ID.AM-1".into(), "ID.AM-1 - Asset Inventory".into(), "Physical devices and systems within the organization are inventoried.".into()),
        ("ID.AM-2".into(), "ID.AM-2 - Software Inventory".into(), "Software platforms and applications are inventoried.".into()),
        ("ID.BE-1".into(), "ID.BE-1 - Supply Chain Role".into(), "The organization's role in the supply chain is identified and communicated.".into()),
        ("ID.GV-1".into(), "ID.GV-1 - Security Policy".into(), "Organizational cybersecurity policy is established and communicated.".into()),
        ("ID.RA-1".into(), "ID.RA-1 - Asset Vulnerabilities".into(), "Asset vulnerabilities are identified and documented.".into()),
        ("ID.RA-3".into(), "ID.RA-3 - Threat Identification".into(), "Threats, both internal and external, are identified and documented.".into()),
        ("ID.RM-1".into(), "ID.RM-1 - Risk Management Processes".into(), "Risk management processes are established and managed.".into()),
        ("PR.AC-1".into(), "PR.AC-1 - Identity Management".into(), "Identities and credentials are issued, managed, verified, revoked, and audited.".into()),
        ("PR.AC-3".into(), "PR.AC-3 - Remote Access".into(), "Remote access is managed.".into()),
        ("PR.AC-5".into(), "PR.AC-5 - Network Integrity".into(), "Network integrity is protected incorporating network segregation.".into()),
        ("PR.AT-1".into(), "PR.AT-1 - Awareness Training".into(), "All users are informed and trained.".into()),
        ("PR.DS-1".into(), "PR.DS-1 - Data at Rest".into(), "Data-at-rest is protected.".into()),
        ("PR.DS-2".into(), "PR.DS-2 - Data in Transit".into(), "Data-in-transit is protected.".into()),
        ("PR.DS-5".into(), "PR.DS-5 - Data Leak Protection".into(), "Protections against data leaks are implemented.".into()),
        ("PR.IP-1".into(), "PR.IP-1 - Baseline Configuration".into(), "A baseline configuration of systems is created and maintained.".into()),
        ("PR.IP-3".into(), "PR.IP-3 - Configuration Change Control".into(), "Configuration change control processes are in place.".into()),
        ("PR.IP-9".into(), "PR.IP-9 - Response and Recovery Plans".into(), "Response plans and recovery plans are in place and managed.".into()),
        ("PR.MA-1".into(), "PR.MA-1 - Maintenance".into(), "Maintenance of organizational assets is performed and logged.".into()),
        ("PR.PT-1".into(), "PR.PT-1 - Audit/Log Records".into(), "Audit/log records are determined, documented, and reviewed.".into()),
        ("DE.AE-1".into(), "DE.AE-1 - Network Operations Baseline".into(), "A baseline of network operations is established and managed.".into()),
        ("DE.AE-3".into(), "DE.AE-3 - Event Data Collection".into(), "Event data are collected and correlated from multiple sources.".into()),
        ("DE.CM-1".into(), "DE.CM-1 - Network Monitoring".into(), "The network is monitored to detect potential cybersecurity events.".into()),
        ("DE.CM-4".into(), "DE.CM-4 - Malicious Code Detection".into(), "Malicious code is detected.".into()),
        ("DE.CM-7".into(), "DE.CM-7 - Unauthorized Activity Monitoring".into(), "Monitoring for unauthorized personnel, connections, and devices is performed.".into()),
        ("DE.DP-4".into(), "DE.DP-4 - Event Detection Communication".into(), "Event detection information is communicated.".into()),
        ("RS.RP-1".into(), "RS.RP-1 - Response Plan Execution".into(), "Response plan is executed during or after an incident.".into()),
        ("RS.CO-2".into(), "RS.CO-2 - Incident Reporting".into(), "Incidents are reported consistent with established criteria.".into()),
        ("RS.AN-1".into(), "RS.AN-1 - Investigation Notifications".into(), "Notifications from detection systems are investigated.".into()),
        ("RS.MI-1".into(), "RS.MI-1 - Incident Containment".into(), "Incidents are contained.".into()),
        ("RS.MI-2".into(), "RS.MI-2 - Incident Mitigation".into(), "Incidents are mitigated.".into()),
        ("RC.RP-1".into(), "RC.RP-1 - Recovery Plan Execution".into(), "Recovery plan is executed during or after a cybersecurity incident.".into()),
        ("RC.IM-1".into(), "RC.IM-1 - Recovery Plan Improvement".into(), "Recovery plans incorporate lessons learned.".into()),
    ]
}

fn cis_controls() -> Vec<(String, String, String)> {
    vec![
        ("CIS.1.1".into(), "CIS 1.1 - Enterprise Asset Inventory".into(), "Establish and maintain a detailed enterprise asset inventory.".into()),
        ("CIS.1.2".into(), "CIS 1.2 - Unauthorized Asset Remediation".into(), "Ensure unauthorized assets are either removed or remediated.".into()),
        ("CIS.2.1".into(), "CIS 2.1 - Software Inventory".into(), "Establish and maintain a detailed software inventory.".into()),
        ("CIS.2.2".into(), "CIS 2.2 - Authorized Software Enforcement".into(), "Ensure only authorized software is installed and can execute.".into()),
        ("CIS.3.1".into(), "CIS 3.1 - Data Classification".into(), "Establish and maintain a data classification scheme.".into()),
        ("CIS.3.4".into(), "CIS 3.4 - Data Retention Enforcement".into(), "Enforce data retention practices based on the data classification.".into()),
        ("CIS.4.1".into(), "CIS 4.1 - Secure Configuration Standards".into(), "Establish and maintain secure configuration standards.".into()),
        ("CIS.4.7".into(), "CIS 4.7 - Manage Default Accounts".into(), "Manage default accounts on enterprise assets and software.".into()),
        ("CIS.5.1".into(), "CIS 5.1 - Account Inventory".into(), "Establish and maintain an inventory of all accounts.".into()),
        ("CIS.5.3".into(), "CIS 5.3 - Disable Dormant Accounts".into(), "Delete or disable any dormant accounts after inactivity period.".into()),
        ("CIS.5.4".into(), "CIS 5.4 - Restrict Admin Privileges".into(), "Restrict administrator privileges to dedicated admin accounts.".into()),
        ("CIS.6.1".into(), "CIS 6.1 - Access Control Policy".into(), "Establish an access granting process based on need to know.".into()),
        ("CIS.6.2".into(), "CIS 6.2 - Access Revocation Process".into(), "Establish and follow a process for revoking access upon termination.".into()),
        ("CIS.7.1".into(), "CIS 7.1 - Vulnerability Management Policy".into(), "Establish and maintain a documented vulnerability management process.".into()),
        ("CIS.7.4".into(), "CIS 7.4 - Automated Patch Management".into(), "Perform automated operating system patch management.".into()),
        ("CIS.8.1".into(), "CIS 8.1 - Audit Log Management".into(), "Establish and maintain an audit log management process.".into()),
        ("CIS.8.2".into(), "CIS 8.2 - Centralized Log Collection".into(), "Collect audit logs from enterprise assets centrally.".into()),
        ("CIS.8.5".into(), "CIS 8.5 - Detailed Audit Logging".into(), "Configure detailed audit logging for enterprise assets containing sensitive data.".into()),
        ("CIS.9.1".into(), "CIS 9.1 - Email and Web Browser Protections".into(), "Ensure only fully supported browsers and email clients are used.".into()),
        ("CIS.10.1".into(), "CIS 10.1 - Anti-Malware Software".into(), "Deploy and maintain anti-malware software on all enterprise assets.".into()),
        ("CIS.11.1".into(), "CIS 11.1 - Data Recovery Practices".into(), "Establish and maintain data recovery practices.".into()),
        ("CIS.12.1".into(), "CIS 12.1 - Network Infrastructure Management".into(), "Ensure network infrastructure is up-to-date.".into()),
        ("CIS.13.1".into(), "CIS 13.1 - Security Awareness Program".into(), "Establish and maintain a security awareness program.".into()),
        ("CIS.14.1".into(), "CIS 14.1 - Secure Application Development".into(), "Establish and maintain secure coding practices.".into()),
        ("CIS.15.1".into(), "CIS 15.1 - Service Provider Management".into(), "Establish and maintain an inventory of service providers.".into()),
        ("CIS.16.1".into(), "CIS 16.1 - Secure Software Development".into(), "Establish and maintain a secure application development process.".into()),
        ("CIS.17.1".into(), "CIS 17.1 - Incident Response Plan".into(), "Designate personnel to manage incident handling.".into()),
        ("CIS.18.1".into(), "CIS 18.1 - Penetration Testing Program".into(), "Establish and maintain a penetration testing program.".into()),
    ]
}

# Security Documentation

## Authentication Architecture

### JWT Token Flow
1. User submits credentials to `/api/v1/auth/login`
2. Auth service verifies credentials against PostgreSQL
3. If MFA enabled, TOTP code is verified
4. JWT access token (15-min TTL) + HTTP-only refresh cookie (7-day TTL) returned
5. Gateway validates JWT on every request via middleware
6. Expired tokens are refreshed automatically via `/api/v1/auth/refresh`

### OAuth Providers
- **Google** — OpenID Connect via `next-auth/providers/google`
- **GitHub** — OAuth 2.0 via `next-auth/providers/github`
- **Microsoft** — Azure AD via `next-auth/providers/azure-ad`

OAuth users are assigned `cloud_architect` role by default.

### Multi-Factor Authentication
- **TOTP** — Standard RFC 6238, compatible with Google Authenticator, Authy, 1Password
- Setup: POST `/api/v1/auth/mfa/setup` returns QR code (otpauth:// URI)
- Verification: 6-digit code validated with 30-second window

## Authorization (RBAC)

### Roles
| Role | Description |
|------|-------------|
| Cloud Architect | Full access to all modules |
| DevOps Engineer | Full CI/CD, read most modules |
| Data Engineer | Full data/analytics, read compute |
| System Admin | Full compute/security/cost, read networking |
| Network Admin | Full networking, read/write security |

### Permission Matrix

| Module | Architect | DevOps | Data Eng. | Sys Admin | Net Admin |
|--------|-----------|--------|-----------|-----------|-----------|
| Compute | Full | Full | Read | Full | Read |
| Storage | Full | R/W | Full | Full | Read |
| Networking | Full | Read | Read | R/W | Full |
| Database | Full | Read | Full | Full | Read |
| AI/ML | Full | Read | Full | Read | - |
| Security | Full | R/W | Read | Full | R/W |
| Cost | Full | Read | Read | Full | Read |
| CI/CD | R/W | Full | R/W | R/W | Read |
| Data Eng. | Read | R/W | Full | Read | Read |
| IAM | Full | Read | Read | Full | R/W |

## API Security

### Rate Limiting
- Implemented via Redis token bucket in the gateway
- Default: 100 requests/minute per API key
- Configurable per-endpoint overrides
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### CORS
- Configurable origins via `CORS_ORIGINS` environment variable
- Credentials supported for cookie-based auth
- Preflight caching: 1 hour

### Circuit Breaker
- Gateway implements circuit breaker per backend service
- Failure threshold: 5 consecutive failures
- Recovery timeout: 30 seconds
- Prevents cascade failures across services

## Secret Management

### HashiCorp Vault Integration
- KV v2 engine for application secrets
- Transit engine for encryption/decryption
- PKI engine for TLS certificate issuance
- Auto-renewal of Vault tokens via middleware
- AppRole and Kubernetes auth methods supported

### Cloud Credentials
| Provider | Method |
|----------|--------|
| AWS | STS AssumeRole with temporary credentials, or static access keys |
| GCP | Service account JSON, Workload Identity Federation |
| Azure | Service Principal (client_id/secret/tenant), Managed Identity |

Credentials stored encrypted in Vault or environment variables. Never stored in the database.

## Security Scanning

### Integrated Tools
| Tool | Purpose | Integration |
|------|---------|-------------|
| Trivy | Container vulnerability scanning | Real CLI execution |
| OWASP ZAP | Web application security testing | API proxy scanning |
| Nuclei | Template-based vulnerability scanning | Template execution |
| AWS Inspector | Cloud-native vulnerability scanning | AWS SDK |
| AWS GuardDuty | Threat detection | AWS SDK |
| AWS SecurityHub | Centralized security findings | AWS SDK |
| GCP SCC | Security Command Center | REST API |
| Azure Defender | Cloud security posture | REST API |

### Compliance Frameworks
- SOC 2 Type II
- ISO 27001
- HIPAA
- PCI-DSS 4.0
- GDPR
- NIST Cybersecurity Framework
- CIS Benchmarks (AWS, GCP, Azure)

### Security Posture Scoring
- Score range: 0-100
- Aggregated from: IAM hygiene, encryption status, network exposure, compliance gaps, vulnerability counts
- CIS benchmark alignment
- Drift detection for configuration changes

## DDoS Testing Safeguards
The platform includes controlled DDoS testing for compliance purposes with strict safeguards:
- **Authorization required** — Explicit approval before any test
- **Kill switch** — Immediate test termination capability
- **Duration limits** — Maximum test duration enforced
- **Target restrictions** — Only authorized targets permitted
- **Audit trail** — Complete logging of all test activities
- **Rate caps** — Maximum request rates enforced

## Network Security (Kubernetes)
- Network policies restrict inter-service communication
- Only the gateway accepts external traffic
- Backend services only accept traffic from the gateway
- Database access restricted to backend service pods
- Egress limited to DNS and HTTPS

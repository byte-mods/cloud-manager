# Cloud Manager — Project Status Report
**Last Updated:** 2026-03-30

---

## Overview

Production-grade multi-cloud management platform (AWS, GCP, Azure) with 127 frontend pages, 10 Rust backend microservices, 27 database tables, and comprehensive infrastructure management capabilities.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo |
| Frontend | Next.js 15 (App Router, TypeScript) |
| UI | shadcn/ui + Radix + Tailwind CSS v4 |
| State | Zustand (18 stores) + TanStack Query v5 |
| Charts | Recharts |
| Canvas | React Flow (@xyflow/react) |
| Terminal | xterm.js |
| Code Editor | Monaco Editor |
| Forms | React Hook Form + Zod |
| Backend | Rust (Actix-Web 4) — 10 microservices |
| AI | Anthropic Claude API (SSE streaming) |
| Database | PostgreSQL 17 + Redis 8 + MongoDB (docker-compose) |
| Auth | NextAuth.js + JWT + TOTP MFA |
| Testing | Vitest (112 tests) + Rust integration tests (54 tests) |

---

## Running the Application

### Frontend Only (quickest)
```bash
cd apps/web
npx next dev
# Open http://localhost:3000/login
# Login: admin@cloudmanager.dev / admin123
```

### Full Stack (frontend + backend)
```bash
# 1. Start infrastructure
docker compose up -d

# 2. Run database migrations
cd services/migrations && bash run.sh

# 3. Start Rust services (each in separate terminal or background)
cd services
cargo run -p gateway &          # port 8080
cargo run -p auth-service &     # port 8081
cargo run -p cloud-service &    # port 8082
cargo run -p security-service & # port 8083
cargo run -p claude-ai-service &# port 8084 (needs ANTHROPIC_API_KEY)
cargo run -p tutorial-service & # port 8085
cargo run -p cost-service &     # port 8086
cargo run -p monitoring-service &   # port 8087
cargo run -p analytics-service &    # port 8088
cargo run -p data-engineering-service & # port 8089

# 4. Start frontend
cd apps/web && npx next dev     # port 3000
```

### Demo Accounts
| Email | Password | Role |
|---|---|---|
| admin@cloudmanager.dev | admin123 | Cloud Architect (full access) |
| devops@cloudmanager.dev | devops123 | DevOps Engineer |
| data@cloudmanager.dev | data123 | Data Engineer |
| sysadmin@cloudmanager.dev | sysadmin123 | System Admin |
| network@cloudmanager.dev | network123 | Network Admin |

---

## Frontend — 127 Pages

### Module Breakdown

| Module | Pages | Key Features |
|---|---|---|
| **Dashboard** | 1 | Quick stats, recent activity, quick actions |
| **Infrastructure Designer** | 4 | Drag-and-drop React Flow canvas, save/load projects, 3 templates, AI review, drift detection |
| **Cloud Connect** | 6 | Multi-cloud account management, live topology, service discovery, real-time traffic, security overview |
| **Compute** | 8 | Instances CRUD, Kubernetes, Serverless, Containers, Batch |
| **Storage** | 7 | Object/File/Block/Archive/Backup storage management |
| **Networking** | 8 | VPC management, Load Balancers, DNS, CDN, Firewall, VPN, Network Map |
| **Databases** | 7 | Relational/NoSQL/Cache/Warehouse management |
| **AI/ML** | 6 | Models, Training, MLOps, AI Services, GenAI |
| **Security & IAM** | 7 | IAM, Secrets, Certificates, Threat Detection, Audit, Audit Trail |
| **Security Testing** | 10 | VAPT, Vulnerability Scanner, DDoS Testing, Pen Testing, Compliance, Posture, Compliance-as-Code, Chaos Engineering |
| **Monitoring** | 8 | Dashboards, Metrics, Logs, Alerts, Tracing, Uptime, Incidents |
| **DevOps** | 8 | Pipelines, IaC, GitOps, Deployment, Config, Approvals |
| **Data Engineering** | 4 | ETL Pipelines, Streaming, Data Lake, Integration |
| **Cost Management** | 8 | Overview, Explorer, Budgets, Recommendations, Reservations, Forecasting, Anomalies, FinOps |
| **IoT** | 5 | Devices, Digital Twins, Rules, Edge |
| **Analytics** | 5 | Query Engines, Visualization, Search, Reports |
| **AI Assistant** | 4 | Claude Terminal (xterm.js), Chat (SSE), Suggestions |
| **Learn** | 5 | Learning Paths, Tutorials, Sandbox, Progress |
| **Settings** | 8 | Profile, Organization (Teams/Projects/Members/Approvals), Cloud Accounts, API Keys |

### Key UI Components
- **Command Palette** (Cmd+K) — Global search across pages, resources, actions
- **Notification Center** — Bell icon dropdown with real-time notifications
- **Sidebar** — Collapsible with 20+ sections, role-based visibility
- **Topbar** — Cloud provider switcher (AWS/GCP/Azure), region selector, search

---

## Backend — 10 Rust Microservices

| Service | Port | Routes | Data Store | Status |
|---|---|---|---|---|
| **gateway** | 8080 | 2 | — | Production-ready (JWT, rate limiting, circuit breaker) |
| **auth-service** | 8081 | 10 | PostgreSQL | Production-ready (JWT, MFA, RBAC) |
| **cloud-service** | 8082 | 33 | In-memory (seeded) | Working (49 resources across AWS/GCP/Azure) |
| **security-service** | 8083 | 17 | In-memory (seeded) | Working (scans, compliance, vulnerabilities, DDoS) |
| **claude-ai-service** | 8084 | 8 | — | Production-ready (real Anthropic API, SSE, WebSocket) |
| **tutorial-service** | 8085 | 9 | In-memory | Working (5 paths, 16 tutorials) |
| **cost-service** | 8086 | 9 | In-memory (seeded) | Working (dynamic costs, forecasting, waste detection) |
| **monitoring-service** | 8087 | 14 | In-memory (seeded) | Working (metrics, alerts, logs, traces, uptime) |
| **analytics-service** | 8088 | 10 | In-memory (seeded) | Working (query engines, visualizations, reports) |
| **data-engineering-service** | 8089 | 12 | In-memory (seeded) | Working (ETL, streaming, data lake) |

**Total: 124 API routes**

### Backend Architecture
- Trait-based cloud provider abstraction (ComputeProvider, StorageProvider, NetworkingProvider, DatabaseProvider)
- AWS/GCP/Azure adapter implementations
- In-memory stores with thread-safe `Arc<RwLock<...>>` / `Arc<Mutex<...>>`
- Seeded with realistic data per service startup
- CORS, logging (tracing), error handling on all services

---

## Database — 27 Tables (PostgreSQL)

### Migration Files (`services/migrations/`)
| Migration | Tables |
|---|---|
| 001_auth_tables | users, refresh_tokens |
| 002_cloud_resources | cloud_accounts, cloud_resources |
| 003_security_tables | security_scans, security_findings, compliance_assessments, vulnerabilities |
| 004_cost_tables | cost_budgets, cost_daily, cost_anomalies |
| 005_monitoring_tables | monitoring_dashboards, alert_rules, alert_events, audit_log |
| 006_data_engineering_tables | etl_pipelines, streaming_jobs, data_lake_datasets |
| 007_organizations | organizations, organization_members, teams, projects, approval_workflows, approval_requests |
| 008_infrastructure_designs | infrastructure_designs, drift_records, chaos_experiments |

Run migrations: `cd services/migrations && bash run.sh`

---

## Zustand Stores (18 total)

| Store | Purpose |
|---|---|
| auth-store | User session, role, authentication state |
| cloud-context-store | Active cloud provider, region, account |
| notification-store | Notification queue, unread count |
| ui-store | Command palette state, UI toggles |
| recent-pages-store | Last 5 visited pages (localStorage) |
| infrastructure-store | Infra designer projects, nodes, edges, templates, costs (localStorage) |
| cloud-connect-store | Connected cloud accounts, 62 discovered services, traffic data |
| cost-anomaly-store | 8 cost anomalies with detection data |
| drift-store | 12 drift detection resources with designed vs actual state |
| compliance-code-store | 7 compliance frameworks, 42 controls, 25 policy templates |
| incident-store | 5 incidents with correlated timeline events |
| organization-store | Teams, projects, members with CRUD |
| approval-store | Approval workflows and pending requests |
| audit-store | 30 audit trail events with replay capability |
| finops-store | FinOps KPIs, showback data, RI recommendations |
| chaos-store | Chaos experiment catalog, history, safety settings |
| terminal-store | Terminal session management for xterm.js |
| tutorial-store | Learning progress tracking |

---

## Custom Hooks (14 total)

| Hook | Purpose |
|---|---|
| use-resources | Fetch cloud resources via React Query |
| use-cost-data | Fetch cost overview data |
| use-monitoring | Fetch monitoring metrics/alerts/logs |
| use-security | Fetch IAM, secrets, certificates, audit data |
| use-security-score | Fetch security posture score |
| use-ai-ml | Fetch AI/ML models, training, MLOps |
| use-analytics | Fetch analytics engines, visualizations, reports |
| use-data-engineering | Fetch ETL pipelines, streaming, data lake |
| use-claude-chat | SSE streaming chat with Claude AI |
| use-cloud-provider | Cloud provider context from store |
| use-permissions | Role-based access control (5 roles, 17 modules) |
| use-architecture-review | AI infrastructure review engine (5 Well-Architected pillars) |
| use-realtime | WebSocket connection manager |
| use-tutorial-progress | Tutorial completion tracking |

---

## Testing — 166 Tests

### Backend (Rust) — 54 Tests
| Service | Tests | Coverage |
|---|---|---|
| cloud-service | 18 | CRUD, filtering, invalid provider, region |
| security-service | 21 | Scans, compliance, posture, vulnerabilities, DDoS |
| cost-service | 12 | Overview, explorer, budgets, recommendations, forecast, waste |
| gateway + others | 3 | Health checks |

### Frontend (Vitest) — 112 Tests
| Test File | Tests | Coverage |
|---|---|---|
| auth-store | 6 | State management, login/logout |
| cloud-context-store | 8 | Provider/region switching |
| notification-store | 9 | Add, read, clear notifications |
| infrastructure-store | 20 | Projects CRUD, templates, cost calculation, security analysis |
| cloud-connect-store | 21 | Accounts, services, cross-cloud connections |
| use-permissions | 21 | Role-based access for all 5 roles, 17 modules |
| notification-center | 9 | Component rendering, interactions |
| cloud API route | 5 | Proxy forwarding, error handling |
| security API route | 8 | Proxy + mock fallback verification |
| cost API route | 5 | Proxy forwarding, error handling |

Run tests:
```bash
# Backend
cd services && cargo test

# Frontend
cd apps/web && npx vitest run
```

---

## Feature Highlights

### Infrastructure Designer
- Drag-and-drop 60+ cloud services onto React Flow canvas
- Custom nodes with provider-colored borders, cost badges, security indicators
- Animated edges showing traffic flow with protocol colors
- 3 pre-built templates: 3-Tier Web App, Microservices, Serverless API
- Save/load projects to localStorage
- AI Review: Analyzes against 5 Well-Architected pillars (Security, Reliability, Performance, Cost, Operational Excellence)
- Real-time cost estimation

### Cloud Connect
- 3 connected accounts (AWS, GCP, Azure) with 62 discovered services
- Live topology visualization with React Flow
- Real-time traffic monitoring (2s refresh)
- Service detail pages with 5 tabs: Overview, Config, Security, Traffic, Cost
- Cross-cloud connection tracking

### Cost Management
- Dynamic cost providers with seeded PRNG (deterministic daily variation)
- Linear regression forecasting (30-day projection with confidence intervals)
- 14 optimization recommendations from waste analysis
- Cost anomaly detection with 8 seeded anomalies
- FinOps dashboard: showback/chargeback, unit economics, RI optimization

### Security
- VAPT scanning with 25 realistic findings
- 7 compliance frameworks (SOC2, ISO27001, HIPAA, PCI-DSS, GDPR, NIST CSF, CIS)
- Compliance-as-Code: Generate Terraform/OPA/CloudFormation from compliance controls
- Posture scoring (weighted average minus vulnerability penalties)
- Chaos Engineering with 8 experiment types and safety controls
- Comprehensive audit trail with animated timeline replay

### Monitoring
- 15 metrics with 24h of data points
- 8 alerts across severities
- 50 seeded log entries
- 5 distributed traces with spans
- Incident timeline with correlated events and AI root cause analysis

### Organizations
- Multi-tenancy: Organizations, Teams, Projects
- Member management with roles (Owner/Admin/Member/Viewer)
- Approval workflows for deployments, infrastructure changes, security changes, cost thresholds
- Budget allocation and tracking per team

---

## API Route Proxy Layer (Next.js BFF)

Frontend API routes at `/app/api/v1/` proxy to backend services:

| Route Pattern | Backend Service | Default Port |
|---|---|---|
| /api/v1/auth/* | auth-service | 8081 |
| /api/v1/cloud/* | cloud-service | 8082 |
| /api/v1/security/* | security-service | 8083 |
| /api/v1/ai/chat | claude-ai-service | 8084 |
| /api/v1/learn/* | tutorial-service | 8085 |
| /api/v1/cost/* | cost-service | 8086 |
| /api/v1/monitoring/* | monitoring-service | 8087 |
| /api/v1/analytics/* | analytics-service | 8088 |
| /api/v1/data-engineering/* | data-engineering-service | 8089 |
| /api/v1/ai-ml/* | (mock fallback) | 8086 |

Routes with mock fallback serve hardcoded data when the backend service is unavailable.

---

## Environment Variables (`.env.local`)

```
NEXT_PUBLIC_API_URL=http://localhost:3000/api
AUTH_SERVICE_URL=http://localhost:8081
CLOUD_SERVICE_URL=http://localhost:8082
SECURITY_SERVICE_URL=http://localhost:8083
CLAUDE_AI_SERVICE_URL=http://localhost:8084
TUTORIAL_SERVICE_URL=http://localhost:8085
COST_SERVICE_URL=http://localhost:8086
MONITORING_SERVICE_URL=http://localhost:8087
ANALYTICS_SERVICE_URL=http://localhost:8088
DATA_ENGINEERING_SERVICE_URL=http://localhost:8089
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-change-in-production
NEXT_PUBLIC_ENABLE_AI_ASSISTANT=true
NEXT_PUBLIC_ENABLE_TUTORIALS=true
```

---

## What's Working vs What Needs Real Cloud Integration

### Fully Working (with seeded/simulated data)
- All 127 frontend pages render and are interactive
- All 10 backend services compile and serve data
- Authentication with demo accounts
- RBAC with 5 roles across 17 modules
- Infrastructure designer with drag-drop, save/load, AI review
- Cost management with forecasting, anomalies, FinOps
- Security scanning, compliance, chaos engineering
- Monitoring with metrics, alerts, incidents
- Organization management with teams, projects, approvals
- Audit trail with replay

### Needs Real Cloud SDK Integration
- AWS SDK (aws-sdk-rust) for real EC2/S3/RDS/VPC operations
- GCP client libraries for real Compute/Storage/SQL/VPC operations
- Azure SDK for real VM/Blob/SQL/VNet operations
- Real cost data from AWS Cost Explorer, GCP Billing, Azure Cost Management
- Real monitoring from CloudWatch, Cloud Monitoring, Azure Monitor
- Real security scanning via OWASP ZAP, Nuclei, Trivy
- OAuth providers (Google, GitHub, Microsoft)
- HashiCorp Vault for credential storage
- Terraform/Pulumi actual execution
- ArgoCD/Flux real integration

---

## File Count Summary

| Category | Count |
|---|---|
| Frontend pages (page.tsx) | 127 |
| React components (.tsx) | 40 |
| Zustand stores (.ts) | 18 |
| Custom hooks (.ts) | 14 |
| Backend Rust files (.rs) | 154 |
| SQL migrations (.sql) | 9 |
| Frontend tests | 112 |
| Backend tests | 54 |
| **Total tests** | **166** |

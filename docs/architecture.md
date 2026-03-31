# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                         │
│              Next.js 15 App (React 19 + Tailwind)              │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS / WSS
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      API Gateway (Rust/Actix)                    │
│     JWT Validation · Rate Limiting · CORS · Circuit Breaker      │
│                         Port 8080                                │
└───┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────────────────┘
    │    │    │    │    │    │    │    │    │    │
    ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼
┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐
│Auth  ││Cloud ││Sec.  ││Mon.  ││Cost  ││AI    ││Data  ││Anal. ││Tutor.│
│:8081 ││:8082 ││:8083 ││:8084 ││:8085 ││:8086 ││:8087 ││:8088 ││:8089 │
└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘
   │       │       │       │       │       │       │       │       │
   ▼       ▼       ▼       ▼       ▼       ▼       ▼       ▼       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PostgreSQL 17  │  Redis 8  │  MongoDB 8  │  TimescaleDB  │  Meili  │
└──────────────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

**Stack**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui

### Route Groups
- `(auth)/` — Login, Register, Forgot Password (auth layout)
- `dashboard/` — All authenticated pages (sidebar layout)

### State Management
- **Zustand** — Client state (18 stores: auth, cloud context, UI, notifications, etc.)
- **TanStack Query v5** — Server state (API caching, invalidation, optimistic updates)

### Key Libraries
| Library | Purpose |
|---------|---------|
| React Hook Form + Zod | Form validation |
| Recharts + Apache ECharts | Data visualization |
| xterm.js | Terminal emulator |
| Monaco Editor | Code editing (IaC, queries, policies) |
| React Flow | Infrastructure designer canvas |
| @tanstack/react-table | Data tables with sorting, filtering, pagination |

### Component Hierarchy
```
components/
├── ui/          # shadcn/ui primitives (button, card, dialog, etc.)
├── layout/      # Dashboard layout, sidebar, topbar, command palette
├── infrastructure/  # Designer components (service nodes, edges)
└── networking/      # VPC/subnet visualization nodes
```

## Backend Architecture

**Stack**: Rust, Actix-Web 4, tokio async runtime

### Microservices

| Service | Port | Responsibility |
|---------|------|----------------|
| Gateway | 8080 | Auth validation, rate limiting, routing, circuit breaker |
| Auth | 8081 | JWT tokens, RBAC, MFA (TOTP), demo accounts |
| Cloud | 8082 | Multi-cloud CRUD operations (98 routes, 28 trait modules) |
| Security | 8083 | Scanning (Trivy, ZAP, Nuclei), compliance, IAM, KMS |
| Monitoring | 8084 | Metrics, logs, alarms (CloudWatch, Cloud Monitoring, Azure Monitor) |
| Cost | 8085 | Cost analysis, budgets, anomaly detection, forecasting |
| Claude AI | 8086 | Chat (SSE), architecture review, IaC generation |
| Data Eng. | 8087 | ETL, streaming, data lake operations |
| Analytics | 8088 | Query engines (Athena), result streaming |
| Tutorial | 8089 | Learning paths, progress tracking, sandboxes |

### Trait-Based Cloud Abstraction

Each cloud service category has a Rust trait. Provider adapters implement the trait:

```rust
#[async_trait]
pub trait ComputeProvider: Send + Sync {
    async fn list_instances(&self, region: &str) -> Result<Vec<Instance>>;
    async fn create_instance(&self, req: CreateInstanceRequest) -> Result<Instance>;
    async fn stop_instance(&self, id: &str) -> Result<()>;
    // ...
}

pub struct AwsComputeProvider { /* AWS SDK clients */ }
pub struct GcpComputeProvider { /* reqwest + REST */ }
pub struct AzureComputeProvider { /* reqwest + REST */ }
```

28 trait modules: compute, storage, networking, database, serverless, kubernetes, IAM, KMS, DNS, CDN, WAF, messaging, container registries, IoT, ML, and more.

### Cloud Common (`cloud-common`)
Shared utilities across all services:
- **Credential management** — AWS STS, GCP service accounts, Azure service principals
- **Redis caching** — TTL-based caching with configurable per-endpoint
- **Rate limiting** — Token bucket per API key
- **Mock data toggle** — `CLOUD_USE_MOCK_DATA=true` for development

## Database Architecture

| Database | Purpose | Key Tables/Collections |
|----------|---------|----------------------|
| PostgreSQL 17 | Primary relational store | users, roles, resources, costs, budgets, alerts, organizations |
| Redis 8 | Caching, sessions, rate limits | JWT sessions, API cache, rate limit counters |
| MongoDB 8 | Document store | audit logs, scan results, tutorial content |
| TimescaleDB | Time-series metrics | metric_data, cost_timeseries |
| MeiliSearch | Full-text search | resources, tutorials, documentation |

### Migration Files (8 total)
1. `auth_tables` — users, roles, permissions, sessions
2. `cloud_resources` — resource tracking across providers
3. `security_tables` — findings, scans, compliance results
4. `cost_tables` — costs, budgets, anomalies
5. `monitoring_tables` — metrics, logs, alerts
6. `data_engineering_tables` — jobs, datasets
7. `organizations` — orgs, teams, members
8. `infrastructure_designs` — design projects, templates

## Authentication Flow

```
Client                Gateway              Auth Service         Database
  │                      │                      │                  │
  │─── POST /login ─────▶│─── Forward ─────────▶│                  │
  │                      │                      │──── Verify ─────▶│
  │                      │                      │◀─── User ────────│
  │                      │                      │                  │
  │                      │◀── JWT + Refresh ────│                  │
  │◀── Set-Cookie ───────│                      │                  │
  │                      │                      │                  │
  │─── GET /api/* ──────▶│                      │                  │
  │    (Bearer JWT)      │── Validate JWT ──────│                  │
  │                      │── Check RBAC ────────│                  │
  │                      │── Forward to service─▶│                 │
```

- JWT access tokens: 15-minute expiry
- HTTP-only refresh cookies: 7-day expiry
- 5 roles with 17-module permission matrix
- MFA via TOTP (authenticator apps)
- OAuth: Google, GitHub, Microsoft Azure AD

## Key Design Decisions

1. **Monorepo with Turborepo** — Unified builds, shared configs, efficient caching
2. **Next.js App Router** — Server components, streaming, parallel routes
3. **Rust microservices** — Memory safety, performance, strong typing for cloud operations
4. **Trait-based abstraction** — Adding cloud providers is mechanical, not architectural
5. **Zustand over Redux** — Simpler API, less boilerplate, good DevTools
6. **shadcn/ui** — Copy-paste components, full customization control
7. **Mock data mode** — Full UI development without cloud credentials

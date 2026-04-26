# Cloud Manager - Development Reference

## Architecture Overview
- **Frontend**: Next.js 15 (App Router) + React 19 + Tailwind v4 + Zustand + TanStack Query
- **Backend**: 10 Rust microservices (Actix-Web 4) on ports 8080-8089
- **Database**: SurrealDB embedded (RocksDB backend) per service — no external DB needed
- **Auth**: NextAuth.js + JWT + TOTP MFA + RBAC (5 roles, 17 modules)
- **Cloud SDKs**: AWS SDK (native), GCP (REST), Azure (REST) — 22 provider traits defined
- **AI**: Real Anthropic Claude API (SSE streaming, IaC generation, WebSocket terminal)
- **Feature Flag**: `CLOUD_USE_MOCK_DATA` — default `false` (real mode). Set `true` in `.env` for local dev without credentials.

## Service Ports
| Service | Port | DB Path |
|---------|------|---------|
| gateway | 8080 | ./data/gateway |
| auth-service | 8081 | ./data/auth |
| cloud-service | 8082 | ./data/cloud |
| security-service | 8083 | ./data/security |
| monitoring-service | 8084 | ./data/monitoring |
| cost-service | 8085 | ./data/cost |
| claude-ai-service | 8086 | N/A (external API) |
| data-engineering-service | 8087 | ./data/data-engineering |
| analytics-service | 8088 | ./data/analytics |
| tutorial-service | 8089 | N/A (static content) |

## Build & Run
```bash
# Backend
cd services && cargo check          # Type check all services
cd services && cargo test            # Run tests (needs disk space for RocksDB)
# Frontend
cd apps/web && pnpm install && pnpm dev
# Full stack
./start.sh                           # Has known issues, see gaps below
```

---

# CROSS-CLOUD PROVIDER STATUS MATRIX

## 22 Provider Traits × 3 Clouds — SDK Routing Status

This is the ground truth for what's actually wired end-to-end (handler → factory → SDK).

### Layer 1: Handler Status (cloud-service/src/handlers/)

| Handler | Calls Provider Factory? | Status |
|---------|------------------------|--------|
| compute.rs | ✅ `get_compute_provider()` | REAL |
| storage.rs | ✅ `get_storage_provider()` | REAL |
| networking.rs | ✅ `get_networking_provider()` | REAL |
| database.rs | ✅ `get_database_provider()` | REAL |
| api_gateway.rs | ✅ `get_api_gateway_provider()` | REAL |
| cdn.rs | ✅ `get_cdn_provider()` | REAL |
| cache_db.rs | ✅ `get_cache_db_provider()` | REAL |
| nosql.rs | ✅ `get_nosql_provider()` | REAL |
| container_registry.rs | ✅ `get_container_registry_provider()` | REAL |
| ml.rs | ✅ `get_ml_provider()` | REAL |
| iot.rs | ✅ `get_iot_provider()` | REAL |
| **iam.rs** | ❌ Returns `vec![]` | **STUB** |
| **dns.rs** | ❌ Returns `vec![]` | **STUB** |
| **waf.rs** | ❌ Returns `vec![]` | **STUB** |
| **messaging.rs** | ❌ Returns `vec![]` | **STUB** |
| **kms.rs** | ❌ Returns `vec![]` | **STUB** |
| **autoscaling.rs** | ❌ Returns `vec![]` | **STUB** |
| **volume.rs** | ❌ Returns `vec![]` | **STUB** |
| **serverless.rs** | ❌ Returns `vec![]` (one-liners) | **STUB** |
| **kubernetes.rs** | ❌ Returns `vec![]` (one-liners) | **STUB** |
| traffic.rs | ✅ `get_traffic_provider()` | REAL (mock-only factory) |
| workflows.rs | ✅ `get_workflow_provider()` | REAL |
| devops.rs | ✅ Real SDK + seed fallback | MIXED |

### Layer 2: Factory Routing (providers/mod.rs)

| Factory Function | AWS→SDK | GCP→SDK | Azure→SDK | Notes |
|-----------------|---------|---------|-----------|-------|
| `get_compute_provider` | ✅ | ✅ | ✅ | Full cross-cloud |
| `get_storage_provider` | ✅ | ✅ | ✅ | Full cross-cloud |
| `get_networking_provider` | ✅ | ✅ | ✅ | Full cross-cloud |
| `get_database_provider` | ✅ | ✅ | ✅ | Full cross-cloud |
| `get_serverless_provider` | ✅ | ✅ | ✅ | Full cross-cloud (but handler is STUB) |
| `get_api_gateway_provider` | ✅ | ❌ mock | ❌ mock | AWS only |
| `get_cdn_provider` | ✅ | ❌ mock | ❌ mock | AWS only |
| `get_nosql_provider` | ✅ | ❌ mock | ❌ mock | AWS only |
| `get_cache_db_provider` | ✅ | ❌ mock | ❌ mock | AWS only |
| `get_container_registry_provider` | ✅ | ❌ mock | ❌ mock | AWS only |
| `get_workflow_provider` | ✅ | ❌ mock | ❌ mock | AWS only |
| `get_traffic_provider` | ❌ mock | ❌ mock | ❌ mock | Always mock for all |
| `get_kubernetes_provider` | ❌ mock | ❌ mock | ❌ mock | Always mock for all |
| `get_iot_provider` | ❌ mock | ❌ mock | ❌ mock | Always mock for all |
| `get_ml_provider` | ❌ mock | ❌ mock | ❌ mock | Always mock for all |
| **NO FACTORY** for: | IAM, DNS, WAF, Messaging, KMS, AutoScaling, Volume | | | 7 traits orphaned |

### Layer 3: SDK Implementation Depth

| Trait | AWS SDK | GCP SDK | Azure SDK |
|-------|---------|---------|-----------|
| Compute | ✅ 7/7 | ✅ 7/7 | ✅ 7/7 |
| Storage | ✅ 14/14 | ✅ 14/14 | ✅ 14/14 |
| Networking | ✅ 41/41 | ⚠️ 19/41 (22 stubs) | ⚠️ 19/41 (22 stubs) |
| Database | ✅ 9/9 | ✅ 9/9 | ⚠️ 7/9 |
| Serverless | ✅ 7/7 | ✅ 7/7 | ⚠️ 4/7 |
| ApiGateway | ✅ 8/8 | ✅ 8/8 | ✅ 8/8 |
| CDN | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 |
| Traffic | ✅ 2/2 | ✅ 2/2 | ✅ 2/2 |
| Kubernetes | ❌ 0/7 | ✅ 7/7 | ⚠️ 2/7 |
| ContainerRegistry | ✅ 7/7 | ✅ 7/7 | ⚠️ 4/7 |
| Workflow | ✅ 4/4 | ✅ 4/4 | ⚠️ 2/4 |
| NoSQL | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 |
| CacheDb | ✅ 4/4 | ✅ 4/4 | ✅ 4/4 |
| AutoScaling | ❌ none | ✅ 5/5 | ✅ 5/5 |
| DNS | ❌ none | ✅ 4/4 | ✅ 4/4 |
| IAM | ❌ none | ✅ 9/9 | ✅ 9/9 |
| KMS | ❌ none | ✅ 5/5 | ✅ 5/5 |
| Messaging | ❌ none | ✅ 7/7 | ✅ 7/7 |
| Volume | ❌ none | ✅ 6/6 | ✅ 6/6 |
| WAF | ❌ none | ✅ 5/5 | ✅ 5/5 |
| ML | ❌ none | ✅ 5/5 | ✅ 5/5 |
| IoT | ❌ none | ✅ 5/5 | ✅ 5/5 |

**Summary**: GCP SDK implements all 22 traits. Azure SDK implements all 22. AWS SDK implements 13/22 (remaining 9 handled via AWS SDK directly in handlers — but those handlers are currently STUBS).

### GCP/Azure Networking Stubs (22 methods each)
Both return "not yet implemented" for AWS-centric networking concepts:
- Elastic IPs (4 methods) — no direct GCP/Azure equivalent
- NAT Gateways (2 methods) — GCP uses Cloud NAT, Azure uses NAT Gateway (different API)
- Internet Gateways (4 methods) — not applicable to GCP/Azure architecture
- Route Tables (5 methods) — GCP uses Cloud Router, Azure uses Route Tables (different API)
- Security Groups (4 methods) — GCP uses Firewall Rules, Azure uses NSGs
- VPC Peering (3 methods) — different APIs per cloud

### Azure Additional Stubs (11 methods beyond networking)
- Kubernetes: create/get/delete cluster, create/delete/list/scale node groups (5 methods)
- Serverless: invoke_function, start_image_scan (3 methods)
- Workflow: get_state_machine, start_execution (2 methods)
- Database: create_read_replica, restore_to_point_in_time (2 methods)

---

# KNOWN GAPS & TODO LIST

Items are grouped by priority. Fix in order: CRITICAL > HIGH > MEDIUM > LOW.

---

## CRITICAL - Backend Handler Stubs (Return Empty Data)

These cloud-service handlers return empty vectors instead of calling real providers. The `_c: web::Data<Arc<ProviderContext>>` parameter is accepted but never used.

### C1. Messaging handlers return empty
- **File**: `services/cloud-service/src/handlers/messaging.rs`
- **Status**: All handlers return `vec![]` or hardcoded `{"status": "..."}` — no provider call
- **Fix**: Create `get_messaging_provider()` factory, wire handler to call it

### C2. IAM handlers return empty
- **File**: `services/cloud-service/src/handlers/iam.rs`
- **Status**: `list_users` → `vec![]`, `list_roles` → `vec![]`, `list_policies` → `vec![]`, mutations return hardcoded status
- **Fix**: Create `get_iam_provider()` factory, wire handlers

### C3. KMS handlers return empty
- **File**: `services/cloud-service/src/handlers/kms.rs`
- **Status**: `list_keys` → `vec![]`, `get_key` → `vec![]`
- **Fix**: Create `get_kms_provider()` factory, wire handlers

### C4. DNS handlers return empty
- **File**: `services/cloud-service/src/handlers/dns.rs`
- **Status**: `list_zones` → `vec![]`, `list_records` → `vec![]`
- **Fix**: Create `get_dns_provider()` factory, wire handlers

### C5. WAF handlers return empty
- **File**: `services/cloud-service/src/handlers/waf.rs`
- **Status**: `list_web_acls` → `vec![]`, `get_web_acl` → `vec![]`, `list_rules` → `vec![]`
- **Fix**: Create `get_waf_provider()` factory, wire handlers

### C6. AutoScaling handlers return empty
- **File**: `services/cloud-service/src/handlers/autoscaling.rs`
- **Status**: `list_groups` → `vec![]`, `get_group` → `vec![]`
- **Fix**: Create `get_autoscaling_provider()` factory, wire handlers

### C7. Volume handlers return empty
- **File**: `services/cloud-service/src/handlers/volume.rs`
- **Status**: `list_volumes` → `vec![]`
- **Fix**: Create `get_volume_provider()` factory, wire handlers

### C8. Serverless handlers return empty (one-liner stubs)
- **File**: `services/cloud-service/src/handlers/serverless.rs`
- **Status**: All 7 handlers are single-line stubs returning `vec![]` or `{"status":"..."}`. Never calls `get_serverless_provider()` despite factory existing with full 3-cloud routing.
- **Fix**: Wire handlers to call existing `get_serverless_provider()` factory

### C9. Kubernetes handlers return empty (one-liner stubs)
- **File**: `services/cloud-service/src/handlers/kubernetes.rs`
- **Status**: All 8 handlers are single-line stubs. Never calls `get_kubernetes_provider()` despite factory existing.
- **Fix**: Wire handlers to call existing `get_kubernetes_provider()` factory

---

## CRITICAL - 7 Missing Factory Functions (SDK Implementations Orphaned)

The `providers/mod.rs` file only has 15 factory functions. These 7 traits have full GCP+Azure SDK implementations but NO factory function and NO handler wiring:

### C10. Missing factory functions for 7 traits
- **File**: `services/cloud-service/src/providers/mod.rs`
- **Traits needing factories**: AutoScaling, DNS, IAM, KMS, Messaging, Volume, WAF
- **Note**: `use crate::traits::{...}` import line (line 27) does NOT include these 7 traits
- **Fix**: Add `use crate::traits::{AutoScalingProvider, DnsProvider, IamProvider, KmsProvider, MessagingProvider, VolumeProvider, WafProvider}` and create 7 factory functions following the 3-cloud pattern (like `get_compute_provider`)

---

## CRITICAL - 6 Factory Functions Missing GCP/Azure SDK Routing

These factories exist but only route AWS to real SDK. GCP and Azure always fall back to mock:

### C11. Factories with AWS-only SDK routing
- **File**: `services/cloud-service/src/providers/mod.rs`
- **Affected factories**:
  - `get_api_gateway_provider()` (line 188) — `if provider == CloudProvider::Aws` only
  - `get_cdn_provider()` (line 208) — AWS only
  - `get_nosql_provider()` (line 252) — AWS only
  - `get_cache_db_provider()` (line 272) — AWS only
  - `get_container_registry_provider()` (line 316) — AWS only
  - `get_workflow_provider()` (line 336) — AWS only
- **Fix**: Add `CloudProvider::Gcp => GcpSdkProvider`, `CloudProvider::Azure => AzureSdkProvider` branches (impls exist in gcp_sdk.rs and azure_sdk.rs)

### C12. Factories that always use mock (no SDK for any provider)
- **File**: `services/cloud-service/src/providers/mod.rs`
- **Affected factories**:
  - `get_traffic_provider()` (line 228) — no SDK check at all
  - `get_kubernetes_provider()` (line 240) — no SDK check at all
  - `get_iot_provider()` (line 292) — no SDK check at all
  - `get_ml_provider()` (line 304) — no SDK check at all
- **Fix**: Add `use_real_sdk()` check with 3-cloud routing (GCP/Azure SDKs implement these fully; AWS SDK has Kubernetes stubbed)

---

## CRITICAL - Docker & Deployment Gaps

### C13. docker-compose.yml missing volume mounts for 6 services
- **File**: `docker-compose.yml`
- **Services missing volumes**: monitoring, cost, claude-ai, data-engineering, analytics, tutorial
- **Fix**: Add `volumes: - {service}_data:/data` and declare volumes at bottom

### C14. docker-compose.yml missing environment variables
- **File**: `docker-compose.yml`
- **Missing**: `SURREAL_DB_PATH`, `JWT_SECRET` for monitoring, cost, data-engineering, analytics, tutorial services
- **Fix**: Add env vars matching auth/cloud/security pattern

### C15. start.sh references non-existent docker services
- **File**: `start.sh` lines 91-93
- **Issue**: Tries `docker compose up -d postgres redis` but these don't exist in docker-compose.yml
- **Fix**: Remove postgres/redis startup or add them to docker-compose

### C16. start.sh port mismatches with docker-compose
- **File**: `start.sh` lines 241-271
- **Issue**: Hardcoded port assignments don't match docker-compose port mappings
- **Fix**: Align ports or read from docker-compose

### C17. No .env.example file
- **Fix**: Create `.env.example` with all required variables documented

### C18. No healthchecks in docker-compose
- **File**: `docker-compose.yml`
- **Issue**: No healthcheck blocks for any service — failed containers remain running
- **Fix**: Add healthcheck endpoints and configure docker healthchecks

---

## HIGH - GCP/Azure SDK Networking Stubs

### H1. GCP SDK networking methods return "not yet implemented"
- **File**: `services/cloud-service/src/providers/gcp_sdk.rs`
- **Lines**: 426-500 (elastic IPs, NAT gateways, internet gateways, route tables, security groups, VPC peering)
- **Fix**: Map to GCP equivalents — Cloud NAT, Cloud Router, Firewall Rules, VPC peering REST APIs
- **Note**: Some concepts (Internet Gateway, Elastic IP) have no direct GCP equivalent — consider returning "not applicable" instead of error

### H2. Azure SDK networking methods return "not yet implemented"
- **File**: `services/cloud-service/src/providers/azure_sdk.rs`
- **Lines**: 528-601 (same networking features)
- **Fix**: Map to Azure equivalents — NAT Gateway, UDR, NSG, VNet Peering REST APIs

### H3. Azure SDK has 11 additional stub methods beyond networking
- **File**: `services/cloud-service/src/providers/azure_sdk.rs`
- **Stubs**: Kubernetes (5 methods), Serverless (3), Workflow (2), Database (2) — see matrix above
- **Fix**: Implement using Azure REST APIs for AKS, Functions, Logic Apps, SQL DB

### H4. AWS SDK missing 9 full trait implementations
- **File**: `services/cloud-service/src/providers/aws_sdk.rs`
- **Missing traits**: IAM, DNS, WAF, Messaging, KMS, AutoScaling, Volume, ML, IoT
- **Note**: These are handled via AWS SDK in GCP/Azure but not in AWS SDK provider. The handlers are stubs anyway (C1-C7), so this only matters once handlers are wired.
- **Fix**: Implement using aws-sdk-iam, aws-sdk-route53, aws-sdk-wafv2, aws-sdk-sqs/sns, aws-sdk-kms, aws-sdk-autoscaling, aws-sdk-ec2 (volumes), aws-sdk-sagemaker, aws-sdk-iot

---

## HIGH - Frontend Mock Data Still Present

### H5. cloud-connect-store.ts has 1200+ lines of permanent seed data
- **File**: `apps/web/stores/cloud-connect-store.ts`
- **Lines**: 143-1414 (seedAccounts, awsServices, gcpServices, azureServices arrays)
- **Issue**: Store initializes with seed data and never replaces it — `fetchConnections()` exists but is never called automatically. This is the **primary multi-cloud dashboard** and runs entirely on fake data.
- **Fix**: Call `fetchConnections()` on mount, delete seed constants

### H6. GenAI playground uses mock LLM response
- **File**: `apps/web/app/dashboard/ai-ml/genai/page.tsx` line 48
- **Issue**: Generates fake "Based on your prompt..." response instead of calling Claude API
- **Fix**: Wire to `/api/v1/ai/chat` endpoint with streaming

### H7. Sandbox terminal has hardcoded mock commands
- **File**: `apps/web/app/dashboard/learn/sandbox/page.tsx` lines 43-53
- **Issue**: 9 hardcoded command responses (aws, terraform, kubectl). Has real backend call at line 74 but falls back to mock.
- **Fix**: Ensure backend `/api/v1/learn/sandbox/execute` works, remove mock fallback

### H8. Data engineering page has hardcoded value
- **File**: `apps/web/app/dashboard/data-engineering/page.tsx` line 70
- **Issue**: `const dataLakeSize = "4.2 TB"` hardcoded
- **Fix**: Fetch from data-engineering API

### H9. Pen-testing page has empty checklist
- **File**: `apps/web/app/dashboard/security-testing/pen-testing/page.tsx` line 116
- **Issue**: `const mockOWASPChecklist: ChecklistItem[] = []` — always empty
- **Fix**: Populate from security-service API

### H10. Live traffic simulation uses Math.random()
- **Files**: `app/dashboard/cloud-connect/topology/page.tsx` (line 252), `cloud-connect/services/[id]/page.tsx` (line 199)
- **Issue**: Generates synthetic metrics with `Math.random()` on interval. Also in `infrastructure-store.ts` (lines 573, 588).
- **Fix**: Use real traffic data from monitoring-service WebSocket

### H11. Monitoring sparkline has static data points
- **File**: `app/dashboard/monitoring/page.tsx` lines 50-70
- **Issue**: `ResponseTimeSparkline()` uses hardcoded array `[120, 135, 128, 145, 160, ...]`
- **Fix**: Pull from real metrics endpoint

---

## HIGH - Monitoring Simulated Data in Handlers

### H12. WebSocket metrics handler generates fake data
- **File**: `services/monitoring-service/src/handlers/websocket.rs` lines 46-68
- **Issue**: `SimulatedValues` struct generates CPU/memory/disk/network metrics via random walks. Comment on line 146: "retained for future use with real cloud SDK"
- **Fix**: Read real metrics from CloudWatch/Stackdriver/Azure Monitor or SurrealDB

### H13. Log stream handler generates mock log entries
- **File**: `services/monitoring-service/src/handlers/log_stream.rs` lines 53-110
- **Issue**: Hardcoded arrays of SERVICES, ERROR_MESSAGES, WARN_MESSAGES, INFO_MESSAGES, DEBUG_MESSAGES. `generate_mock_entries()` picks randomly from these pools.
- **Fix**: Stream real logs from CloudWatch Logs / Cloud Logging / Azure Monitor

---

## HIGH - Test Files Need Updating

### H14. Cloud-service integration tests use old in-memory store
- **File**: `services/cloud-service/tests/integration.rs`
- **Issue**: Still uses `store::create_seeded_store()` and `use_mock_data: true`
- **Fix**: Update to use SurrealDB test instance

### H15. Cost-service integration tests use in-memory HashMap
- **File**: `services/cost-service/tests/integration.rs`
- **Issue**: Line 31 uses `Mutex::new(HashMap::new())` instead of Database
- **Fix**: Update to use SurrealDB

---

## MEDIUM - Infrastructure Config Issues

### M1. Terraform architecture mismatch
- **File**: `infra/terraform/main.tf`
- **Issue**: Deploys Aurora PostgreSQL, ElastiCache Redis, DocumentDB — but app uses SurrealDB embedded. Infrastructure is completely wrong for the actual architecture.
- **Fix**: Rewrite Terraform for SurrealDB embedded architecture (ECS/EKS with persistent EBS volumes) or migrate to external SurrealDB

### M2. K8s manifests missing PersistentVolumeClaims
- **File**: `infra/k8s/`
- **Issue**: No PV/PVC for SurrealDB data directories — pods lose ALL data on restart
- **Fix**: Add PVC manifests for each stateful service

### M3. K8s ConfigMap SURREAL_DB_PATH too generic
- **File**: `infra/k8s/configmap.yaml`
- **Issue**: Sets `SURREAL_DB_PATH: "/data"` (generic) vs docker-compose `SURREAL_DB_PATH: /data/{service}` (service-specific). Could cause data collision if services share a volume.
- **Fix**: Use service-specific paths

### M4. K8s secrets.yaml has placeholder values
- **File**: `infra/k8s/secrets.yaml`
- **Issue**: Contains "CHANGE_ME" literal values for DB_PASSWORD, MONGO_PASSWORD, JWT_SECRET, NEXTAUTH_SECRET
- **Fix**: Use external secret management (Vault, AWS Secrets Manager)

### M5. Helm values reference non-existent infrastructure
- **File**: `infra/helm/cloud-manager/values-production.yaml`
- **Issue**: References non-existent ECR registry (account ID `123456789`), enables postgresql/redis/mongodb that don't exist
- **Fix**: Create production values matching actual SurrealDB architecture

### M6. Frontend .env.local has wrong service URL
- **File**: `apps/web/.env.local` line 19
- **Issue**: `AI_ML_SERVICE_URL=http://localhost:8082` — should be 8082 (cloud-service) routes AI-ML, but naming is confusing
- **Fix**: Verify URL mapping is correct

### M7. Gateway uses catch-all proxy
- **File**: `services/gateway/src/routes.rs`
- **Issue**: Routes via `/api/v1/{service}/{path:.*}` — works but no explicit validation of service names or route documentation
- **Note**: All 10 services covered through dynamic routing. Not a bug, but fragile.

---

## MEDIUM - Security Issues

### M8. CORS too permissive in ALL services
- **All service main.rs files**: `allow_any_origin().allow_any_method().allow_any_header()`
- **Issue**: K8s ConfigMap specifies `CORS_ORIGINS: "https://cloud-manager.example.com"` but code ignores it
- **Fix**: Read CORS_ORIGINS from env var, restrict in production

### M9. Hardcoded JWT secret in multiple files
- **Files**: `.env`, `docker-compose.yml`, `apps/web/.env.local`, `infra/k8s/secrets.yaml`
- **Issue**: Same default secret everywhere, committed to repo
- **Fix**: Use environment-specific secrets, never commit defaults

### M10. No API key authentication for programmatic access
- **Issue**: Only JWT auth — no way for external tools to authenticate via API keys
- **Fix**: Add API key auth to gateway

---

## LOW - Code Quality & Cleanup

### L1. Auth-service TODO in auth flow
- **File**: `services/auth-service/src/handlers/auth.rs` line 151
- **Issue**: `TODO: extract user ID from JWT. For now, use email-based lookup.`

### L2. SERVICE_COSTS in infrastructure-store is hardcoded
- **File**: `apps/web/stores/infrastructure-store.ts` lines 73-146
- **Issue**: Cost estimates are static constants, not fetched from API
- **Note**: Acceptable as reference data — costs don't change frequently

### L3. Compliance framework controls are hardcoded
- **File**: `apps/web/stores/compliance-code-store.ts` lines 54-109
- **Issue**: 42 controls across 7 frameworks are client-side constants
- **Note**: Acceptable as reference data — compliance frameworks are stable

### L4. Chaos experiment catalog is hardcoded
- **File**: `apps/web/stores/chaos-store.ts` lines 80+
- **Issue**: Experiment type definitions are client-side constants
- **Note**: Acceptable — these define experiment types, not runtime data

### L5. PROJECT_STATUS.md and DEVELOPMENT_STATUS.md are outdated
- **Fix**: Update to reflect current SurrealDB architecture

### L6. Mock provider files still exist as fallbacks
- **Files**: `analytics-service/src/providers/mock.rs`, `data-engineering-service/src/providers/mock.rs`, `security-service/src/providers/mock_security.rs`
- **Note**: These serve as fallback when cloud APIs are unavailable. OK to keep.

### L7. DevOps handlers use hybrid real+seed pattern
- **File**: `services/cloud-service/src/handlers/devops.rs`
- **Issue**: Attempts real AWS CodePipeline/CodeBuild SDK, falls back to seed data. ArgoCD integration attempted (line 317-363) with fallback.
- **Note**: Acceptable pattern during development. Should eventually remove seed fallback.

---

## Completion Checklist

When working through items:
1. Pick an item from the highest uncompleted priority
2. Read the referenced files before making changes
3. Run `cargo check` after backend changes
4. Run `npx tsc --noEmit` after frontend changes
5. Mark item as done by adding `[DONE]` prefix to the heading

### Cross-Cloud Completion Roadmap (ordered by impact)

**Phase A — Wire 9 stub handlers to existing factories (C1-C9)**
The serverless and kubernetes handlers have working factories already. IAM/DNS/WAF/Messaging/KMS/AutoScaling/Volume need new factories first (C10).

**Phase B — Create 7 missing factory functions (C10)**
Add `get_iam_provider()`, `get_dns_provider()`, etc. to `providers/mod.rs` with full 3-cloud routing.

**Phase C — Add GCP/Azure routing to 6 AWS-only factories (C11)**
Change `if provider == CloudProvider::Aws` to full match arms for all 3 providers.

**Phase D — Enable SDK routing in 4 mock-only factories (C12)**
Add `use_real_sdk()` check to traffic, kubernetes, iot, ml factories.

**Phase E — Implement 9 missing AWS SDK trait impls (H4)**
So AWS has parity with GCP/Azure.

**Phase F — Fill GCP/Azure networking stubs (H1, H2)**
Map AWS-centric concepts to cloud-native equivalents.

**Phase G — Fill Azure additional stubs (H3)**
AKS, Functions, Logic Apps, SQL DB implementations.

# Cloud Manager - Development Reference

## Architecture Overview
- **Frontend**: Next.js 15 (App Router) + React 19 + Tailwind v4 + Zustand + TanStack Query
- **Backend**: 10 Rust microservices (Actix-Web 4) on ports 8080-8089
- **Database**: SurrealDB embedded (RocksDB backend) per service — no external DB needed
- **Auth**: NextAuth.js + JWT + TOTP MFA + RBAC (5 roles, 17 modules)
- **Cloud SDKs**: AWS SDK (native), GCP (REST), Azure (REST) — all 22 provider traits implemented
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

# KNOWN GAPS & TODO LIST

Items are grouped by priority. Fix in order: CRITICAL > HIGH > MEDIUM > LOW.

---

## CRITICAL - Backend Handler Stubs (Return Empty Data)

These cloud-service handlers return empty vectors instead of calling real providers.

### C1. Messaging handlers return empty
- **File**: `services/cloud-service/src/handlers/messaging.rs`
- **Lines**: 59 (`list_queues`), 99 (`list_topics`), create/delete do nothing
- **Fix**: Wire to `get_messaging_provider()` factory, call SQS/Pub-Sub/Service Bus

### C2. IAM handlers return empty
- **File**: `services/cloud-service/src/handlers/iam.rs`
- **Lines**: 65 (`list_users`), 105 (`list_roles`), 145 (`list_policies`)
- **Fix**: Wire to `get_iam_provider()` factory

### C3. KMS handlers return empty
- **File**: `services/cloud-service/src/handlers/kms.rs`
- **Lines**: 65 (`list_keys`), 83 (`get_key`)
- **Fix**: Wire to `get_kms_provider()` factory

### C4. DNS handlers return empty
- **File**: `services/cloud-service/src/handlers/dns.rs`
- **Lines**: 48 (`list_zones`), 66 (`list_records`)
- **Fix**: Wire to `get_dns_provider()` factory

### C5. WAF handlers return empty
- **File**: `services/cloud-service/src/handlers/waf.rs`
- **Lines**: 54 (`list_web_acls`), 72 (`get_web_acl`), 90 (`list_rules`)
- **Fix**: Wire to `get_waf_provider()` factory

### C6. AutoScaling handlers return empty
- **File**: `services/cloud-service/src/handlers/autoscaling.rs`
- **Lines**: 61 (`list_groups`), 79 (`get_group`)
- **Fix**: Wire to `get_autoscaling_provider()` factory

### C7. Volume handlers return empty
- **File**: `services/cloud-service/src/handlers/volume.rs`
- **Lines**: 66 (`list_volumes`)
- **Fix**: Wire to `get_volume_provider()` factory

---

## CRITICAL - Provider Factory Missing GCP/Azure Routing

The factory functions in `services/cloud-service/src/providers/mod.rs` only route AWS through SDK providers. GCP and Azure fall back to mock for these traits:

### C8. Factory functions need GCP/Azure SDK routing
- **File**: `services/cloud-service/src/providers/mod.rs`
- **Traits missing GCP/Azure real routing**:
  - `get_api_gateway_provider()` (line ~188) — AWS only
  - `get_cdn_provider()` (line ~207) — AWS only
  - `get_kubernetes_provider()` (line ~239) — NO SDK for any provider
  - `get_nosql_provider()` (line ~251) — AWS only
  - `get_cache_db_provider()` (line ~271) — AWS only
  - `get_iot_provider()` (line ~291) — NO SDK for any provider
  - `get_ml_provider()` (line ~303) — NO SDK for any provider
  - `get_container_registry_provider()` (line ~315) — AWS only
  - `get_workflow_provider()` (line ~335) — AWS only
  - `get_traffic_provider()` (line ~228) — NO SDK for any provider
- **Fix**: Add `CloudProvider::Gcp => GcpSdkProvider`, `CloudProvider::Azure => AzureSdkProvider` branches (impls already exist from Phase 5)

---

## CRITICAL - Docker & Deployment Gaps

### C9. docker-compose.yml missing volume mounts for 6 services
- **File**: `docker-compose.yml`
- **Services missing volumes**: monitoring, cost, claude-ai, data-engineering, analytics, tutorial
- **Fix**: Add `volumes: - {service}_data:/data` and declare volumes at bottom

### C10. docker-compose.yml missing environment variables
- **File**: `docker-compose.yml`
- **Missing**: `SURREAL_DB_PATH`, `JWT_SECRET` for monitoring, cost, data-engineering, analytics, tutorial services
- **Fix**: Add env vars matching auth/cloud/security pattern

### C11. start.sh references non-existent docker services
- **File**: `start.sh` lines 91-93
- **Issue**: Tries `docker compose up -d postgres redis` but these don't exist in docker-compose.yml
- **Fix**: Remove postgres/redis startup or add them to docker-compose

### C12. start.sh port mismatches with docker-compose
- **File**: `start.sh` lines 241-271
- **Issue**: Hardcoded port assignments don't match docker-compose port mappings
- **Fix**: Align ports or read from docker-compose

### C13. No .env.example file
- **Fix**: Create `.env.example` with all required variables documented

---

## HIGH - GCP/Azure SDK Networking Stubs

### H1. GCP SDK networking methods return "not yet implemented"
- **File**: `services/cloud-service/src/providers/gcp_sdk.rs`
- **Lines**: 426-500 (elastic IPs, NAT gateways, internet gateways, route tables, security groups, VPC peering)
- **Fix**: Implement using GCP Cloud NAT, Cloud Router, Firewall Rules REST APIs

### H2. Azure SDK networking methods return "not yet implemented"
- **File**: `services/cloud-service/src/providers/azure_sdk.rs`
- **Lines**: 528-601 (same networking features)
- **Fix**: Implement using Azure Network REST APIs

### H3. Mock providers still have extensive stub/mock code
- **Files**: `aws.rs`, `gcp.rs`, `azure.rs` (the mock providers, NOT the SDK providers)
- **Issue**: 100+ methods returning mock IDs like "eip-mock", "nat-mock", "igw-mock"
- **Note**: These are fallback providers when real SDK is unavailable. OK for now but should eventually be removed.

---

## HIGH - Frontend Mock Data Still Present

### H4. cloud-connect-store.ts has 1200+ lines of unused seed data
- **File**: `apps/web/stores/cloud-connect-store.ts`
- **Lines**: 143-1414 (seedAccounts, awsServices, gcpServices, azureServices arrays)
- **Issue**: Dead code — store initializes empty and fetches from API, but seed constants remain
- **Fix**: Delete seedAccounts, all service arrays, seedActivities, makeIssue helper

### H5. GenAI playground uses mock LLM response
- **File**: `apps/web/app/dashboard/ai-ml/genai/page.tsx` line 48
- **Issue**: Generates fake "Based on your prompt..." response instead of calling Claude API
- **Fix**: Wire to `/api/v1/ai/chat` endpoint with streaming

### H6. Sandbox terminal has hardcoded mock commands
- **File**: `apps/web/app/dashboard/learn/sandbox/page.tsx` lines 43-53
- **Issue**: 9 hardcoded command responses (aws, terraform, kubectl)
- **Fix**: Wire to `/api/v1/learn/sandbox/execute` backend endpoint

### H7. Data engineering page has hardcoded value
- **File**: `apps/web/app/dashboard/data-engineering/page.tsx` line 70
- **Issue**: `const dataLakeSize = "4.2 TB"` hardcoded
- **Fix**: Fetch from data-engineering API

### H8. Pen-testing page has empty checklist
- **File**: `apps/web/app/dashboard/security-testing/pen-testing/page.tsx` line 116
- **Issue**: `const mockOWASPChecklist: ChecklistItem[] = []` — always empty
- **Fix**: Populate from security-service API

### H9. Live traffic simulation in cloud-connect pages
- **Files**: `app/dashboard/cloud-connect/topology/page.tsx` (line 252), `cloud-connect/services/[id]/page.tsx` (line 199)
- **Issue**: Generates synthetic metrics with `Math.random()` on interval
- **Fix**: Use real traffic data from monitoring-service WebSocket

---

## HIGH - Monitoring Simulated Data in Handlers

### H10. WebSocket metrics handler generates fake data
- **File**: `services/monitoring-service/src/handlers/websocket.rs` lines 146-183
- **Issue**: `SimulatedValues` struct generates random metrics instead of reading from CloudWatch/DB
- **Fix**: Read real metrics from provider or SurrealDB

### H11. Log stream handler generates mock log entries
- **File**: `services/monitoring-service/src/handlers/log_stream.rs` lines 157-175
- **Issue**: `generate_mock_entries()` creates fake log entries
- **Fix**: Stream real logs from CloudWatch Logs or SurrealDB

---

## HIGH - Test Files Need Updating

### H12. Cloud-service integration tests use old in-memory store
- **File**: `services/cloud-service/tests/integration.rs`
- **Issue**: Still uses `store::create_seeded_store()` and `use_mock_data: true`
- **Fix**: Update to use SurrealDB test instance

### H13. Cost-service integration tests use in-memory HashMap
- **File**: `services/cost-service/tests/integration.rs`
- **Issue**: Line 31 uses `Mutex::new(HashMap::new())` instead of Database
- **Fix**: Update to use SurrealDB

---

## MEDIUM - Infrastructure Config Issues

### M1. Terraform architecture mismatch
- **File**: `infra/terraform/main.tf`
- **Issue**: Deploys PostgreSQL/Redis/DocumentDB but app uses SurrealDB embedded
- **Fix**: Update Terraform to match actual architecture or add migration path

### M2. K8s manifests missing PersistentVolumeClaims
- **File**: `infra/k8s/`
- **Issue**: No PV/PVC for SurrealDB data directories — pods lose data on restart
- **Fix**: Add PVC manifests for each stateful service

### M3. K8s secrets.yaml has placeholder values
- **File**: `infra/k8s/secrets.yaml`
- **Issue**: Contains "CHANGE_ME" literal values
- **Fix**: Use external secret management (Vault, AWS Secrets Manager)

### M4. Helm values missing production overrides
- **File**: `infra/helm/cloud-manager/values-production.yaml`
- **Issue**: May not exist or is incomplete
- **Fix**: Create production values with real resource limits, replicas, secrets

### M5. Frontend .env.local has wrong service URL
- **File**: `apps/web/.env.local` line 19
- **Issue**: `AI_ML_SERVICE_URL=http://localhost:8082` — should be 8082 (cloud-service) routes AI-ML, but naming is confusing
- **Fix**: Verify URL mapping is correct

### M6. Gateway missing proxy routes for new endpoints
- **File**: `services/gateway/src/config.rs`
- **Issue**: No explicit routing for drift, designs, connections, finops, anomalies, org endpoints
- **Note**: These may be subpaths of existing services and auto-proxied. Verify.

---

## MEDIUM - Security Issues

### M7. CORS too permissive in all services
- **All service main.rs files**: `allow_any_origin().allow_any_method().allow_any_header()`
- **Fix**: Restrict to frontend domain in production

### M8. Hardcoded JWT secret in multiple files
- **Files**: `.env`, `docker-compose.yml`, `apps/web/.env.local`, `infra/k8s/secrets.yaml`
- **Issue**: Same default secret everywhere, committed to repo
- **Fix**: Use environment-specific secrets, never commit defaults

### M9. No API key authentication for programmatic access
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

---

## Completion Checklist

When working through items:
1. Pick an item from the highest uncompleted priority
2. Read the referenced files before making changes
3. Run `cargo check` after backend changes
4. Run `npx tsc --noEmit` after frontend changes
5. Mark item as done by adding `[DONE]` prefix to the heading

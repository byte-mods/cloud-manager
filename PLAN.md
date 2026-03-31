# Cloud Manager — Comprehensive Implementation Plan

## Context

Build a production-grade, multi-cloud management platform (GCP, AWS, Azure) serving Cloud Architects, DevOps Engineers, Data Engineers, System Admins, and Network Admins. The platform provides unified cloud infrastructure management, interactive tutorials, Claude AI-powered automation and cost optimization, and a full security testing/compliance suite.

---

## Technology Stack

| Layer | Choice |
|---|---|
| Monorepo | Turborepo |
| Frontend | Next.js 15 (App Router, TypeScript) |
| UI | shadcn/ui + Radix + Tailwind CSS v4 |
| State | Zustand (client) + TanStack Query v5 (server) |
| Charts | Recharts + Apache ECharts |
| Terminal | xterm.js |
| Code Editor | Monaco Editor |
| Forms | React Hook Form + Zod |
| Backend | Rust (Actix-Web 4) microservices |
| AI Service | Rust with Anthropic API (Claude) |
| Database | PostgreSQL 17 + Redis 8 + MongoDB |
| Search | Meilisearch |
| Time Series | TimescaleDB |
| Auth | NextAuth.js + JWT + TOTP/WebAuthn MFA |
| Secrets | HashiCorp Vault |
| IaC | Terraform + Pulumi |
| Testing | Vitest + React Testing Library + Playwright + Rust tests + k6 |
| Security Tools | OWASP ZAP + Nuclei + Trivy + ScoutSuite |
| Container | Docker + Kubernetes (Helm) |

---

## Project Structure

```
cloud_manager/
├── apps/
│   └── web/                          # Next.js 15 frontend
│       ├── app/
│       │   ├── (auth)/               # Login, Register, Forgot Password
│       │   ├── (dashboard)/          # Main app (sidebar layout)
│       │   │   ├── compute/          # Instances, K8s, Serverless, Batch
│       │   │   ├── storage/          # Object, File, Block, Archive, Backup
│       │   │   ├── networking/       # VPC, LB, DNS, CDN, Firewall, VPN
│       │   │   ├── databases/        # Relational, NoSQL, Cache, Warehouse
│       │   │   ├── ai-ml/            # Models, Inference, MLOps, GenAI
│       │   │   ├── security/          # IAM, Secrets, Certificates, Audit
│       │   │   ├── security-testing/  # VAPT, Vuln, DDoS, Compliance
│       │   │   ├── monitoring/        # Dashboards, Logs, Alerts, Tracing
│       │   │   ├── devops/            # Pipelines, IaC, GitOps, Deployment
│       │   │   ├── data-engineering/   # ETL, Streaming, Data Lake
│       │   │   ├── cost/              # Overview, Explorer, Recommendations
│       │   │   ├── iot/               # Devices, Twins, Rules, Fleet
│       │   │   ├── analytics/         # Query Engines, BI, Search
│       │   │   ├── ai/                 # Claude Terminal, Chat, Suggestions
│       │   │   ├── learn/             # Paths, Tutorials, Sandbox, Progress
│       │   │   └── settings/          # Profile, Org, Cloud Accounts, API Keys
│       │   └── api/                   # Next.js BFF API routes
│       ├── components/
│       │   ├── ui/                    # shadcn/ui primitives
│       │   ├── molecule/             # Composed components
│       │   ├── organism/             # Feature-level components
│       │   └── layout/               # Dashboard, Auth layouts
│       ├── hooks/
│       ├── stores/
│       ├── lib/
│       └── types/
├── services/                          # Rust backend microservices
│   ├── gateway/                       # API Gateway (auth, rate limit, routing)
│   ├── auth-service/                  # Authentication & RBAC
│   ├── cloud-service/                 # Multi-cloud operations (trait-based)
│   ├── security-service/             # VAPT, compliance, scanning
│   ├── claude-ai-service/            # AI chat, suggestions, automation
│   ├── tutorial-service/             # Tutorials, progress, sandboxes
│   └── cost-service/                 # Cost analysis, recommendations
├── packages/
│   ├── shared-types/                  # Shared TypeScript types
│   ├── cloud-sdk-wrapper/            # Unified cloud SDK crate
│   └── ui-kit/                       # Extended component library
├── infra/
│   ├── terraform/                    # IaC for deployment
│   ├── docker/                       # Dockerfiles
│   ├── k8s/                          # Kubernetes manifests
│   └── docker-compose.yml           # Local dev environment
└── docs/
```

---

## Module Breakdown (13 Modules)

### 1. Compute (`/dashboard/compute`)
- Instances: EC2, GCE, Azure VMs — CRUD, start/stop, SSH, metrics
- Containers: ECR/GCR/ACR registries, ECS/Cloud Run/Container Apps
- Kubernetes: EKS/GKE/AKS — clusters, workloads, services, Helm
- Serverless: Lambda/Cloud Functions/Azure Functions — triggers, monitoring
- Batch/HPC: AWS Batch, GCP Batch, Azure Batch

### 2. Storage (`/dashboard/storage`)
- Object: S3/GCS/Azure Blob — buckets, lifecycle, replication
- File: EFS/Filestore/Azure Files
- Block: EBS/Persistent Disk/Managed Disks
- Archive: Glacier/GCS Archive/Azure Archive
- Backup: AWS Backup/GCP Backup/Azure Backup

### 3. Networking (`/dashboard/networking`)
- VPC: VPC/VNet — visual topology (D3.js), subnets, route tables, peering
- Load Balancers: ALB/NLB/Cloud LB/Azure LB
- DNS: Route53/Cloud DNS/Azure DNS
- CDN: CloudFront/Cloud CDN/Azure Front Door
- Firewall/WAF: Security Groups/Firewall Rules/NSGs, WAF rules
- VPN/Connectivity: Site-to-Site, Direct Connect/Interconnect/ExpressRoute

### 4. Databases (`/dashboard/databases`)
- Relational: RDS/Cloud SQL/Azure SQL — managed & serverless
- NoSQL: DynamoDB/Firestore/CosmosDB (document, key-value, graph)
- In-Memory: ElastiCache/Memorystore/Azure Cache
- Warehouse: Redshift/BigQuery/Synapse
- Distributed: Spanner/CockroachDB/CosmosDB distributed

### 5. AI/ML (`/dashboard/ai-ml`)
- Foundation Models: Bedrock/Vertex AI/Azure OpenAI playground
- Training: SageMaker/Vertex Training/Azure ML
- MLOps: Pipelines, experiments, model registry, feature store
- AI Services: Vision, Language, Speech, Translation, Document AI
- GenAI: LLM playground, RAG builder, Agent builder

### 6. Security & IAM (`/dashboard/security`)
- IAM: Users, roles, policies, service accounts, SSO, MFA
- Secrets: Secrets Manager/Secret Manager/Key Vault
- Certificates: ACM/Certificate Manager/App Service Certs
- Threat Detection: GuardDuty/SCC/Microsoft Defender
- Audit: CloudTrail/Audit Logs/Activity Log
- Encryption: KMS management across providers

### 7. Security Testing (`/dashboard/security-testing`)
- VAPT: Configure scans, view findings with CVSS scores, AI remediation
- Vulnerability Scanner: Cloud-native (Inspector/SCC/Defender) + Trivy
- DDoS Testing: Controlled tests with authorization, kill switch, audit trail
- Penetration Testing: OWASP ZAP + Nuclei automated, guided manual checklists
- Compliance: SOC2, ISO 27001, HIPAA, PCI-DSS 4.0, GDPR, NIST CSF, CIS
- Security Posture: Score (0-100), CIS benchmarks, drift detection

### 8. Monitoring & Logging (`/dashboard/monitoring`)
- Dashboards: Unified custom dashboards
- Metrics: CloudWatch/Cloud Monitoring/Azure Monitor
- Logs: Explorer with query builder, live streaming (WebSocket)
- Alerts: Unified rules, multi-channel (SNS/Slack/PagerDuty)
- Tracing: X-Ray/Cloud Trace/App Insights
- Uptime: Health checks, synthetic monitoring

### 9. CI/CD & DevOps (`/dashboard/devops`)
- Pipelines: CodePipeline/Cloud Build/Azure Pipelines
- IaC: Terraform/CloudFormation/Bicep/Pulumi workspace management
- GitOps: ArgoCD/Flux integration
- Deployment: Blue/green, canary, rolling strategies
- Config Management: Systems Manager/OS Config/Azure Automation

### 10. Data Engineering (`/dashboard/data-engineering`)
- ETL Pipelines: Glue/Dataflow/Data Factory
- Streaming: Kinesis/Pub/Sub/Event Hubs, Kafka (MSK/Confluent)
- Data Lake: Lake Formation/BigLake/ADLS Gen2, catalogs, governance
- Integration: API Gateway/Apigee/Azure APIM, messaging, events

### 11. Cost Management (`/dashboard/cost`)
- Overview: Unified multi-cloud cost dashboard
- Explorer: Breakdown by service/region/tag/team
- Budgets: Creation and alerting
- Recommendations: AI-powered optimization (Claude)
- Reservations: RI/CUD management, savings plans
- Forecasting: ML-based cost prediction
- Waste Detection: Unused resources, oversized instances

### 12. IoT (`/dashboard/iot`)
- Devices: IoT Core (AWS/GCP), Azure IoT Hub
- Digital Twins: Device shadows, Azure Digital Twins
- Rules & Routing: Event rules, message routing
- Edge: Greengrass/Edge TPU/Azure IoT Edge

### 13. Analytics & BI (`/dashboard/analytics`)
- Query Engines: Athena/BigQuery/Synapse with Monaco editor
- Visualization: QuickSight/Looker/Power BI embedding
- Search: OpenSearch/Elasticsearch integration
- Reports: Scheduled report generation

---

## Claude AI Integration (`/dashboard/ai`)

| Feature | Location | Function |
|---|---|---|
| CLI Terminal | /ai/terminal | xterm.js terminal with Claude CLI, WebSocket PTY |
| Chat Assistant | /ai/chat | Streaming chat with context-aware suggestions |
| Cost Optimizer | Cost module sidebar | Rightsizing, RI recommendations, waste detection |
| Architecture Reviewer | Resource creation flows | Best practice validation |
| Security Advisor | Security scan results | Vulnerability explanation + remediation code |
| IaC Generator | DevOps module | Natural language to Terraform/CloudFormation/Bicep |
| Policy Generator | IAM module | Least-privilege policy generation |
| Query Assistant | Database/Analytics | Natural language to SQL/KQL |
| Tutorial Tutor | Learn module | Adaptive Q&A during tutorials |

**Backend Architecture:**
- Streaming SSE endpoint for chat (`POST /api/v1/ai/chat`)
- WebSocket for terminal PTY (`WS /ws/ai/terminal`)
- Context builders: resource, cost, security contexts injected per request
- Tool definitions for Claude function calling (cloud APIs, IaC tools, queries)

---

## Tutorial & Learning System (`/dashboard/learn`)

### Learning Paths (by role)
- **Cloud Architect:** Multi-cloud fundamentals → Network architecture → HA/DR → Cost optimization → Security architecture → Well-Architected
- **DevOps Engineer:** CI/CD → IaC (Terraform) → Containers/K8s → GitOps → Monitoring → Incident management
- **Data Engineer:** Cloud storage → Warehouses → ETL pipelines → Streaming → Data lakes → Governance
- **System Admin:** Account setup → IAM → Compute management → Backup/Recovery → Patch management → Automation
- **Network Admin:** Cloud networking → VPC design → Load balancing → DNS → VPN/Connectivity → Zero-trust

### Tutorial Player
- Step-by-step interactive cards (Markdown + code blocks + diagrams)
- "Try it now" sandbox integration (LocalStack/GCP emulators/Azurite)
- Claude AI tutor floating widget
- Progress checkpoints with verification
- Knowledge quizzes between sections
- Certification prep modules

---

## Authentication & RBAC

### Auth Flow
1. Login (credentials or OAuth: Google/GitHub/Microsoft)
2. MFA verification (TOTP/WebAuthn)
3. JWT access token (15min) + HTTP-only refresh cookie (7d)
4. Gateway validates JWT on every request
5. Cloud credentials stored in Vault (AWS STS AssumeRole, GCP Workload Identity, Azure SP)

### Role Permissions Matrix

| Module | Cloud Architect | DevOps | Data Engineer | System Admin | Network Admin |
|---|---|---|---|---|---|
| Compute | Full | Full | Read | Full | Read |
| Storage | Full | R/W | Full | Full | Read |
| Networking | Full | Read | Read | R/W | Full |
| Database | Full | Read | Full | Full | Read |
| AI/ML | Full | Read | Full | Read | - |
| Security | Full | R/W | Read | Full | R/W |
| Sec Testing | Full | Read | Read | Full | R/W |
| Cost | Full | Read | Read | Full | Read |
| CI/CD | R/W | Full | R/W | R/W | Read |
| Data Eng | Read | R/W | Full | Read | Read |
| IAM | Full | Read | Read | Full | R/W |
| Tutorials | Full | Full | Full | Full | Full |
| AI Assistant | Full | Full | Full | Full | Full |

---

## API Design

### REST Pattern
```
/api/v1/auth/{action}
/api/v1/cloud/{provider}/{service}/{resource}
/api/v1/cloud/{provider}/{service}/{resource}/{id}
/api/v1/cloud/{provider}/{service}/{resource}/{id}/actions/{action}
/api/v1/resources?type={type}&providers={csv}
/api/v1/security/scans
/api/v1/security/compliance/{framework}
/api/v1/security/posture/score
/api/v1/ai/chat (SSE streaming)
/api/v1/learn/paths, /tutorials, /progress
/api/v1/cost/overview, /explorer, /recommendations
```

### WebSocket Endpoints
```
/ws/logs/{resource-id}
/ws/deployments/{id}
/ws/scans/{id}
/ws/ai/terminal
/ws/notifications
```

---

## Implementation Phases

### Phase 1: Foundation (~80 files)
1. Monorepo setup (Turborepo, package.json, turbo.json)
2. Next.js app with App Router, Tailwind, shadcn/ui
3. Dashboard layout (sidebar, topbar, cloud context switcher)
4. Auth pages (login, register, forgot password)
5. Auth service (JWT, RBAC)
6. API gateway skeleton
7. Cloud context Zustand store
8. Role-based navigation

### Phase 2: Core Cloud Modules (~120 files)
9. Compute module (instances CRUD for AWS/GCP/Azure)
10. Storage module (object storage CRUD)
11. Networking module (VPC management + visual topology)
12. Database module (managed databases CRUD)
13. Cloud service backend with provider trait pattern

### Phase 3: Operations Modules (~80 files)
14. Monitoring & Logging module
15. CI/CD & DevOps module (pipelines + IaC)
16. Cost Management module (overview + explorer + budgets)
17. Cost service backend

### Phase 4: AI Integration (~40 files)
18. Claude AI chat interface (streaming)
19. Claude CLI terminal (xterm.js + WebSocket)
20. Cost optimization AI suggestions
21. IaC generation from natural language
22. Claude AI service backend

### Phase 5: Security & Compliance (~60 files)
23. Security & IAM module
24. VAPT scanning interface
25. Vulnerability scanner integration
26. Compliance framework dashboards (SOC2, ISO27001, HIPAA, PCI-DSS, GDPR)
27. Security posture scoring
28. DDoS testing (with safeguards)
29. Security service backend

### Phase 6: Learning & Advanced (~60 files)
30. Tutorial system (paths, player, progress)
31. Sandbox environment integration
32. AI/ML module
33. Data Engineering module
34. IoT module
35. Analytics & BI module
36. Tutorial service backend

### Phase 7: Polish (~30 files)
37. Settings pages (profile, org, cloud accounts)
38. Notification system
39. Command palette (Cmd+K)
40. Responsive design polish
41. Dark/light theme
42. Docker & K8s deployment configs

---

## Key Design Decisions

1. **Trait-based cloud abstraction (Rust):** Each cloud service category (compute, storage, etc.) has a trait. AWS/GCP/Azure adapters implement it. Adding providers is mechanical.

2. **Next.js App Router with route groups:** `(auth)` and `(dashboard)` groups share different layouts. Each module is a folder under `(dashboard)`.

3. **Zustand for cloud context:** The active provider/region/account is global state that drives every API call and UI element.

4. **Monaco Editor for code:** Used in IaC editing, query writing, and policy editing — consistent code editing experience.

5. **xterm.js for Claude CLI:** Full terminal emulator connected to server-side PTY for real Claude CLI experience.

6. **DDoS testing safeguards:** Authorization required, kill switch, duration limits, audit trail — designed for compliance testing, not attack simulation.

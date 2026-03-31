# Development Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 20.0.0 | Frontend runtime |
| pnpm | 9.15.4 | Package manager |
| Rust | >= 1.82 | Backend services |
| Docker | >= 24.0 | Database services |
| Docker Compose | >= 2.20 | Local orchestration |

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> cloud_manager
cd cloud_manager
pnpm install

# 2. Start databases
docker compose up -d

# 3. Run migrations
cd services && cargo run --bin migrate

# 4. Start backend services (in separate terminals or use start.sh)
./start.sh

# 5. Start frontend
cd apps/web && pnpm dev
```

The app will be available at `http://localhost:3000`.

### Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@cloudmanager.dev | admin123 | Cloud Architect |
| devops@cloudmanager.dev | devops123 | DevOps Engineer |
| data@cloudmanager.dev | data123 | Data Engineer |
| sysadmin@cloudmanager.dev | sysadmin123 | System Admin |
| network@cloudmanager.dev | network123 | Network Admin |

## Project Structure

```
cloud_manager/
├── apps/web/              # Next.js 15 frontend
│   ├── app/               # App Router pages
│   │   ├── (auth)/        # Login, register, forgot password
│   │   ├── api/           # BFF API routes
│   │   └── dashboard/     # All dashboard pages (13 modules)
│   ├── components/        # React components
│   ├── hooks/             # Custom React hooks (15)
│   ├── stores/            # Zustand stores (18)
│   ├── lib/               # Utilities, API client, generators
│   ├── tests/             # Vitest unit tests
│   └── e2e/               # Playwright E2E tests
├── services/              # Rust microservices
│   ├── gateway/           # API gateway
│   ├── auth-service/      # Authentication & RBAC
│   ├── cloud-service/     # Multi-cloud operations
│   ├── security-service/  # Security scanning & compliance
│   ├── monitoring-service/# Metrics, logs, alerts
│   ├── cost-service/      # Cost analysis
│   ├── claude-ai-service/ # AI integration
│   ├── data-engineering-service/
│   ├── analytics-service/
│   ├── tutorial-service/
│   ├── cloud-common/      # Shared Rust utilities
│   └── migrations/        # SQL migrations
├── packages/              # Shared packages
│   ├── shared-types/      # TypeScript type definitions
│   ├── cloud-sdk-wrapper/ # Unified Rust cloud SDK
│   └── ui-kit/            # Extended component library
├── infra/                 # Infrastructure configs
│   ├── docker/            # Dockerfiles
│   ├── terraform/         # AWS deployment IaC
│   ├── k8s/               # Kubernetes manifests
│   └── helm/              # Helm chart
└── docs/                  # Documentation
```

## Environment Variables

Create `.env.local` in `apps/web/`:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# Backend services
NEXT_PUBLIC_GATEWAY_URL=http://localhost:8080
NEXT_PUBLIC_CLOUD_SERVICE_URL=http://localhost:8082
NEXT_PUBLIC_OAUTH_ENABLED=true

# OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_ID=
GITHUB_SECRET=
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_TENANT_ID=
```

Backend services use these (set in shell or `.env`):

```env
DATABASE_URL=postgresql://cloud_manager:cloud_manager@localhost:5432/cloud_manager
REDIS_URL=redis://localhost:6379
MONGODB_URL=mongodb://cloud_manager:cloud_manager@localhost:27017
MEILISEARCH_URL=http://localhost:7700
ANTHROPIC_API_KEY=sk-ant-...
CLOUD_USE_MOCK_DATA=true
JWT_SECRET=your-jwt-secret
RUST_LOG=info
```

## Adding a New Cloud Module

1. **Define the trait** in `services/cloud-service/src/traits/`:
   ```rust
   #[async_trait]
   pub trait MyServiceProvider: Send + Sync {
       async fn list_items(&self, region: &str) -> Result<Vec<Item>>;
       async fn create_item(&self, req: CreateRequest) -> Result<Item>;
   }
   ```

2. **Implement per provider** in `src/providers/{aws,gcp,azure}/`:
   ```rust
   impl MyServiceProvider for AwsMyServiceProvider { ... }
   ```

3. **Add handlers** in `src/handlers/my_service_handlers.rs`

4. **Register routes** in `src/main.rs`

5. **Create frontend pages** in `apps/web/app/dashboard/my-module/`

6. **Add hook** in `apps/web/hooks/use-my-module.ts`

7. **Update sidebar** in `apps/web/components/layout/app-sidebar.tsx`

## Testing

### Frontend Tests (Vitest)
```bash
cd apps/web
pnpm test              # Run all tests
pnpm test --watch      # Watch mode
pnpm test --coverage   # With coverage
```

### E2E Tests (Playwright)
```bash
cd apps/web
pnpm test:e2e          # Run E2E tests
pnpm test:e2e:ui       # Interactive UI mode
```

### Backend Tests (Rust)
```bash
cd services
cargo test             # All service tests
cargo test -p cloud-service  # Specific service
```

## Code Conventions

- **Frontend**: TypeScript strict mode, functional components, hooks for logic
- **Backend**: Rust 2021 edition, async/await with tokio, trait-based abstractions
- **Naming**: kebab-case for files/routes, camelCase for TS, snake_case for Rust
- **Components**: shadcn/ui primitives, lucide-react icons, Tailwind utilities
- **State**: Zustand for client state, TanStack Query for server state
- **Forms**: React Hook Form + Zod schemas

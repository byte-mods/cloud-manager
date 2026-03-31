# API Reference

Base URL: `http://localhost:8080` (gateway)

All endpoints require `Authorization: Bearer <jwt>` unless noted.

## Authentication API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Login with email/password |
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Invalidate session |
| POST | `/api/v1/auth/mfa/setup` | Initialize TOTP MFA setup |
| POST | `/api/v1/auth/mfa/verify` | Verify TOTP code |
| POST | `/api/v1/auth/mfa/disable` | Disable MFA |
| GET | `/api/v1/auth/me` | Get current user profile |
| PUT | `/api/v1/auth/me` | Update profile |
| POST | `/api/v1/auth/forgot-password` | Request password reset |
| POST | `/api/v1/auth/reset-password` | Reset password with token |

### Login Request
```json
POST /api/v1/auth/login
{
  "email": "admin@cloudmanager.dev",
  "password": "admin123",
  "mfa_code": "123456"  // optional
}
```

### Login Response
```json
{
  "user": {
    "id": "usr_abc123",
    "email": "admin@cloudmanager.dev",
    "name": "Admin User",
    "role": "cloud_architect",
    "mfaEnabled": true
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

## Cloud API

### Generic Pattern
```
GET    /api/v1/cloud/{provider}/{service}/{resource}          # List
POST   /api/v1/cloud/{provider}/{service}/{resource}          # Create
GET    /api/v1/cloud/{provider}/{service}/{resource}/{id}     # Get
PUT    /api/v1/cloud/{provider}/{service}/{resource}/{id}     # Update
DELETE /api/v1/cloud/{provider}/{service}/{resource}/{id}     # Delete
POST   /api/v1/cloud/{provider}/{service}/{resource}/{id}/actions/{action}  # Action
```

Providers: `aws`, `gcp`, `azure`

### Compute
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/cloud/{provider}/compute/instances` | List instances |
| POST | `/api/v1/cloud/{provider}/compute/instances` | Create instance |
| GET | `/api/v1/cloud/{provider}/compute/instances/{id}` | Get instance |
| DELETE | `/api/v1/cloud/{provider}/compute/instances/{id}` | Terminate instance |
| POST | `/api/v1/cloud/{provider}/compute/instances/{id}/actions/start` | Start |
| POST | `/api/v1/cloud/{provider}/compute/instances/{id}/actions/stop` | Stop |
| POST | `/api/v1/cloud/{provider}/compute/instances/{id}/actions/reboot` | Reboot |
| GET | `/api/v1/cloud/{provider}/kubernetes/clusters` | List K8s clusters |
| GET | `/api/v1/cloud/{provider}/kubernetes/clusters/{id}` | Get cluster |
| GET | `/api/v1/cloud/{provider}/serverless/functions` | List functions |
| POST | `/api/v1/cloud/{provider}/serverless/functions` | Create function |

### Storage
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/cloud/{provider}/storage/buckets` | List buckets |
| POST | `/api/v1/cloud/{provider}/storage/buckets` | Create bucket |
| DELETE | `/api/v1/cloud/{provider}/storage/buckets/{id}` | Delete bucket |
| GET | `/api/v1/cloud/{provider}/storage/buckets/{id}/objects` | List objects |
| GET | `/api/v1/cloud/{provider}/storage/volumes` | List volumes |
| POST | `/api/v1/cloud/{provider}/storage/volumes` | Create volume |

### Networking
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/cloud/{provider}/networking/vpcs` | List VPCs |
| POST | `/api/v1/cloud/{provider}/networking/vpcs` | Create VPC |
| GET | `/api/v1/cloud/{provider}/networking/subnets` | List subnets |
| GET | `/api/v1/cloud/{provider}/networking/security-groups` | List security groups |
| GET | `/api/v1/cloud/{provider}/networking/load-balancers` | List load balancers |
| GET | `/api/v1/cloud/{provider}/dns/zones` | List DNS zones |
| GET | `/api/v1/cloud/{provider}/cdn/distributions` | List CDN distributions |

### Databases
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/cloud/{provider}/database/instances` | List DB instances |
| POST | `/api/v1/cloud/{provider}/database/instances` | Create DB instance |
| GET | `/api/v1/cloud/{provider}/database/instances/{id}` | Get DB instance |
| DELETE | `/api/v1/cloud/{provider}/database/instances/{id}` | Delete DB instance |

## Security API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/security/findings` | List security findings |
| GET | `/api/v1/security/findings/{id}` | Get finding details |
| POST | `/api/v1/security/scans` | Start security scan |
| GET | `/api/v1/security/scans/{id}` | Get scan status |
| GET | `/api/v1/security/compliance/{framework}` | Get compliance status |
| GET | `/api/v1/security/posture/score` | Get security posture score |
| GET | `/api/v1/security/iam/users` | List IAM users |
| GET | `/api/v1/security/iam/roles` | List IAM roles |
| GET | `/api/v1/security/iam/policies` | List IAM policies |
| GET | `/api/v1/security/kms/keys` | List KMS keys |
| GET | `/api/v1/security/waf/rules` | List WAF rules |
| POST | `/api/v1/security/vault/secrets/{path}` | Write Vault secret |
| GET | `/api/v1/security/vault/secrets/{path}` | Read Vault secret |
| POST | `/api/v1/security/remediate` | Generate remediation code |
| POST | `/api/v1/security/compliance/generate` | Generate compliance policies |

## Cost API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/cost/overview` | Cost overview dashboard data |
| GET | `/api/v1/cost/explorer` | Detailed cost breakdown |
| GET | `/api/v1/cost/budgets` | List budgets |
| POST | `/api/v1/cost/budgets` | Create budget |
| GET | `/api/v1/cost/recommendations` | AI-powered recommendations |
| GET | `/api/v1/cost/anomalies` | Cost anomalies |
| GET | `/api/v1/cost/forecast` | Cost forecast |
| GET | `/api/v1/cost/reservations` | Reserved instances |

### Cost Explorer Request
```
GET /api/v1/cost/explorer?start_date=2026-01-01&end_date=2026-03-31&group_by=service&providers=aws,gcp
```

## Monitoring API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/monitoring/dashboards` | List dashboards |
| GET | `/api/v1/monitoring/metrics` | Query metrics |
| GET | `/api/v1/monitoring/logs` | Query logs |
| GET | `/api/v1/monitoring/alerts` | List alert rules |
| POST | `/api/v1/monitoring/alerts` | Create alert rule |
| GET | `/api/v1/monitoring/traces` | List traces |
| GET | `/api/v1/monitoring/uptime` | Uptime checks |

## AI API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ai/chat` | Chat with Claude (SSE streaming) |
| POST | `/api/v1/ai/review` | Architecture review |
| POST | `/api/v1/ai/cost/optimize` | Cost optimization suggestions |
| POST | `/api/v1/ai/iac/generate` | Generate IaC from description |
| POST | `/api/v1/ai/policy/generate` | Generate IAM policies |
| POST | `/api/v1/ai/query/assist` | Natural language to SQL |

### Chat Request (SSE)
```json
POST /api/v1/ai/chat
Content-Type: application/json
Accept: text/event-stream

{
  "message": "How can I reduce my AWS costs?",
  "context": {
    "provider": "aws",
    "module": "cost",
    "resources": ["ec2", "rds", "s3"]
  }
}
```

## Learning API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/learn/paths` | List learning paths |
| GET | `/api/v1/learn/paths/{role}` | Get role-specific path |
| GET | `/api/v1/learn/tutorials` | List tutorials |
| GET | `/api/v1/learn/tutorials/{id}` | Get tutorial content |
| GET | `/api/v1/learn/progress` | Get user progress |
| POST | `/api/v1/learn/progress/{tutorialId}` | Update progress |

## WebSocket Endpoints

| Endpoint | Description |
|----------|-------------|
| `WS /ws/logs/{resource-id}` | Real-time log streaming |
| `WS /ws/deployments/{id}` | Deployment progress |
| `WS /ws/scans/{id}` | Scan progress |
| `WS /ws/ai/terminal` | Claude CLI terminal PTY |
| `WS /ws/notifications` | Real-time notifications |
| `WS /ws/metrics/{resource-id}` | Live metrics streaming |

## Common Response Formats

### Success
```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 150
  }
}
```

### Error
```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Instance i-1234567890 not found",
    "status": 404
  }
}
```

## Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | int | Page number (default: 1) |
| `per_page` | int | Items per page (default: 20, max: 100) |
| `sort` | string | Sort field (e.g., `name`, `-created_at`) |
| `search` | string | Full-text search query |
| `provider` | string | Filter by cloud provider |
| `region` | string | Filter by region |
| `status` | string | Filter by status |
| `tags` | string | Filter by tags (comma-separated) |

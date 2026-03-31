# Deployment Guide

## Deployment Options

| Method | Best For |
|--------|----------|
| Docker Compose | Local development, single-server staging |
| Kubernetes (kubectl) | Direct K8s cluster deployment |
| Helm | Production K8s with environment configs |
| Terraform + Helm | Full infrastructure provisioning on AWS |

## Docker Compose

### Development
```bash
# Start all services (databases + application)
docker compose up -d

# Start only databases
docker compose up -d postgres redis mongodb meilisearch timescaledb

# View logs
docker compose logs -f gateway

# Rebuild a service
docker compose up -d --build cloud-service
```

### Building Images
```bash
# Frontend
docker build -f infra/docker/Dockerfile.web -t cloud-manager/web .

# Gateway
docker build -f infra/docker/Dockerfile.gateway -t cloud-manager/gateway ./services/

# Any backend service
docker build -f infra/docker/Dockerfile.rust-service \
  --build-arg SERVICE_NAME=auth-service \
  -t cloud-manager/auth-service ./services/
```

## Kubernetes Deployment

### Prerequisites
- kubectl configured with cluster access
- Container images pushed to registry

### Deploy
```bash
# Create namespace
kubectl apply -f infra/k8s/namespace.yaml

# Configure secrets (edit values first!)
kubectl apply -f infra/k8s/secrets.yaml

# Deploy config
kubectl apply -f infra/k8s/configmap.yaml

# Deploy all services
kubectl apply -f infra/k8s/

# Verify
kubectl get pods -n cloud-manager
kubectl get svc -n cloud-manager
```

## Helm Deployment

### Install
```bash
# Development
helm install cloud-manager infra/helm/cloud-manager/ \
  --namespace cloud-manager \
  --create-namespace

# Production
helm install cloud-manager infra/helm/cloud-manager/ \
  --namespace cloud-manager \
  --create-namespace \
  -f infra/helm/cloud-manager/values-production.yaml \
  --set secrets.DB_PASSWORD=<password> \
  --set secrets.JWT_SECRET=<secret> \
  --set secrets.ANTHROPIC_API_KEY=<key>

# Upgrade
helm upgrade cloud-manager infra/helm/cloud-manager/ \
  -f infra/helm/cloud-manager/values-production.yaml
```

## Terraform (AWS Infrastructure)

### Provision Infrastructure
```bash
cd infra/terraform

# Initialize
terraform init

# Plan
terraform plan -var="db_password=<password>" -out=tfplan

# Apply
terraform apply tfplan

# Get outputs
terraform output eks_cluster_endpoint
terraform output rds_cluster_endpoint
```

### Connect to EKS
```bash
aws eks update-kubeconfig \
  --region us-east-1 \
  --name cloud-manager-production-cluster
```

Then deploy with Helm using the Terraform outputs for database endpoints.

## Environment Configuration

### Required Secrets
| Secret | Description |
|--------|-------------|
| `DB_PASSWORD` | PostgreSQL password |
| `MONGO_PASSWORD` | MongoDB password |
| `JWT_SECRET` | JWT signing secret (min 256-bit) |
| `NEXTAUTH_SECRET` | NextAuth encryption secret |
| `ANTHROPIC_API_KEY` | Claude API key |

### Optional Secrets
| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `GCP_SERVICE_ACCOUNT_JSON` | GCP service account |
| `AZURE_CLIENT_ID/SECRET/TENANT` | Azure SP credentials |
| `GOOGLE_CLIENT_ID/SECRET` | OAuth - Google |
| `GITHUB_ID/SECRET` | OAuth - GitHub |
| `VAULT_TOKEN` | HashiCorp Vault token |

## Health Checks

All services expose `/health` endpoints:
```bash
curl http://localhost:8080/health  # Gateway
curl http://localhost:3000/api/health  # Frontend
```

## Scaling

### Horizontal Pod Autoscaling
HPAs are configured in `infra/k8s/hpa.yaml` and Helm values. Key services:
- **Gateway**: 3-10 replicas, 70% CPU target
- **Cloud Service**: 3-12 replicas, 70% CPU target
- **Claude AI Service**: 2-6 replicas, 65% CPU target

### Database Scaling
- PostgreSQL: Aurora read replicas (managed by Terraform)
- Redis: ElastiCache replication group
- MongoDB: DocumentDB multi-AZ

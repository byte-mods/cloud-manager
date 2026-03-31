import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CloudProvider = 'aws' | 'gcp' | 'azure'

export type CloudAccount = {
  id: string
  provider: CloudProvider
  name: string
  accountId: string
  status: 'connected' | 'disconnected' | 'error' | 'syncing'
  lastSynced: string | null
  resourceCount: number
  monthlyCost: number
  securityScore: number
  regions: string[]
}

export type ServiceType =
  | 'compute'
  | 'storage'
  | 'database'
  | 'networking'
  | 'serverless'
  | 'container'
  | 'cache'
  | 'queue'
  | 'cdn'
  | 'dns'
  | 'loadbalancer'
  | 'monitoring'
  | 'security'
  | 'ml'

export type ServiceStatus = 'running' | 'stopped' | 'warning' | 'error' | 'creating' | 'deleting'

export type SecurityIssue = {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  title: string
  description: string
  remediation: string
}

export type DiscoveredService = {
  id: string
  accountId: string
  provider: CloudProvider
  type: ServiceType
  serviceName: string
  resourceName: string
  region: string
  status: ServiceStatus
  config: Record<string, any>
  monthlyCost: number
  trafficIn: number
  trafficOut: number
  securityIssues: SecurityIssue[]
  connections: string[]
  createdAt: string
  tags: Record<string, string>
}

export type TrafficMetric = {
  timestamp: string
  inbound: number
  outbound: number
  requests: number
  errors: number
  latency: number
}

export type ActivityEvent = {
  id: string
  serviceId: string
  message: string
  timestamp: string
  type: 'info' | 'warning' | 'error' | 'success'
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

type CloudConnectState = {
  accounts: CloudAccount[]
  services: DiscoveredService[]
  selectedServiceId: string | null
  activities: ActivityEvent[]
  loading: boolean
  error: string | null
  initialized: boolean

  // Fetch
  fetchConnections: () => Promise<void>
  fetchServices: (provider: string) => Promise<void>

  // Account actions
  addAccount: (account: CloudAccount) => void
  removeAccount: (id: string) => void
  syncAccount: (id: string) => void

  // Service queries
  getServicesByAccount: (accountId: string) => DiscoveredService[]
  getServicesByType: (type: ServiceType) => DiscoveredService[]
  getServiceById: (id: string) => DiscoveredService | undefined
  setSelectedService: (id: string | null) => void

  // Traffic
  updateServiceTraffic: () => void

  // Cross-cloud
  getCrossCloudConnections: () => { from: DiscoveredService; to: DiscoveredService }[]

  // Aggregations
  getTotalCost: () => number
  getSecuritySummary: () => { critical: number; high: number; medium: number; low: number; info: number }
}

// ---------------------------------------------------------------------------
// Seed data helpers
// ---------------------------------------------------------------------------

let issueCounter = 0
function makeIssue(
  severity: SecurityIssue['severity'],
  title: string,
  description: string,
  remediation: string,
): SecurityIssue {
  issueCounter++
  return { id: `issue-${issueCounter}`, severity, title, description, remediation }
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

const seedAccounts: CloudAccount[] = [
  {
    id: 'acc-aws-prod',
    provider: 'aws',
    name: 'Production AWS',
    accountId: '123456789012',
    status: 'connected',
    lastSynced: '2026-03-30T08:15:00Z',
    resourceCount: 28,
    monthlyCost: 12450,
    securityScore: 87,
    regions: ['us-east-1', 'us-west-2', 'eu-west-1'],
  },
  {
    id: 'acc-gcp-prod',
    provider: 'gcp',
    name: 'Production GCP',
    accountId: 'prod-gcp-382910',
    status: 'connected',
    lastSynced: '2026-03-30T07:45:00Z',
    resourceCount: 18,
    monthlyCost: 8320,
    securityScore: 82,
    regions: ['us-central1', 'europe-west1'],
  },
  {
    id: 'acc-azure-dev',
    provider: 'azure',
    name: 'Dev Azure',
    accountId: 'sub-a1b2c3d4-e5f6',
    status: 'connected',
    lastSynced: '2026-03-30T06:30:00Z',
    resourceCount: 12,
    monthlyCost: 3200,
    securityScore: 91,
    regions: ['eastus', 'westeurope'],
  },
]

// ---------------------------------------------------------------------------
// AWS services (28)
// ---------------------------------------------------------------------------

const awsServices: DiscoveredService[] = [
  // EC2 instances (4)
  {
    id: 'aws-ec2-web1',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'compute',
    serviceName: 'EC2',
    resourceName: 'web-server-1',
    region: 'us-east-1',
    status: 'running',
    config: { instanceType: 't3.xlarge', ami: 'ami-0abcdef1234567890', vCPUs: 4, memoryGb: 16, ebsSize: 100 },
    monthlyCost: 420,
    trafficIn: 85000,
    trafficOut: 245000,
    securityIssues: [
      makeIssue('medium', 'Outdated TLS version', 'Instance is using TLS 1.1 for some endpoints.', 'Update to TLS 1.2 or 1.3 in the web server config.'),
    ],
    connections: ['aws-alb-prod', 'aws-rds-postgres', 'aws-elasticache-redis'],
    createdAt: '2025-06-15T10:00:00Z',
    tags: { env: 'production', team: 'platform', service: 'web' },
  },
  {
    id: 'aws-ec2-api1',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'compute',
    serviceName: 'EC2',
    resourceName: 'api-server-1',
    region: 'us-east-1',
    status: 'running',
    config: { instanceType: 't3.large', ami: 'ami-0abcdef1234567890', vCPUs: 2, memoryGb: 8, ebsSize: 50 },
    monthlyCost: 210,
    trafficIn: 120000,
    trafficOut: 180000,
    securityIssues: [],
    connections: ['aws-alb-prod', 'aws-rds-postgres', 'aws-sqs-orders', 'aws-elasticache-redis'],
    createdAt: '2025-06-15T10:30:00Z',
    tags: { env: 'production', team: 'backend', service: 'api' },
  },
  {
    id: 'aws-ec2-batch1',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'compute',
    serviceName: 'EC2',
    resourceName: 'batch-worker-1',
    region: 'us-west-2',
    status: 'stopped',
    config: { instanceType: 'c5.2xlarge', ami: 'ami-0abcdef9876543210', vCPUs: 8, memoryGb: 16, ebsSize: 200 },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [
      makeIssue('low', 'Unused IAM role attached', 'The instance profile has an IAM role with permissions not used in 90 days.', 'Remove or reduce IAM role permissions.'),
    ],
    connections: ['aws-s3-datalake'],
    createdAt: '2025-09-01T08:00:00Z',
    tags: { env: 'production', team: 'data', service: 'batch' },
  },
  {
    id: 'aws-ec2-dev1',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'compute',
    serviceName: 'EC2',
    resourceName: 'dev-instance-1',
    region: 'us-east-1',
    status: 'running',
    config: { instanceType: 't3.medium', ami: 'ami-0abcdef1234567890', vCPUs: 2, memoryGb: 4, ebsSize: 30 },
    monthlyCost: 95,
    trafficIn: 5000,
    trafficOut: 8000,
    securityIssues: [
      makeIssue('high', 'Default security group in use', 'Instance is using the default VPC security group.', 'Create a dedicated security group with least-privilege rules.'),
    ],
    connections: ['aws-vpc-dev'],
    createdAt: '2026-01-10T14:00:00Z',
    tags: { env: 'development', team: 'backend', service: 'dev' },
  },

  // S3 buckets (3)
  {
    id: 'aws-s3-assets',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'storage',
    serviceName: 'S3',
    resourceName: 'app-assets-prod',
    region: 'us-east-1',
    status: 'running',
    config: { storageClass: 'STANDARD', versioning: true, encryption: 'AES-256', sizeGb: 450, objectCount: 1250000 },
    monthlyCost: 12,
    trafficIn: 2000,
    trafficOut: 95000,
    securityIssues: [],
    connections: ['aws-cloudfront-main', 'aws-ec2-web1'],
    createdAt: '2025-03-01T09:00:00Z',
    tags: { env: 'production', team: 'frontend', purpose: 'assets' },
  },
  {
    id: 'aws-s3-datalake',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'storage',
    serviceName: 'S3',
    resourceName: 'data-lake-raw',
    region: 'us-east-1',
    status: 'running',
    config: { storageClass: 'INTELLIGENT_TIERING', versioning: false, encryption: 'AES-256', sizeGb: 8500, objectCount: 45000000 },
    monthlyCost: 195,
    trafficIn: 45000,
    trafficOut: 12000,
    securityIssues: [
      makeIssue('medium', 'Versioning not enabled', 'Bucket versioning is disabled, risking accidental data loss.', 'Enable versioning on this bucket.'),
    ],
    connections: ['aws-lambda-data', 'aws-ec2-batch1', 'gcp-bigquery-analytics'],
    createdAt: '2025-04-10T12:00:00Z',
    tags: { env: 'production', team: 'data', purpose: 'data-lake' },
  },
  {
    id: 'aws-s3-backup',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'storage',
    serviceName: 'S3',
    resourceName: 'backup-vault-2024',
    region: 'us-west-2',
    status: 'running',
    config: { storageClass: 'GLACIER', versioning: true, encryption: 'aws:kms', sizeGb: 12000, objectCount: 5000 },
    monthlyCost: 48,
    trafficIn: 500,
    trafficOut: 0,
    securityIssues: [],
    connections: [],
    createdAt: '2024-01-15T06:00:00Z',
    tags: { env: 'production', team: 'ops', purpose: 'backup' },
  },

  // RDS (2)
  {
    id: 'aws-rds-postgres',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'database',
    serviceName: 'RDS',
    resourceName: 'prod-postgres',
    region: 'us-east-1',
    status: 'running',
    config: { engine: 'PostgreSQL 15.4', instanceClass: 'db.r6g.xlarge', multiAZ: true, storageGb: 500, iops: 3000, encrypted: true },
    monthlyCost: 1850,
    trafficIn: 65000,
    trafficOut: 48000,
    securityIssues: [],
    connections: ['aws-ec2-web1', 'aws-ec2-api1', 'aws-lambda-api'],
    createdAt: '2025-05-20T08:00:00Z',
    tags: { env: 'production', team: 'backend', service: 'database' },
  },
  {
    id: 'aws-rds-mysql',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'database',
    serviceName: 'RDS',
    resourceName: 'analytics-mysql',
    region: 'us-east-1',
    status: 'running',
    config: { engine: 'MySQL 8.0', instanceClass: 'db.r6g.large', multiAZ: false, storageGb: 200, iops: 1000, encrypted: true },
    monthlyCost: 680,
    trafficIn: 32000,
    trafficOut: 18000,
    securityIssues: [
      makeIssue('medium', 'Multi-AZ not enabled', 'Database is running in a single AZ, risking downtime.', 'Enable Multi-AZ deployment for high availability.'),
    ],
    connections: ['aws-lambda-data'],
    createdAt: '2025-07-01T10:00:00Z',
    tags: { env: 'production', team: 'data', service: 'analytics' },
  },

  // VPCs (2)
  {
    id: 'aws-vpc-prod',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'networking',
    serviceName: 'VPC',
    resourceName: 'prod-vpc',
    region: 'us-east-1',
    status: 'running',
    config: { cidr: '10.0.0.0/16', dnsHostnames: true, dnsResolution: true, tenancy: 'default' },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['aws-subnet-pub1', 'aws-subnet-pub2', 'aws-subnet-priv1', 'aws-nat-gw'],
    createdAt: '2025-03-01T08:00:00Z',
    tags: { env: 'production', team: 'network' },
  },
  {
    id: 'aws-vpc-dev',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'networking',
    serviceName: 'VPC',
    resourceName: 'dev-vpc',
    region: 'us-east-1',
    status: 'running',
    config: { cidr: '10.1.0.0/16', dnsHostnames: true, dnsResolution: true, tenancy: 'default' },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['aws-subnet-dev1', 'aws-ec2-dev1'],
    createdAt: '2025-06-01T08:00:00Z',
    tags: { env: 'development', team: 'network' },
  },

  // Subnets (4)
  {
    id: 'aws-subnet-pub1',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'networking',
    serviceName: 'Subnet',
    resourceName: 'prod-public-1a',
    region: 'us-east-1',
    status: 'running',
    config: { cidr: '10.0.1.0/24', az: 'us-east-1a', publicIp: true },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['aws-vpc-prod', 'aws-alb-prod'],
    createdAt: '2025-03-01T08:00:00Z',
    tags: { env: 'production', tier: 'public' },
  },
  {
    id: 'aws-subnet-pub2',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'networking',
    serviceName: 'Subnet',
    resourceName: 'prod-public-1b',
    region: 'us-east-1',
    status: 'running',
    config: { cidr: '10.0.2.0/24', az: 'us-east-1b', publicIp: true },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['aws-vpc-prod'],
    createdAt: '2025-03-01T08:00:00Z',
    tags: { env: 'production', tier: 'public' },
  },
  {
    id: 'aws-subnet-priv1',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'networking',
    serviceName: 'Subnet',
    resourceName: 'prod-private-1a',
    region: 'us-east-1',
    status: 'running',
    config: { cidr: '10.0.10.0/24', az: 'us-east-1a', publicIp: false },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['aws-vpc-prod', 'aws-ec2-web1', 'aws-ec2-api1'],
    createdAt: '2025-03-01T08:00:00Z',
    tags: { env: 'production', tier: 'private' },
  },
  {
    id: 'aws-subnet-dev1',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'networking',
    serviceName: 'Subnet',
    resourceName: 'dev-subnet-1',
    region: 'us-east-1',
    status: 'running',
    config: { cidr: '10.1.1.0/24', az: 'us-east-1a', publicIp: true },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['aws-vpc-dev'],
    createdAt: '2025-06-01T08:00:00Z',
    tags: { env: 'development', tier: 'public' },
  },

  // ALBs (2)
  {
    id: 'aws-alb-prod',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'loadbalancer',
    serviceName: 'ALB',
    resourceName: 'prod-alb',
    region: 'us-east-1',
    status: 'running',
    config: { scheme: 'internet-facing', type: 'application', crossZone: true, idleTimeout: 60, listeners: ['HTTPS:443'] },
    monthlyCost: 45,
    trafficIn: 350000,
    trafficOut: 340000,
    securityIssues: [],
    connections: ['aws-ec2-web1', 'aws-ec2-api1', 'aws-cloudfront-main'],
    createdAt: '2025-06-15T09:00:00Z',
    tags: { env: 'production', team: 'platform' },
  },
  {
    id: 'aws-nlb-internal',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'loadbalancer',
    serviceName: 'NLB',
    resourceName: 'internal-nlb',
    region: 'us-east-1',
    status: 'running',
    config: { scheme: 'internal', type: 'network', crossZone: true, listeners: ['TCP:5432', 'TCP:6379'] },
    monthlyCost: 30,
    trafficIn: 90000,
    trafficOut: 85000,
    securityIssues: [],
    connections: ['aws-rds-postgres', 'aws-elasticache-redis'],
    createdAt: '2025-06-20T10:00:00Z',
    tags: { env: 'production', team: 'platform' },
  },

  // Security groups (3)
  {
    id: 'aws-sg-web',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'security',
    serviceName: 'SecurityGroup',
    resourceName: 'web-sg',
    region: 'us-east-1',
    status: 'running',
    config: { inboundRules: [{ port: 443, source: '0.0.0.0/0' }, { port: 80, source: '0.0.0.0/0' }], outboundRules: [{ port: 0, destination: '0.0.0.0/0' }] },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['aws-ec2-web1'],
    createdAt: '2025-06-15T08:00:00Z',
    tags: { env: 'production', tier: 'web' },
  },
  {
    id: 'aws-sg-api',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'security',
    serviceName: 'SecurityGroup',
    resourceName: 'api-sg',
    region: 'us-east-1',
    status: 'running',
    config: { inboundRules: [{ port: 8080, source: 'sg-web' }], outboundRules: [{ port: 0, destination: '0.0.0.0/0' }] },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['aws-ec2-api1'],
    createdAt: '2025-06-15T08:00:00Z',
    tags: { env: 'production', tier: 'api' },
  },
  {
    id: 'aws-sg-db',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'security',
    serviceName: 'SecurityGroup',
    resourceName: 'db-sg',
    region: 'us-east-1',
    status: 'running',
    config: { inboundRules: [{ port: 5432, source: 'sg-api' }, { port: 6379, source: 'sg-api' }], outboundRules: [] },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['aws-rds-postgres', 'aws-elasticache-redis'],
    createdAt: '2025-06-15T08:00:00Z',
    tags: { env: 'production', tier: 'database' },
  },

  // Lambda (2)
  {
    id: 'aws-lambda-api',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'serverless',
    serviceName: 'Lambda',
    resourceName: 'api-handler',
    region: 'us-east-1',
    status: 'running',
    config: { runtime: 'nodejs20.x', memoryMb: 512, timeoutSec: 30, concurrency: 100, codeSize: '4.2 MB' },
    monthlyCost: 85,
    trafficIn: 42000,
    trafficOut: 38000,
    securityIssues: [
      makeIssue('low', 'Outdated runtime packages', 'Lambda uses npm packages with known low-severity CVEs.', 'Run npm audit fix and redeploy.'),
    ],
    connections: ['aws-rds-postgres', 'aws-sqs-orders'],
    createdAt: '2025-08-01T14:00:00Z',
    tags: { env: 'production', team: 'backend', service: 'api' },
  },
  {
    id: 'aws-lambda-data',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'serverless',
    serviceName: 'Lambda',
    resourceName: 'data-processor',
    region: 'us-east-1',
    status: 'running',
    config: { runtime: 'python3.12', memoryMb: 1024, timeoutSec: 900, concurrency: 50, codeSize: '12.8 MB' },
    monthlyCost: 120,
    trafficIn: 65000,
    trafficOut: 72000,
    securityIssues: [],
    connections: ['aws-s3-datalake', 'aws-rds-mysql', 'aws-sqs-orders'],
    createdAt: '2025-08-15T10:00:00Z',
    tags: { env: 'production', team: 'data', service: 'etl' },
  },

  // ElastiCache (1)
  {
    id: 'aws-elasticache-redis',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'cache',
    serviceName: 'ElastiCache',
    resourceName: 'prod-redis',
    region: 'us-east-1',
    status: 'running',
    config: { engine: 'Redis 7.0', nodeType: 'cache.r6g.large', numNodes: 3, clusterMode: true, encrypted: true },
    monthlyCost: 540,
    trafficIn: 150000,
    trafficOut: 180000,
    securityIssues: [],
    connections: ['aws-ec2-web1', 'aws-ec2-api1'],
    createdAt: '2025-06-20T12:00:00Z',
    tags: { env: 'production', team: 'platform', service: 'cache' },
  },

  // SQS (1)
  {
    id: 'aws-sqs-orders',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'queue',
    serviceName: 'SQS',
    resourceName: 'order-processing',
    region: 'us-east-1',
    status: 'running',
    config: { type: 'Standard', visibilityTimeout: 30, messageRetention: 345600, maxMessageSize: 262144, dlqEnabled: true },
    monthlyCost: 15,
    trafficIn: 28000,
    trafficOut: 27000,
    securityIssues: [],
    connections: ['aws-ec2-api1', 'aws-lambda-api', 'aws-lambda-data'],
    createdAt: '2025-07-10T09:00:00Z',
    tags: { env: 'production', team: 'backend', service: 'orders' },
  },

  // CloudFront (1)
  {
    id: 'aws-cloudfront-main',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'cdn',
    serviceName: 'CloudFront',
    resourceName: 'prod-distribution',
    region: 'us-east-1',
    status: 'running',
    config: { origins: ['prod-alb', 'app-assets-prod.s3'], priceClass: 'PriceClass_All', httpVersion: 'http2and3', waf: true },
    monthlyCost: 320,
    trafficIn: 50000,
    trafficOut: 890000,
    securityIssues: [],
    connections: ['aws-alb-prod', 'aws-s3-assets', 'aws-route53-main'],
    createdAt: '2025-06-25T08:00:00Z',
    tags: { env: 'production', team: 'platform' },
  },

  // Route53 (1)
  {
    id: 'aws-route53-main',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'dns',
    serviceName: 'Route53',
    resourceName: 'prod-hosted-zone',
    region: 'us-east-1',
    status: 'running',
    config: { domain: 'app.example.com', recordSets: 24, healthChecks: 5, type: 'Public' },
    monthlyCost: 2,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['aws-cloudfront-main', 'aws-alb-prod'],
    createdAt: '2025-03-01T08:00:00Z',
    tags: { env: 'production', team: 'platform' },
  },

  // EKS (1)
  {
    id: 'aws-eks-main',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'container',
    serviceName: 'EKS',
    resourceName: 'prod-eks-cluster',
    region: 'us-east-1',
    status: 'running',
    config: { version: '1.29', nodeGroups: 2, minNodes: 3, maxNodes: 10, currentNodes: 5, instanceType: 'm5.large' },
    monthlyCost: 2800,
    trafficIn: 220000,
    trafficOut: 195000,
    securityIssues: [
      makeIssue('medium', 'Public API endpoint', 'EKS API server endpoint is publicly accessible.', 'Restrict API endpoint access to VPC or specific CIDR blocks.'),
    ],
    connections: ['aws-alb-prod', 'aws-rds-postgres', 'aws-elasticache-redis', 'gcp-pubsub-events'],
    createdAt: '2025-08-20T10:00:00Z',
    tags: { env: 'production', team: 'platform', service: 'kubernetes' },
  },

  // NAT Gateway (1)
  {
    id: 'aws-nat-gw',
    accountId: 'acc-aws-prod',
    provider: 'aws',
    type: 'networking',
    serviceName: 'NAT Gateway',
    resourceName: 'prod-nat-gw',
    region: 'us-east-1',
    status: 'running',
    config: { type: 'public', elasticIp: '52.23.148.92', bandwidth: '45 Gbps' },
    monthlyCost: 95,
    trafficIn: 0,
    trafficOut: 180000,
    securityIssues: [],
    connections: ['aws-vpc-prod'],
    createdAt: '2025-03-01T08:30:00Z',
    tags: { env: 'production', team: 'network' },
  },
]

// ---------------------------------------------------------------------------
// GCP services (18)
// ---------------------------------------------------------------------------

const gcpServices: DiscoveredService[] = [
  // GCE (3)
  {
    id: 'gcp-gce-web1',
    accountId: 'acc-gcp-prod',
    provider: 'gcp',
    type: 'compute',
    serviceName: 'Compute Engine',
    resourceName: 'gcp-web-server-1',
    region: 'us-central1',
    status: 'running',
    config: { machineType: 'n2-standard-4', vCPUs: 4, memoryGb: 16, diskGb: 100, diskType: 'pd-ssd' },
    monthlyCost: 380,
    trafficIn: 72000,
    trafficOut: 210000,
    securityIssues: [],
    connections: ['gcp-lb-main', 'gcp-sql-postgres', 'gcp-memorystore-redis'],
    createdAt: '2025-07-01T10:00:00Z',
    tags: { env: 'production', team: 'platform' },
  },
  {
    id: 'gcp-gce-api1',
    accountId: 'acc-gcp-prod',
    provider: 'gcp',
    type: 'compute',
    serviceName: 'Compute Engine',
    resourceName: 'gcp-api-server-1',
    region: 'us-central1',
    status: 'running',
    config: { machineType: 'n2-standard-2', vCPUs: 2, memoryGb: 8, diskGb: 50, diskType: 'pd-ssd' },
    monthlyCost: 195,
    trafficIn: 95000,
    trafficOut: 140000,
    securityIssues: [
      makeIssue('medium', 'Missing OS patches', 'Instance is running an OS image 45 days behind latest patches.', 'Update the OS image and restart.'),
    ],
    connections: ['gcp-lb-main', 'gcp-sql-postgres', 'gcp-pubsub-events'],
    createdAt: '2025-07-01T10:30:00Z',
    tags: { env: 'production', team: 'backend' },
  },
  {
    id: 'gcp-gce-ml1',
    accountId: 'acc-gcp-prod',
    provider: 'gcp',
    type: 'compute',
    serviceName: 'Compute Engine',
    resourceName: 'gcp-ml-trainer-1',
    region: 'us-central1',
    status: 'running',
    config: { machineType: 'n1-standard-8', vCPUs: 8, memoryGb: 30, diskGb: 500, gpuType: 'nvidia-tesla-t4', gpuCount: 1 },
    monthlyCost: 950,
    trafficIn: 180000,
    trafficOut: 45000,
    securityIssues: [],
    connections: ['gcp-gcs-ml-data', 'gcp-sql-analytics'],
    createdAt: '2025-10-15T08:00:00Z',
    tags: { env: 'production', team: 'ml' },
  },

  // GCS (2)
  {
    id: 'gcp-gcs-assets',
    accountId: 'acc-gcp-prod',
    provider: 'gcp',
    type: 'storage',
    serviceName: 'Cloud Storage',
    resourceName: 'gcp-static-assets',
    region: 'us-central1',
    status: 'running',
    config: { storageClass: 'STANDARD', versioning: false, encryption: 'Google-managed', sizeGb: 120, objectCount: 350000 },
    monthlyCost: 3,
    trafficIn: 1200,
    trafficOut: 68000,
    securityIssues: [
      makeIssue('high', 'Public bucket access', 'Bucket is publicly accessible via allUsers binding.', 'Remove allUsers IAM binding and use signed URLs.'),
    ],
    connections: ['gcp-cdn-main', 'gcp-lb-main'],
    createdAt: '2025-07-05T10:00:00Z',
    tags: { env: 'production', team: 'frontend' },
  },
  {
    id: 'gcp-gcs-ml-data',
    accountId: 'acc-gcp-prod',
    provider: 'gcp',
    type: 'storage',
    serviceName: 'Cloud Storage',
    resourceName: 'gcp-ml-training-data',
    region: 'us-central1',
    status: 'running',
    config: { storageClass: 'STANDARD', versioning: true, encryption: 'CMEK', sizeGb: 2500, objectCount: 12000000 },
    monthlyCost: 58,
    trafficIn: 95000,
    trafficOut: 180000,
    securityIssues: [],
    connections: ['gcp-gce-ml1'],
    createdAt: '2025-10-01T08:00:00Z',
    tags: { env: 'production', team: 'ml' },
  },

  // Cloud SQL (2)
  {
    id: 'gcp-sql-postgres',
    accountId: 'acc-gcp-prod',
    provider: 'gcp',
    type: 'database',
    serviceName: 'Cloud SQL',
    resourceName: 'gcp-prod-postgres',
    region: 'us-central1',
    status: 'running',
    config: { engine: 'PostgreSQL 15', tier: 'db-custom-4-16384', highAvailability: true, storageGb: 250, encrypted: true },
    monthlyCost: 1200,
    trafficIn: 55000,
    trafficOut: 42000,
    securityIssues: [],
    connections: ['gcp-gce-web1', 'gcp-gce-api1', 'gcp-functions-api'],
    createdAt: '2025-07-01T08:00:00Z',
    tags: { env: 'production', team: 'backend' },
  },
  {
    id: 'gcp-sql-analytics',
    accountId: 'acc-gcp-prod',
    provider: 'gcp',
    type: 'database',
    serviceName: 'Cloud SQL',
    resourceName: 'gcp-analytics-postgres',
    region: 'us-central1',
    status: 'running',
    config: { engine: 'PostgreSQL 15', tier: 'db-custom-2-8192', highAvailability: false, storageGb: 100, encrypted: true },
    monthlyCost: 450,
    trafficIn: 28000,
    trafficOut: 15000,
    securityIssues: [
      makeIssue('medium', 'No high availability', 'Database is not configured for HA, risking downtime.', 'Enable high availability in Cloud SQL settings.'),
    ],
    connections: ['gcp-gce-ml1'],
    createdAt: '2025-09-01T10:00:00Z',
    tags: { env: 'production', team: 'data' },
  },

  // VPC (1)
  {
    id: 'gcp-vpc-prod',
    accountId: 'acc-gcp-prod',
    provider: 'gcp',
    type: 'networking',
    serviceName: 'VPC',
    resourceName: 'gcp-prod-vpc',
    region: 'us-central1',
    status: 'running',
    config: { mode: 'custom', mtu: 1460, routingMode: 'GLOBAL' },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['gcp-subnet-pub1', 'gcp-subnet-priv1'],
    createdAt: '2025-07-01T07:00:00Z',
    tags: { env: 'production', team: 'network' },
  },

  // Subnets (2)
  {
    id: 'gcp-subnet-pub1',
    accountId: 'acc-gcp-prod',
    provider: 'gcp',
    type: 'networking',
    serviceName: 'Subnet',
    resourceName: 'gcp-public-subnet-1',
    region: 'us-central1',
    status: 'running',
    config: { cidr: '10.128.0.0/20', privateGoogleAccess: true },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['gcp-vpc-prod', 'gcp-lb-main'],
    createdAt: '2025-07-01T07:10:00Z',
    tags: { env: 'production', tier: 'public' },
  },
  {
    id: 'gcp-subnet-priv1',
    accountId: 'acc-gcp-prod',
    provider: 'gcp',
    type: 'networking',
    serviceName: 'Subnet',
    resourceName: 'gcp-private-subnet-1',
    region: 'us-central1',
    status: 'running',
    config: { cidr: '10.128.16.0/20', privateGoogleAccess: true },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['gcp-vpc-prod', 'gcp-gce-web1', 'gcp-gce-api1'],
    createdAt: '2025-07-01T07:10:00Z',
    tags: { env: 'production', tier: 'private' },
  },

  // GKE (1)
  {
    id: 'gcp-gke-main',
    accountId: 'acc-gcp-prod',
    provider: 'gcp',
    type: 'container',
    serviceName: 'GKE',
    resourceName: 'gcp-prod-gke',
    region: 'us-central1',
    status: 'running',
    config: { version: '1.29.1-gke.1589020', nodeCount: 4, machineType: 'e2-standard-4', autoscaling: true, maxNodes: 8 },
    monthlyCost: 1800,
    trafficIn: 185000,
    trafficOut: 160000,
    securityIssues: [],
    connections: ['gcp-sql-postgres', 'gcp-memorystore-redis', 'aws-eks-main'],
    createdAt: '2025-09-10T10:00:00Z',
    tags: { env: 'production', team: 'platform' },
  },

  // Cloud Load Balancer (1)
  {
    id: 'gcp-lb-main',
    accountId: 'acc-gcp-prod',
    provider: 'gcp',
    type: 'loadbalancer',
    serviceName: 'Cloud Load Balancer',
    resourceName: 'gcp-prod-lb',
    region: 'us-central1',
    status: 'running',
    config: { type: 'HTTPS', scheme: 'EXTERNAL', backendServices: 2, healthChecks: true },
    monthlyCost: 40,
    trafficIn: 280000,
    trafficOut: 275000,
    securityIssues: [],
    connections: ['gcp-gce-web1', 'gcp-gce-api1', 'gcp-cdn-main'],
    createdAt: '2025-07-01T09:00:00Z',
    tags: { env: 'production', team: 'platform' },
  },

  // Firewall rules (2)
  {
    id: 'gcp-fw-allow-http',
    accountId: 'acc-gcp-prod',
    provider: 'gcp',
    type: 'security',
    serviceName: 'Firewall Rule',
    resourceName: 'gcp-allow-http-https',
    region: 'us-central1',
    status: 'running',
    config: { direction: 'INGRESS', action: 'ALLOW', ports: ['80', '443'], sources: ['0.0.0.0/0'], priority: 1000 },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['gcp-gce-web1'],
    createdAt: '2025-07-01T07:30:00Z',
    tags: { env: 'production', tier: 'web' },
  },
  {
    id: 'gcp-fw-deny-all',
    accountId: 'acc-gcp-prod',
    provider: 'gcp',
    type: 'security',
    serviceName: 'Firewall Rule',
    resourceName: 'gcp-deny-all-ingress',
    region: 'us-central1',
    status: 'running',
    config: { direction: 'INGRESS', action: 'DENY', ports: ['all'], sources: ['0.0.0.0/0'], priority: 65534 },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: [],
    createdAt: '2025-07-01T07:30:00Z',
    tags: { env: 'production', tier: 'default' },
  },

  // Cloud Functions (1)
  {
    id: 'gcp-functions-api',
    accountId: 'acc-gcp-prod',
    provider: 'gcp',
    type: 'serverless',
    serviceName: 'Cloud Functions',
    resourceName: 'gcp-api-handler',
    region: 'us-central1',
    status: 'running',
    config: { runtime: 'nodejs20', memoryMb: 256, timeoutSec: 60, minInstances: 1, maxInstances: 50 },
    monthlyCost: 65,
    trafficIn: 35000,
    trafficOut: 30000,
    securityIssues: [],
    connections: ['gcp-sql-postgres', 'gcp-pubsub-events'],
    createdAt: '2025-08-20T10:00:00Z',
    tags: { env: 'production', team: 'backend' },
  },

  // Pub/Sub (1)
  {
    id: 'gcp-pubsub-events',
    accountId: 'acc-gcp-prod',
    provider: 'gcp',
    type: 'queue',
    serviceName: 'Pub/Sub',
    resourceName: 'gcp-event-stream',
    region: 'us-central1',
    status: 'running',
    config: { messageRetention: '7d', subscriptions: 3, messageEncryption: true },
    monthlyCost: 25,
    trafficIn: 48000,
    trafficOut: 45000,
    securityIssues: [],
    connections: ['gcp-gce-api1', 'gcp-functions-api', 'aws-eks-main', 'azure-func-handler'],
    createdAt: '2025-08-01T10:00:00Z',
    tags: { env: 'production', team: 'backend' },
  },

  // Memorystore (1)
  {
    id: 'gcp-memorystore-redis',
    accountId: 'acc-gcp-prod',
    provider: 'gcp',
    type: 'cache',
    serviceName: 'Memorystore',
    resourceName: 'gcp-prod-redis',
    region: 'us-central1',
    status: 'running',
    config: { engine: 'Redis 7.0', tier: 'STANDARD_HA', memorySizeGb: 5, version: '7.0', authEnabled: true },
    monthlyCost: 340,
    trafficIn: 120000,
    trafficOut: 145000,
    securityIssues: [],
    connections: ['gcp-gce-web1', 'gcp-gke-main'],
    createdAt: '2025-07-15T12:00:00Z',
    tags: { env: 'production', team: 'platform' },
  },

  // Cloud CDN (1)
  {
    id: 'gcp-cdn-main',
    accountId: 'acc-gcp-prod',
    provider: 'gcp',
    type: 'cdn',
    serviceName: 'Cloud CDN',
    resourceName: 'gcp-prod-cdn',
    region: 'us-central1',
    status: 'running',
    config: { cacheMode: 'CACHE_ALL_STATIC', defaultTtl: 3600, maxTtl: 86400 },
    monthlyCost: 180,
    trafficIn: 25000,
    trafficOut: 620000,
    securityIssues: [],
    connections: ['gcp-lb-main', 'gcp-gcs-assets'],
    createdAt: '2025-07-10T08:00:00Z',
    tags: { env: 'production', team: 'platform' },
  },
]

// ---------------------------------------------------------------------------
// Azure services (12 + extras = 15 to match)
// ---------------------------------------------------------------------------

const azureServices: DiscoveredService[] = [
  // VMs (3)
  {
    id: 'azure-vm-web1',
    accountId: 'acc-azure-dev',
    provider: 'azure',
    type: 'compute',
    serviceName: 'Virtual Machine',
    resourceName: 'azure-web-vm-1',
    region: 'eastus',
    status: 'running',
    config: { size: 'Standard_D4s_v3', vCPUs: 4, memoryGb: 16, osDisk: 128, dataDisk: 256 },
    monthlyCost: 280,
    trafficIn: 45000,
    trafficOut: 120000,
    securityIssues: [],
    connections: ['azure-lb-main', 'azure-sql-main', 'azure-servicebus-main'],
    createdAt: '2025-11-01T10:00:00Z',
    tags: { env: 'development', team: 'platform' },
  },
  {
    id: 'azure-vm-api1',
    accountId: 'acc-azure-dev',
    provider: 'azure',
    type: 'compute',
    serviceName: 'Virtual Machine',
    resourceName: 'azure-api-vm-1',
    region: 'eastus',
    status: 'running',
    config: { size: 'Standard_D2s_v3', vCPUs: 2, memoryGb: 8, osDisk: 128 },
    monthlyCost: 140,
    trafficIn: 62000,
    trafficOut: 88000,
    securityIssues: [
      makeIssue('high', 'Missing MFA on admin access', 'RDP access does not require multi-factor authentication.', 'Enable Azure MFA for all admin RDP sessions.'),
    ],
    connections: ['azure-lb-main', 'azure-sql-main'],
    createdAt: '2025-11-01T10:30:00Z',
    tags: { env: 'development', team: 'backend' },
  },
  {
    id: 'azure-vm-test1',
    accountId: 'acc-azure-dev',
    provider: 'azure',
    type: 'compute',
    serviceName: 'Virtual Machine',
    resourceName: 'azure-test-vm-1',
    region: 'eastus',
    status: 'stopped',
    config: { size: 'Standard_B2s', vCPUs: 2, memoryGb: 4, osDisk: 64 },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [
      makeIssue('low', 'No encryption at rest', 'OS disk does not have Azure Disk Encryption enabled.', 'Enable Azure Disk Encryption using ADE extension.'),
    ],
    connections: [],
    createdAt: '2026-01-05T14:00:00Z',
    tags: { env: 'development', team: 'qa' },
  },

  // Storage accounts (2)
  {
    id: 'azure-storage-main',
    accountId: 'acc-azure-dev',
    provider: 'azure',
    type: 'storage',
    serviceName: 'Storage Account',
    resourceName: 'azdevstorageaccount01',
    region: 'eastus',
    status: 'running',
    config: { kind: 'StorageV2', tier: 'Standard', replication: 'LRS', accessTier: 'Hot', sizeGb: 200 },
    monthlyCost: 5,
    trafficIn: 8000,
    trafficOut: 35000,
    securityIssues: [
      makeIssue('critical', 'Public blob access enabled', 'Storage account allows anonymous public read access to blobs.', 'Disable public blob access in storage account settings.'),
    ],
    connections: ['azure-func-handler', 'azure-vm-web1'],
    createdAt: '2025-11-05T09:00:00Z',
    tags: { env: 'development', team: 'backend' },
  },
  {
    id: 'azure-storage-backup',
    accountId: 'acc-azure-dev',
    provider: 'azure',
    type: 'storage',
    serviceName: 'Storage Account',
    resourceName: 'azdevbackup2024',
    region: 'eastus',
    status: 'running',
    config: { kind: 'StorageV2', tier: 'Standard', replication: 'GRS', accessTier: 'Cool', sizeGb: 500 },
    monthlyCost: 8,
    trafficIn: 2000,
    trafficOut: 0,
    securityIssues: [],
    connections: [],
    createdAt: '2025-11-10T08:00:00Z',
    tags: { env: 'development', team: 'ops' },
  },

  // SQL Databases (2)
  {
    id: 'azure-sql-main',
    accountId: 'acc-azure-dev',
    provider: 'azure',
    type: 'database',
    serviceName: 'Azure SQL',
    resourceName: 'azure-dev-sqldb',
    region: 'eastus',
    status: 'running',
    config: { tier: 'General Purpose', vCores: 4, storageGb: 100, backupRetention: 7, geoReplication: false },
    monthlyCost: 580,
    trafficIn: 38000,
    trafficOut: 28000,
    securityIssues: [],
    connections: ['azure-vm-web1', 'azure-vm-api1', 'azure-func-handler'],
    createdAt: '2025-11-01T09:00:00Z',
    tags: { env: 'development', team: 'backend' },
  },
  {
    id: 'azure-sql-analytics',
    accountId: 'acc-azure-dev',
    provider: 'azure',
    type: 'database',
    serviceName: 'Azure SQL',
    resourceName: 'azure-analytics-sqldb',
    region: 'eastus',
    status: 'running',
    config: { tier: 'Basic', dtu: 5, storageGb: 2, backupRetention: 7 },
    monthlyCost: 5,
    trafficIn: 5000,
    trafficOut: 3000,
    securityIssues: [],
    connections: [],
    createdAt: '2025-12-01T10:00:00Z',
    tags: { env: 'development', team: 'data' },
  },

  // VNet (1)
  {
    id: 'azure-vnet-main',
    accountId: 'acc-azure-dev',
    provider: 'azure',
    type: 'networking',
    serviceName: 'VNet',
    resourceName: 'azure-dev-vnet',
    region: 'eastus',
    status: 'running',
    config: { addressSpace: '10.2.0.0/16', subnets: 2, dnsServers: ['168.63.129.16'] },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['azure-subnet-web', 'azure-subnet-db'],
    createdAt: '2025-11-01T08:00:00Z',
    tags: { env: 'development', team: 'network' },
  },

  // Subnets (2)
  {
    id: 'azure-subnet-web',
    accountId: 'acc-azure-dev',
    provider: 'azure',
    type: 'networking',
    serviceName: 'Subnet',
    resourceName: 'azure-web-subnet',
    region: 'eastus',
    status: 'running',
    config: { addressPrefix: '10.2.1.0/24', nsg: 'azure-nsg-web' },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['azure-vnet-main', 'azure-vm-web1'],
    createdAt: '2025-11-01T08:10:00Z',
    tags: { env: 'development', tier: 'web' },
  },
  {
    id: 'azure-subnet-db',
    accountId: 'acc-azure-dev',
    provider: 'azure',
    type: 'networking',
    serviceName: 'Subnet',
    resourceName: 'azure-db-subnet',
    region: 'eastus',
    status: 'running',
    config: { addressPrefix: '10.2.10.0/24', nsg: 'azure-nsg-db' },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['azure-vnet-main', 'azure-sql-main'],
    createdAt: '2025-11-01T08:10:00Z',
    tags: { env: 'development', tier: 'database' },
  },

  // Load Balancer (1)
  {
    id: 'azure-lb-main',
    accountId: 'acc-azure-dev',
    provider: 'azure',
    type: 'loadbalancer',
    serviceName: 'Load Balancer',
    resourceName: 'azure-dev-lb',
    region: 'eastus',
    status: 'running',
    config: { sku: 'Standard', type: 'Public', frontendIPs: 1, backendPools: 1, healthProbes: 2 },
    monthlyCost: 25,
    trafficIn: 110000,
    trafficOut: 105000,
    securityIssues: [],
    connections: ['azure-vm-web1', 'azure-vm-api1'],
    createdAt: '2025-11-01T09:30:00Z',
    tags: { env: 'development', team: 'platform' },
  },

  // NSGs (2)
  {
    id: 'azure-nsg-web',
    accountId: 'acc-azure-dev',
    provider: 'azure',
    type: 'security',
    serviceName: 'NSG',
    resourceName: 'azure-web-nsg',
    region: 'eastus',
    status: 'running',
    config: { rules: [{ name: 'AllowHTTPS', port: 443, access: 'Allow', source: '*' }, { name: 'AllowHTTP', port: 80, access: 'Allow', source: '*' }] },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['azure-subnet-web'],
    createdAt: '2025-11-01T08:20:00Z',
    tags: { env: 'development', tier: 'web' },
  },
  {
    id: 'azure-nsg-db',
    accountId: 'acc-azure-dev',
    provider: 'azure',
    type: 'security',
    serviceName: 'NSG',
    resourceName: 'azure-db-nsg',
    region: 'eastus',
    status: 'running',
    config: { rules: [{ name: 'AllowSQL', port: 1433, access: 'Allow', source: '10.2.1.0/24' }] },
    monthlyCost: 0,
    trafficIn: 0,
    trafficOut: 0,
    securityIssues: [],
    connections: ['azure-subnet-db'],
    createdAt: '2025-11-01T08:20:00Z',
    tags: { env: 'development', tier: 'database' },
  },

  // Azure Functions (1)
  {
    id: 'azure-func-handler',
    accountId: 'acc-azure-dev',
    provider: 'azure',
    type: 'serverless',
    serviceName: 'Azure Functions',
    resourceName: 'azure-api-func',
    region: 'eastus',
    status: 'running',
    config: { runtime: 'node', version: '20', plan: 'Consumption', memoryMb: 256, timeout: 300 },
    monthlyCost: 35,
    trafficIn: 22000,
    trafficOut: 18000,
    securityIssues: [],
    connections: ['azure-sql-main', 'azure-storage-main', 'azure-servicebus-main', 'gcp-pubsub-events'],
    createdAt: '2025-12-01T10:00:00Z',
    tags: { env: 'development', team: 'backend' },
  },

  // Service Bus (1)
  {
    id: 'azure-servicebus-main',
    accountId: 'acc-azure-dev',
    provider: 'azure',
    type: 'queue',
    serviceName: 'Service Bus',
    resourceName: 'azure-dev-servicebus',
    region: 'eastus',
    status: 'running',
    config: { tier: 'Standard', queues: 3, topics: 2, maxSizeMb: 1024 },
    monthlyCost: 10,
    trafficIn: 15000,
    trafficOut: 14000,
    securityIssues: [],
    connections: ['azure-func-handler', 'azure-vm-web1'],
    createdAt: '2025-12-05T09:00:00Z',
    tags: { env: 'development', team: 'backend' },
  },

  // AKS (1)
  {
    id: 'azure-aks-main',
    accountId: 'acc-azure-dev',
    provider: 'azure',
    type: 'container',
    serviceName: 'AKS',
    resourceName: 'azure-dev-aks',
    region: 'eastus',
    status: 'running',
    config: { version: '1.28.5', nodeCount: 3, vmSize: 'Standard_D2s_v3', autoscaling: true, maxNodes: 6 },
    monthlyCost: 1200,
    trafficIn: 95000,
    trafficOut: 82000,
    securityIssues: [],
    connections: ['azure-sql-main', 'azure-lb-main'],
    createdAt: '2026-01-15T10:00:00Z',
    tags: { env: 'development', team: 'platform' },
  },
]

const allServices = [...awsServices, ...gcpServices, ...azureServices]

const seedActivities: ActivityEvent[] = [
  { id: 'act-1', serviceId: 'aws-ec2-web1', message: 'EC2 web-server-1 CPU spike detected (92%)', timestamp: '2026-03-30T08:10:00Z', type: 'warning' },
  { id: 'act-2', serviceId: 'aws-s3-assets', message: 'S3 bucket policy changed on app-assets-prod', timestamp: '2026-03-30T07:45:00Z', type: 'info' },
  { id: 'act-3', serviceId: 'azure-vm-test1', message: 'New VM created in Azure: azure-test-vm-1', timestamp: '2026-03-30T06:30:00Z', type: 'success' },
  { id: 'act-4', serviceId: 'gcp-gcs-assets', message: 'Public access detected on gcp-static-assets bucket', timestamp: '2026-03-30T05:15:00Z', type: 'error' },
  { id: 'act-5', serviceId: 'aws-eks-main', message: 'EKS cluster autoscaled from 4 to 5 nodes', timestamp: '2026-03-30T04:00:00Z', type: 'info' },
  { id: 'act-6', serviceId: 'aws-rds-postgres', message: 'RDS prod-postgres automated backup completed', timestamp: '2026-03-30T03:00:00Z', type: 'success' },
  { id: 'act-7', serviceId: 'gcp-gke-main', message: 'GKE cluster version upgrade available: 1.30.0', timestamp: '2026-03-29T22:00:00Z', type: 'info' },
  { id: 'act-8', serviceId: 'azure-storage-main', message: 'Critical: Public blob access on azdevstorageaccount01', timestamp: '2026-03-29T20:00:00Z', type: 'error' },
]

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCloudConnectStore = create<CloudConnectState>((set, get) => ({
  accounts: [] as CloudAccount[],
  services: [] as DiscoveredService[],
  selectedServiceId: null,
  activities: [] as ActivityEvent[],
  loading: false,
  error: null as string | null,
  initialized: false,

  fetchConnections: async () => {
    if (get().initialized) return
    set({ loading: true, error: null })
    try {
      const data = await apiClient.get('/cloud/connections')
      const accounts = (data as any).connections ?? []
      set({ accounts, initialized: true, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false, initialized: true })
    }
  },

  fetchServices: async (provider: string) => {
    try {
      const data = await apiClient.get(`/cloud/connections/${provider}/services`)
      const newServices = (data as any).services ?? []
      set((state) => {
        const otherServices = state.services.filter((s) => s.provider !== provider)
        return { services: [...otherServices, ...newServices] }
      })
    } catch { /* keep existing */ }
  },

  addAccount: (account) => {
    set((state) => ({ accounts: [...state.accounts, account] }))
    apiClient.post(`/cloud/connections/${account.provider}/connect`, account).catch(() => {})
  },

  removeAccount: (id) => {
    const account = get().accounts.find((a) => a.id === id)
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== id),
      services: state.services.filter((s) => s.accountId !== id),
    }))
    if (account) apiClient.post(`/cloud/connections/${account.provider}/disconnect`, {}).catch(() => {})
  },

  syncAccount: (id) => {
    const account = get().accounts.find((a) => a.id === id)
    set((state) => ({
      accounts: state.accounts.map((a) =>
        a.id === id ? { ...a, status: 'syncing' as const, lastSynced: new Date().toISOString() } : a,
      ),
    }))
    if (account) apiClient.post(`/cloud/connections/${account.provider}/sync`, {}).catch(() => {})
  },

  getServicesByAccount: (accountId) =>
    get().services.filter((s) => s.accountId === accountId),

  getServicesByType: (type) =>
    get().services.filter((s) => s.type === type),

  getServiceById: (id) =>
    get().services.find((s) => s.id === id),

  setSelectedService: (id) => set({ selectedServiceId: id }),

  updateServiceTraffic: () => {
    // Attempt to fetch real traffic data from the backend, fall back to simulated deltas on error
    const providers: CloudProvider[] = ['aws', 'gcp', 'azure']
    const apiBase = '/api/v1/cloud'

    Promise.all(
      providers.map((p) =>
        fetch(`${apiBase}/${p}/traffic/summary`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    ).then((results) => {
      const summaries = results.filter(Boolean)
      if (summaries.length === 0) {
        // Fallback: simulated random deltas (original behavior)
        set((state) => ({
          services: state.services.map((s) => {
            if (s.status === 'stopped' || s.status === 'deleting') return s
            const delta = () => (Math.random() - 0.5) * 0.15
            return {
              ...s,
              trafficIn: Math.max(0, Math.round(s.trafficIn * (1 + delta()))),
              trafficOut: Math.max(0, Math.round(s.trafficOut * (1 + delta()))),
            }
          }),
        }))
        return
      }

      // Aggregate real traffic data from all providers
      let totalIn = 0
      let totalOut = 0
      const perServiceMap = new Map<string, { bytesIn: number; bytesOut: number }>()

      for (const summary of summaries) {
        if (summary.total_bytes_in != null) totalIn += summary.total_bytes_in
        if (summary.total_bytes_out != null) totalOut += summary.total_bytes_out
        if (summary.per_service) {
          for (const svc of summary.per_service) {
            perServiceMap.set(svc.service_id, {
              bytesIn: svc.bytes_in ?? 0,
              bytesOut: svc.bytes_out ?? 0,
            })
          }
        }
      }

      set((state) => ({
        services: state.services.map((s) => {
          if (s.status === 'stopped' || s.status === 'deleting') return s
          const match = perServiceMap.get(s.id) || perServiceMap.get(s.resourceName)
          if (match) {
            return { ...s, trafficIn: match.bytesIn, trafficOut: match.bytesOut }
          }
          // If no per-service match, distribute total proportionally with a small random jitter
          const serviceCount = state.services.filter(
            (sv) => sv.status !== 'stopped' && sv.status !== 'deleting'
          ).length
          const share = serviceCount > 0 ? 1 / serviceCount : 0
          const jitter = 1 + (Math.random() - 0.5) * 0.1
          return {
            ...s,
            trafficIn: Math.max(0, Math.round(totalIn * share * jitter)),
            trafficOut: Math.max(0, Math.round(totalOut * share * jitter)),
          }
        }),
      }))
    })
  },

  getCrossCloudConnections: () => {
    const services = get().services
    const map = new Map(services.map((s) => [s.id, s]))
    const pairs: { from: DiscoveredService; to: DiscoveredService }[] = []
    const seen = new Set<string>()

    for (const svc of services) {
      for (const connId of svc.connections) {
        const target = map.get(connId)
        if (target && target.provider !== svc.provider) {
          const key = [svc.id, connId].sort().join('|')
          if (!seen.has(key)) {
            seen.add(key)
            pairs.push({ from: svc, to: target })
          }
        }
      }
    }
    return pairs
  },

  getTotalCost: () =>
    get().services.reduce((sum, s) => sum + s.monthlyCost, 0),

  getSecuritySummary: () => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
    for (const svc of get().services) {
      for (const issue of svc.securityIssues) {
        counts[issue.severity]++
      }
    }
    return counts
  },
}))

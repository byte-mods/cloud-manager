import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'
import { apiClient } from '@/lib/api-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ServiceType =
  | 'compute'
  | 'storage'
  | 'database'
  | 'networking'
  | 'security'
  | 'serverless'
  | 'container'
  | 'cdn'
  | 'dns'
  | 'loadbalancer'
  | 'queue'
  | 'cache'
  | 'ml'
  | 'monitoring'

export type CloudProvider = 'aws' | 'gcp' | 'azure' | 'multi'

export type ServiceNode = {
  id: string
  type: ServiceType
  provider: CloudProvider
  serviceName: string
  label: string
  config: Record<string, any>
  estimatedMonthlyCost: number
  securityIssues: SecurityIssue[]
  trafficIn: number
  trafficOut: number
}

export type SecurityIssue = {
  id: string
  message: string
  severity: 'critical' | 'high' | 'medium' | 'low'
}

export type ServiceConnection = {
  id: string
  source: string
  target: string
  label: string
  protocol: string
  port: number
  encrypted: boolean
  trafficRate: number
}

export type Project = {
  id: string
  name: string
  description: string
  nodes: Node[]
  edges: Edge[]
  createdAt: string
  updatedAt: string
  totalEstimatedCost: number
  provider: CloudProvider
}

// ---------------------------------------------------------------------------
// Cost map
// ---------------------------------------------------------------------------

export const SERVICE_COSTS: Record<string, number> = {
  // Compute
  'EC2': 30,
  'GCE': 30,
  'Azure VM': 30,
  'Lambda': 0.20,
  'Cloud Functions': 0.20,
  'Azure Functions': 0.20,
  'ECS': 73,
  'Cloud Run': 50,
  'Container Apps': 50,
  'EKS': 73,
  'GKE': 73,
  'AKS': 73,
  // Storage
  'S3': 23,
  'GCS': 23,
  'Blob Storage': 23,
  'EFS': 30,
  'Filestore': 30,
  'Azure Files': 30,
  'EBS': 10,
  'Persistent Disk': 10,
  'Managed Disk': 10,
  // Database
  'RDS': 200,
  'Cloud SQL': 200,
  'Azure SQL': 200,
  'DynamoDB': 25,
  'Firestore': 25,
  'CosmosDB': 25,
  'ElastiCache': 60,
  'Memorystore': 60,
  'Azure Cache': 60,
  'Redshift': 180,
  'BigQuery': 100,
  'Synapse': 180,
  // Networking
  'VPC': 0,
  'VNet': 0,
  'ALB': 30,
  'Cloud LB': 30,
  'Azure LB': 30,
  'CloudFront': 85,
  'Cloud CDN': 85,
  'Front Door': 85,
  'Route 53': 5,
  'Cloud DNS': 5,
  'Azure DNS': 5,
  // Security
  'IAM': 0,
  'WAF': 10,
  'KMS': 3,
  'Secrets Manager': 5,
  // Integration
  'SQS': 5,
  'Pub/Sub': 5,
  'Service Bus': 5,
  'SNS': 3,
  'Event Grid': 3,
  'API Gateway': 15,
  'Apigee': 300,
  'APIM': 150,
  // AI/ML
  'SageMaker': 250,
  'Vertex AI': 250,
  'Azure ML': 250,
  'Bedrock': 100,
  'Azure OpenAI': 100,
  // Monitoring
  'CloudWatch': 10,
  'Cloud Monitoring': 10,
  'Azure Monitor': 10,
}

// ---------------------------------------------------------------------------
// Security analysis
// ---------------------------------------------------------------------------

export function analyzeSecurityIssues(node: ServiceNode): SecurityIssue[] {
  const issues: SecurityIssue[] = []
  const cfg = node.config

  if (['storage', 'database'].includes(node.type)) {
    if (!cfg.encryption) {
      issues.push({ id: `${node.id}-enc`, message: 'Encryption not enabled', severity: 'high' })
    }
  }

  if (node.type === 'storage' && cfg.publicAccess) {
    issues.push({ id: `${node.id}-pub`, message: 'Public access enabled', severity: 'critical' })
  }

  if (node.type === 'database' && !cfg.multiAz) {
    issues.push({ id: `${node.id}-az`, message: 'Single AZ deployment', severity: 'medium' })
  }

  if (node.type === 'networking' && cfg.defaultSecurityGroup) {
    issues.push({ id: `${node.id}-sg`, message: 'Using default security group', severity: 'medium' })
  }

  if (node.type === 'compute' && !cfg.imdsv2) {
    issues.push({ id: `${node.id}-imds`, message: 'IMDSv2 not enforced', severity: 'medium' })
  }

  return issues
}

// ---------------------------------------------------------------------------
// Service catalog
// ---------------------------------------------------------------------------

export type ServiceDefinition = {
  serviceName: string
  type: ServiceType
  provider: CloudProvider
  category: string
  defaultConfig: Record<string, any>
}

export const SERVICE_CATALOG: ServiceDefinition[] = [
  // Compute
  { serviceName: 'EC2', type: 'compute', provider: 'aws', category: 'Compute', defaultConfig: { instanceType: 't3.medium', region: 'us-east-1', count: 1, os: 'Amazon Linux 2' } },
  { serviceName: 'GCE', type: 'compute', provider: 'gcp', category: 'Compute', defaultConfig: { instanceType: 'e2-medium', region: 'us-central1', count: 1, os: 'Debian 12' } },
  { serviceName: 'Azure VM', type: 'compute', provider: 'azure', category: 'Compute', defaultConfig: { instanceType: 'Standard_B2s', region: 'eastus', count: 1, os: 'Ubuntu 22.04' } },
  { serviceName: 'Lambda', type: 'serverless', provider: 'aws', category: 'Compute', defaultConfig: { runtime: 'nodejs20.x', memory: 256, timeout: 30 } },
  { serviceName: 'Cloud Functions', type: 'serverless', provider: 'gcp', category: 'Compute', defaultConfig: { runtime: 'nodejs20', memory: 256, timeout: 60 } },
  { serviceName: 'Azure Functions', type: 'serverless', provider: 'azure', category: 'Compute', defaultConfig: { runtime: 'node', memory: 256, timeout: 30 } },
  { serviceName: 'ECS', type: 'container', provider: 'aws', category: 'Compute', defaultConfig: { launchType: 'FARGATE', cpu: 256, memory: 512 } },
  { serviceName: 'Cloud Run', type: 'container', provider: 'gcp', category: 'Compute', defaultConfig: { cpu: 1, memory: '512Mi', maxInstances: 10 } },
  { serviceName: 'Container Apps', type: 'container', provider: 'azure', category: 'Compute', defaultConfig: { cpu: 0.5, memory: '1Gi', maxReplicas: 10 } },
  { serviceName: 'EKS', type: 'container', provider: 'aws', category: 'Compute', defaultConfig: { version: '1.29', nodeCount: 3, nodeType: 't3.medium' } },
  { serviceName: 'GKE', type: 'container', provider: 'gcp', category: 'Compute', defaultConfig: { version: '1.29', nodeCount: 3, machineType: 'e2-medium' } },
  { serviceName: 'AKS', type: 'container', provider: 'azure', category: 'Compute', defaultConfig: { version: '1.29', nodeCount: 3, vmSize: 'Standard_B2s' } },
  // Storage
  { serviceName: 'S3', type: 'storage', provider: 'aws', category: 'Storage', defaultConfig: { storageClass: 'STANDARD', sizeGb: 100, versioning: false, encryption: false } },
  { serviceName: 'GCS', type: 'storage', provider: 'gcp', category: 'Storage', defaultConfig: { storageClass: 'STANDARD', sizeGb: 100, versioning: false, encryption: false } },
  { serviceName: 'Blob Storage', type: 'storage', provider: 'azure', category: 'Storage', defaultConfig: { tier: 'Hot', sizeGb: 100, versioning: false, encryption: false } },
  { serviceName: 'EFS', type: 'storage', provider: 'aws', category: 'Storage', defaultConfig: { performanceMode: 'generalPurpose', encryption: true } },
  { serviceName: 'Filestore', type: 'storage', provider: 'gcp', category: 'Storage', defaultConfig: { tier: 'BASIC_HDD', capacityGb: 1024 } },
  { serviceName: 'Azure Files', type: 'storage', provider: 'azure', category: 'Storage', defaultConfig: { tier: 'Standard', sizeGb: 100 } },
  { serviceName: 'EBS', type: 'storage', provider: 'aws', category: 'Storage', defaultConfig: { volumeType: 'gp3', sizeGb: 100 } },
  { serviceName: 'Persistent Disk', type: 'storage', provider: 'gcp', category: 'Storage', defaultConfig: { type: 'pd-balanced', sizeGb: 100 } },
  { serviceName: 'Managed Disk', type: 'storage', provider: 'azure', category: 'Storage', defaultConfig: { sku: 'Premium_LRS', sizeGb: 128 } },
  // Database
  { serviceName: 'RDS', type: 'database', provider: 'aws', category: 'Database', defaultConfig: { engine: 'PostgreSQL', version: '16', instanceClass: 'db.r6g.large', storageGb: 100, multiAz: false, encryption: false } },
  { serviceName: 'Cloud SQL', type: 'database', provider: 'gcp', category: 'Database', defaultConfig: { engine: 'PostgreSQL', version: '16', tier: 'db-custom-2-8192', storageGb: 100, highAvailability: false, encryption: false } },
  { serviceName: 'Azure SQL', type: 'database', provider: 'azure', category: 'Database', defaultConfig: { engine: 'SQL Server', tier: 'General Purpose', vCores: 2, storageGb: 100, zoneRedundant: false, encryption: false } },
  { serviceName: 'DynamoDB', type: 'database', provider: 'aws', category: 'Database', defaultConfig: { billingMode: 'PAY_PER_REQUEST', encryption: true } },
  { serviceName: 'Firestore', type: 'database', provider: 'gcp', category: 'Database', defaultConfig: { mode: 'Native', encryption: true } },
  { serviceName: 'CosmosDB', type: 'database', provider: 'azure', category: 'Database', defaultConfig: { api: 'SQL', throughput: 400, encryption: true } },
  { serviceName: 'ElastiCache', type: 'cache', provider: 'aws', category: 'Database', defaultConfig: { engine: 'Redis', nodeType: 'cache.r6g.large', numNodes: 1, encryption: false } },
  { serviceName: 'Memorystore', type: 'cache', provider: 'gcp', category: 'Database', defaultConfig: { engine: 'Redis', tier: 'BASIC', memorySizeGb: 1 } },
  { serviceName: 'Azure Cache', type: 'cache', provider: 'azure', category: 'Database', defaultConfig: { sku: 'Standard', family: 'C', capacity: 1 } },
  { serviceName: 'Redshift', type: 'database', provider: 'aws', category: 'Database', defaultConfig: { nodeType: 'ra3.xlplus', numberOfNodes: 2 } },
  { serviceName: 'BigQuery', type: 'database', provider: 'gcp', category: 'Database', defaultConfig: { pricing: 'on-demand' } },
  { serviceName: 'Synapse', type: 'database', provider: 'azure', category: 'Database', defaultConfig: { pool: 'Serverless' } },
  // Networking
  { serviceName: 'VPC', type: 'networking', provider: 'aws', category: 'Networking', defaultConfig: { cidrBlock: '10.0.0.0/16', region: 'us-east-1', azCount: 2, defaultSecurityGroup: true } },
  { serviceName: 'VNet', type: 'networking', provider: 'azure', category: 'Networking', defaultConfig: { cidrBlock: '10.0.0.0/16', region: 'eastus', defaultSecurityGroup: true } },
  { serviceName: 'ALB', type: 'loadbalancer', provider: 'aws', category: 'Networking', defaultConfig: { scheme: 'internet-facing', type: 'application' } },
  { serviceName: 'Cloud LB', type: 'loadbalancer', provider: 'gcp', category: 'Networking', defaultConfig: { scheme: 'EXTERNAL', type: 'HTTP' } },
  { serviceName: 'Azure LB', type: 'loadbalancer', provider: 'azure', category: 'Networking', defaultConfig: { sku: 'Standard', type: 'Public' } },
  { serviceName: 'CloudFront', type: 'cdn', provider: 'aws', category: 'Networking', defaultConfig: { priceClass: 'PriceClass_100' } },
  { serviceName: 'Cloud CDN', type: 'cdn', provider: 'gcp', category: 'Networking', defaultConfig: { cacheMode: 'CACHE_ALL_STATIC' } },
  { serviceName: 'Front Door', type: 'cdn', provider: 'azure', category: 'Networking', defaultConfig: { tier: 'Standard' } },
  { serviceName: 'Route 53', type: 'dns', provider: 'aws', category: 'Networking', defaultConfig: { zoneType: 'public' } },
  { serviceName: 'Cloud DNS', type: 'dns', provider: 'gcp', category: 'Networking', defaultConfig: { visibility: 'public' } },
  { serviceName: 'Azure DNS', type: 'dns', provider: 'azure', category: 'Networking', defaultConfig: { zoneType: 'Public' } },
  // Security
  { serviceName: 'IAM', type: 'security', provider: 'aws', category: 'Security', defaultConfig: {} },
  { serviceName: 'WAF', type: 'security', provider: 'aws', category: 'Security', defaultConfig: { scope: 'REGIONAL' } },
  { serviceName: 'KMS', type: 'security', provider: 'aws', category: 'Security', defaultConfig: { keySpec: 'SYMMETRIC_DEFAULT' } },
  { serviceName: 'Secrets Manager', type: 'security', provider: 'aws', category: 'Security', defaultConfig: { rotation: false } },
  // Integration
  { serviceName: 'SQS', type: 'queue', provider: 'aws', category: 'Integration', defaultConfig: { fifo: false, visibilityTimeout: 30 } },
  { serviceName: 'Pub/Sub', type: 'queue', provider: 'gcp', category: 'Integration', defaultConfig: { ackDeadline: 10 } },
  { serviceName: 'Service Bus', type: 'queue', provider: 'azure', category: 'Integration', defaultConfig: { tier: 'Standard' } },
  { serviceName: 'SNS', type: 'queue', provider: 'aws', category: 'Integration', defaultConfig: { fifo: false } },
  { serviceName: 'Event Grid', type: 'queue', provider: 'azure', category: 'Integration', defaultConfig: {} },
  { serviceName: 'API Gateway', type: 'networking', provider: 'aws', category: 'Integration', defaultConfig: { type: 'REST', stage: 'prod' } },
  { serviceName: 'Apigee', type: 'networking', provider: 'gcp', category: 'Integration', defaultConfig: { tier: 'eval' } },
  { serviceName: 'APIM', type: 'networking', provider: 'azure', category: 'Integration', defaultConfig: { sku: 'Developer' } },
  // AI/ML
  { serviceName: 'SageMaker', type: 'ml', provider: 'aws', category: 'AI/ML', defaultConfig: { instanceType: 'ml.t3.medium' } },
  { serviceName: 'Vertex AI', type: 'ml', provider: 'gcp', category: 'AI/ML', defaultConfig: { machineType: 'n1-standard-4' } },
  { serviceName: 'Azure ML', type: 'ml', provider: 'azure', category: 'AI/ML', defaultConfig: { vmSize: 'Standard_DS3_v2' } },
  { serviceName: 'Bedrock', type: 'ml', provider: 'aws', category: 'AI/ML', defaultConfig: { model: 'anthropic.claude-3' } },
  { serviceName: 'Azure OpenAI', type: 'ml', provider: 'azure', category: 'AI/ML', defaultConfig: { model: 'gpt-4' } },
  // Monitoring
  { serviceName: 'CloudWatch', type: 'monitoring', provider: 'aws', category: 'Monitoring', defaultConfig: { dashboards: 1, alarms: 5 } },
  { serviceName: 'Cloud Monitoring', type: 'monitoring', provider: 'gcp', category: 'Monitoring', defaultConfig: { dashboards: 1, alertPolicies: 5 } },
  { serviceName: 'Azure Monitor', type: 'monitoring', provider: 'azure', category: 'Monitoring', defaultConfig: { dashboards: 1, alerts: 5 } },
]

export const SERVICE_CATEGORIES = [...new Set(SERVICE_CATALOG.map(s => s.category))]

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function templateId() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 11)
}

export function getTemplates(): Omit<Project, 'id' | 'createdAt' | 'updatedAt'>[] {
  return [
    {
      name: '3-Tier Web App',
      description: 'Classic 3-tier architecture: Load Balancer, Compute, Database, Cache, and Storage on AWS',
      provider: 'aws',
      totalEstimatedCost: 403,
      nodes: [
        { id: 't1-alb', type: 'service', position: { x: 400, y: 50 }, data: { serviceNode: { id: 't1-alb', type: 'loadbalancer', provider: 'aws', serviceName: 'ALB', label: 'Web ALB', config: { scheme: 'internet-facing', type: 'application' }, estimatedMonthlyCost: 30, securityIssues: [], trafficIn: 2000, trafficOut: 2000 } as ServiceNode } },
        { id: 't1-ec2a', type: 'service', position: { x: 200, y: 220 }, data: { serviceNode: { id: 't1-ec2a', type: 'compute', provider: 'aws', serviceName: 'EC2', label: 'Web Server 1', config: { instanceType: 't3.medium', region: 'us-east-1', count: 1, os: 'Amazon Linux 2' }, estimatedMonthlyCost: 30, securityIssues: [], trafficIn: 1000, trafficOut: 1000 } as ServiceNode } },
        { id: 't1-ec2b', type: 'service', position: { x: 600, y: 220 }, data: { serviceNode: { id: 't1-ec2b', type: 'compute', provider: 'aws', serviceName: 'EC2', label: 'Web Server 2', config: { instanceType: 't3.medium', region: 'us-east-1', count: 1, os: 'Amazon Linux 2' }, estimatedMonthlyCost: 30, securityIssues: [], trafficIn: 1000, trafficOut: 1000 } as ServiceNode } },
        { id: 't1-rds', type: 'service', position: { x: 250, y: 420 }, data: { serviceNode: { id: 't1-rds', type: 'database', provider: 'aws', serviceName: 'RDS', label: 'Primary DB', config: { engine: 'PostgreSQL', version: '16', instanceClass: 'db.r6g.large', storageGb: 100, multiAz: false, encryption: false }, estimatedMonthlyCost: 200, securityIssues: [], trafficIn: 500, trafficOut: 500 } as ServiceNode } },
        { id: 't1-cache', type: 'service', position: { x: 550, y: 420 }, data: { serviceNode: { id: 't1-cache', type: 'cache', provider: 'aws', serviceName: 'ElastiCache', label: 'Redis Cache', config: { engine: 'Redis', nodeType: 'cache.r6g.large', numNodes: 1, encryption: false }, estimatedMonthlyCost: 60, securityIssues: [], trafficIn: 300, trafficOut: 300 } as ServiceNode } },
        { id: 't1-s3', type: 'service', position: { x: 400, y: 600 }, data: { serviceNode: { id: 't1-s3', type: 'storage', provider: 'aws', serviceName: 'S3', label: 'Static Assets', config: { storageClass: 'STANDARD', sizeGb: 100, versioning: false, encryption: false }, estimatedMonthlyCost: 23, securityIssues: [], trafficIn: 100, trafficOut: 100 } as ServiceNode } },
      ],
      edges: [
        { id: 't1-e1', source: 't1-alb', target: 't1-ec2a', type: 'traffic', data: { protocol: 'HTTP', port: 80, encrypted: false, trafficRate: 1000 } },
        { id: 't1-e2', source: 't1-alb', target: 't1-ec2b', type: 'traffic', data: { protocol: 'HTTP', port: 80, encrypted: false, trafficRate: 1000 } },
        { id: 't1-e3', source: 't1-ec2a', target: 't1-rds', type: 'traffic', data: { protocol: 'TCP', port: 5432, encrypted: false, trafficRate: 500 } },
        { id: 't1-e4', source: 't1-ec2b', target: 't1-rds', type: 'traffic', data: { protocol: 'TCP', port: 5432, encrypted: false, trafficRate: 500 } },
        { id: 't1-e5', source: 't1-ec2a', target: 't1-cache', type: 'traffic', data: { protocol: 'TCP', port: 6379, encrypted: false, trafficRate: 800 } },
        { id: 't1-e6', source: 't1-ec2b', target: 't1-cache', type: 'traffic', data: { protocol: 'TCP', port: 6379, encrypted: false, trafficRate: 800 } },
        { id: 't1-e7', source: 't1-ec2a', target: 't1-s3', type: 'traffic', data: { protocol: 'HTTP', port: 443, encrypted: true, trafficRate: 200 } },
      ],
    },
    {
      name: 'Microservices',
      description: 'Cloud-native microservices with GKE, Cloud SQL, Memorystore, Pub/Sub, and GCS',
      provider: 'gcp',
      totalEstimatedCost: 381,
      nodes: [
        { id: 't2-lb', type: 'service', position: { x: 400, y: 50 }, data: { serviceNode: { id: 't2-lb', type: 'loadbalancer', provider: 'gcp', serviceName: 'Cloud LB', label: 'External LB', config: { scheme: 'EXTERNAL', type: 'HTTP' }, estimatedMonthlyCost: 30, securityIssues: [], trafficIn: 3000, trafficOut: 3000 } as ServiceNode } },
        { id: 't2-gke', type: 'service', position: { x: 400, y: 220 }, data: { serviceNode: { id: 't2-gke', type: 'container', provider: 'gcp', serviceName: 'GKE', label: 'App Cluster', config: { version: '1.29', nodeCount: 3, machineType: 'e2-medium' }, estimatedMonthlyCost: 73, securityIssues: [], trafficIn: 3000, trafficOut: 2000 } as ServiceNode } },
        { id: 't2-sql', type: 'service', position: { x: 150, y: 420 }, data: { serviceNode: { id: 't2-sql', type: 'database', provider: 'gcp', serviceName: 'Cloud SQL', label: 'App Database', config: { engine: 'PostgreSQL', version: '16', tier: 'db-custom-2-8192', storageGb: 100, highAvailability: false, encryption: false }, estimatedMonthlyCost: 200, securityIssues: [], trafficIn: 500, trafficOut: 500 } as ServiceNode } },
        { id: 't2-mem', type: 'service', position: { x: 400, y: 420 }, data: { serviceNode: { id: 't2-mem', type: 'cache', provider: 'gcp', serviceName: 'Memorystore', label: 'Session Cache', config: { engine: 'Redis', tier: 'BASIC', memorySizeGb: 1 }, estimatedMonthlyCost: 60, securityIssues: [], trafficIn: 800, trafficOut: 800 } as ServiceNode } },
        { id: 't2-pubsub', type: 'service', position: { x: 650, y: 420 }, data: { serviceNode: { id: 't2-pubsub', type: 'queue', provider: 'gcp', serviceName: 'Pub/Sub', label: 'Event Bus', config: { ackDeadline: 10 }, estimatedMonthlyCost: 5, securityIssues: [], trafficIn: 200, trafficOut: 200 } as ServiceNode } },
        { id: 't2-gcs', type: 'service', position: { x: 400, y: 600 }, data: { serviceNode: { id: 't2-gcs', type: 'storage', provider: 'gcp', serviceName: 'GCS', label: 'Object Store', config: { storageClass: 'STANDARD', sizeGb: 500, versioning: true, encryption: true }, estimatedMonthlyCost: 13, securityIssues: [], trafficIn: 100, trafficOut: 200 } as ServiceNode } },
      ],
      edges: [
        { id: 't2-e1', source: 't2-lb', target: 't2-gke', type: 'traffic', data: { protocol: 'HTTP', port: 443, encrypted: true, trafficRate: 3000 } },
        { id: 't2-e2', source: 't2-gke', target: 't2-sql', type: 'traffic', data: { protocol: 'TCP', port: 5432, encrypted: false, trafficRate: 500 } },
        { id: 't2-e3', source: 't2-gke', target: 't2-mem', type: 'traffic', data: { protocol: 'TCP', port: 6379, encrypted: false, trafficRate: 800 } },
        { id: 't2-e4', source: 't2-gke', target: 't2-pubsub', type: 'traffic', data: { protocol: 'gRPC', port: 443, encrypted: true, trafficRate: 200 } },
        { id: 't2-e5', source: 't2-gke', target: 't2-gcs', type: 'traffic', data: { protocol: 'HTTP', port: 443, encrypted: true, trafficRate: 300 } },
      ],
    },
    {
      name: 'Serverless API',
      description: 'Serverless event-driven API with Azure Front Door, Functions, CosmosDB, and Blob Storage',
      provider: 'azure',
      totalEstimatedCost: 233.20,
      nodes: [
        { id: 't3-fd', type: 'service', position: { x: 400, y: 50 }, data: { serviceNode: { id: 't3-fd', type: 'cdn', provider: 'azure', serviceName: 'Front Door', label: 'CDN / WAF', config: { tier: 'Standard' }, estimatedMonthlyCost: 85, securityIssues: [], trafficIn: 5000, trafficOut: 5000 } as ServiceNode } },
        { id: 't3-apim', type: 'service', position: { x: 400, y: 220 }, data: { serviceNode: { id: 't3-apim', type: 'networking', provider: 'azure', serviceName: 'APIM', label: 'API Management', config: { sku: 'Consumption' }, estimatedMonthlyCost: 0, securityIssues: [], trafficIn: 5000, trafficOut: 5000 } as ServiceNode } },
        { id: 't3-func', type: 'service', position: { x: 400, y: 400 }, data: { serviceNode: { id: 't3-func', type: 'serverless', provider: 'azure', serviceName: 'Azure Functions', label: 'API Functions', config: { runtime: 'node', memory: 256, timeout: 30 }, estimatedMonthlyCost: 0.20, securityIssues: [], trafficIn: 5000, trafficOut: 3000 } as ServiceNode } },
        { id: 't3-cosmos', type: 'service', position: { x: 200, y: 580 }, data: { serviceNode: { id: 't3-cosmos', type: 'database', provider: 'azure', serviceName: 'CosmosDB', label: 'App Data', config: { api: 'SQL', throughput: 400, encryption: true }, estimatedMonthlyCost: 25, securityIssues: [], trafficIn: 2000, trafficOut: 2000 } as ServiceNode } },
        { id: 't3-blob', type: 'service', position: { x: 600, y: 580 }, data: { serviceNode: { id: 't3-blob', type: 'storage', provider: 'azure', serviceName: 'Blob Storage', label: 'File Storage', config: { tier: 'Hot', sizeGb: 500, versioning: true, encryption: true }, estimatedMonthlyCost: 23, securityIssues: [], trafficIn: 500, trafficOut: 1000 } as ServiceNode } },
      ],
      edges: [
        { id: 't3-e1', source: 't3-fd', target: 't3-apim', type: 'traffic', data: { protocol: 'HTTP', port: 443, encrypted: true, trafficRate: 5000 } },
        { id: 't3-e2', source: 't3-apim', target: 't3-func', type: 'traffic', data: { protocol: 'HTTP', port: 443, encrypted: true, trafficRate: 5000 } },
        { id: 't3-e3', source: 't3-func', target: 't3-cosmos', type: 'traffic', data: { protocol: 'TCP', port: 443, encrypted: true, trafficRate: 2000 } },
        { id: 't3-e4', source: 't3-func', target: 't3-blob', type: 'traffic', data: { protocol: 'HTTP', port: 443, encrypted: true, trafficRate: 1000 } },
      ],
    },
  ]
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'infra-designer-projects'

type InfrastructureState = {
  projects: Project[]
  currentProject: Project | null
  selectedNodeId: string | null

  // Project CRUD
  createProject: (name: string, description: string, provider: CloudProvider) => string
  saveProject: () => void
  loadProject: (id: string) => void
  deleteProject: (id: string) => void
  duplicateProject: (id: string) => string
  listProjects: () => Project[]
  setCurrentProject: (project: Project | null) => void

  // Nodes
  addNode: (serviceNode: ServiceNode, position: { x: number; y: number }) => void
  removeNode: (id: string) => void
  updateNodeConfig: (id: string, config: Record<string, any>) => void
  updateNodeLabel: (id: string, label: string) => void
  setSelectedNodeId: (id: string | null) => void

  // Edges
  addConnection: (connection: { source: string; target: string; protocol: string; port: number; encrypted: boolean }) => void
  removeConnection: (id: string) => void

  // React Flow state sync
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void

  // Traffic simulation
  updateTraffic: () => void

  // Computed
  getTotalCost: () => number
  getSecuritySummary: () => { critical: number; high: number; medium: number; low: number; total: number }
  getSelectedServiceNode: () => ServiceNode | null

  // Project metadata
  updateProjectName: (name: string) => void
}

function loadFromStorage(): Project[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(projects: Project[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
}

export const useInfrastructureStore = create<InfrastructureState>((set, get) => ({
  projects: [],
  currentProject: null,
  selectedNodeId: null,

  createProject: (name, description, provider) => {
    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 11)
    const now = new Date().toISOString()
    const project: Project = {
      id,
      name,
      description,
      provider,
      nodes: [],
      edges: [],
      createdAt: now,
      updatedAt: now,
      totalEstimatedCost: 0,
    }
    const projects = [...loadFromStorage(), project]
    saveToStorage(projects)
    set({ projects, currentProject: project })
    return id
  },

  saveProject: () => {
    const { currentProject } = get()
    if (!currentProject) return
    const updated = { ...currentProject, updatedAt: new Date().toISOString(), totalEstimatedCost: get().getTotalCost() }
    const projects = loadFromStorage().map(p => p.id === updated.id ? updated : p)
    saveToStorage(projects)
    set({ projects, currentProject: updated })
    // Sync to backend
    apiClient.put(`/cloud/designs/${updated.id}`, updated).catch(() => {})
  },

  loadProject: (id) => {
    const projects = loadFromStorage()
    const project = projects.find(p => p.id === id) ?? null
    set({ projects, currentProject: project, selectedNodeId: null })
  },

  deleteProject: (id) => {
    const projects = loadFromStorage().filter(p => p.id !== id)
    saveToStorage(projects)
    const { currentProject } = get()
    set({ projects, currentProject: currentProject?.id === id ? null : currentProject })
  },

  duplicateProject: (id) => {
    const projects = loadFromStorage()
    const orig = projects.find(p => p.id === id)
    if (!orig) return ''
    const newId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 11)
    const now = new Date().toISOString()
    const dup: Project = { ...orig, id: newId, name: `${orig.name} (Copy)`, createdAt: now, updatedAt: now }
    const updated = [...projects, dup]
    saveToStorage(updated)
    set({ projects: updated })
    return newId
  },

  listProjects: () => {
    const projects = loadFromStorage()
    set({ projects })
    return projects
  },

  setCurrentProject: (project) => set({ currentProject: project }),

  addNode: (serviceNode, position) => {
    const { currentProject } = get()
    if (!currentProject) return
    const issues = analyzeSecurityIssues(serviceNode)
    const sn = { ...serviceNode, securityIssues: issues }
    const node: Node = {
      id: serviceNode.id,
      type: 'service',
      position,
      data: { serviceNode: sn },
    }
    const nodes = [...currentProject.nodes, node]
    set({ currentProject: { ...currentProject, nodes, updatedAt: new Date().toISOString() } })
  },

  removeNode: (id) => {
    const { currentProject } = get()
    if (!currentProject) return
    const nodes = currentProject.nodes.filter(n => n.id !== id)
    const edges = currentProject.edges.filter(e => e.source !== id && e.target !== id)
    set({ currentProject: { ...currentProject, nodes, edges, updatedAt: new Date().toISOString() }, selectedNodeId: null })
  },

  updateNodeConfig: (id, config) => {
    const { currentProject } = get()
    if (!currentProject) return
    const nodes = currentProject.nodes.map(n => {
      if (n.id !== id) return n
      const sn = n.data.serviceNode as ServiceNode
      const updated: ServiceNode = {
        ...sn,
        config: { ...sn.config, ...config },
        estimatedMonthlyCost: SERVICE_COSTS[sn.serviceName] ?? 0,
      }
      updated.securityIssues = analyzeSecurityIssues(updated)
      return { ...n, data: { ...n.data, serviceNode: updated } }
    })
    set({ currentProject: { ...currentProject, nodes, updatedAt: new Date().toISOString() } })
  },

  updateNodeLabel: (id, label) => {
    const { currentProject } = get()
    if (!currentProject) return
    const nodes = currentProject.nodes.map(n => {
      if (n.id !== id) return n
      const sn = n.data.serviceNode as ServiceNode
      return { ...n, data: { ...n.data, serviceNode: { ...sn, label } } }
    })
    set({ currentProject: { ...currentProject, nodes, updatedAt: new Date().toISOString() } })
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  addConnection: ({ source, target, protocol, port, encrypted }) => {
    const { currentProject } = get()
    if (!currentProject) return
    const id = `e-${source}-${target}-${Date.now()}`
    const edge: Edge = {
      id,
      source,
      target,
      type: 'traffic',
      data: { protocol, port, encrypted, trafficRate: 100 },
    }
    set({ currentProject: { ...currentProject, edges: [...currentProject.edges, edge], updatedAt: new Date().toISOString() } })
  },

  removeConnection: (id) => {
    const { currentProject } = get()
    if (!currentProject) return
    const edges = currentProject.edges.filter(e => e.id !== id)
    set({ currentProject: { ...currentProject, edges, updatedAt: new Date().toISOString() } })
  },

  setNodes: (nodes) => {
    const { currentProject } = get()
    if (!currentProject) return
    set({ currentProject: { ...currentProject, nodes } })
  },

  setEdges: (edges) => {
    const { currentProject } = get()
    if (!currentProject) return
    set({ currentProject: { ...currentProject, edges } })
  },

  updateTraffic: () => {
    const { currentProject } = get()
    if (!currentProject) return
    const nodes = currentProject.nodes.map(n => {
      const sn = n.data.serviceNode as ServiceNode
      const base = sn.type === 'compute' || sn.type === 'container' ? 2000
        : sn.type === 'database' || sn.type === 'cache' ? 1000
        : sn.type === 'loadbalancer' ? 3000
        : 500
      const jitter = () => Math.floor(Math.random() * base * 0.4) - base * 0.2
      return {
        ...n,
        data: {
          ...n.data,
          serviceNode: {
            ...sn,
            trafficIn: Math.max(0, base + jitter()),
            trafficOut: Math.max(0, base + jitter()),
          },
        },
      }
    })
    const edges = currentProject.edges.map(e => {
      const rate = (e.data?.trafficRate as number) ?? 100
      const jitter = Math.floor(Math.random() * rate * 0.3) - rate * 0.15
      return { ...e, data: { ...e.data, trafficRate: Math.max(10, rate + jitter) } }
    })
    set({ currentProject: { ...currentProject, nodes, edges } })
  },

  getTotalCost: () => {
    const { currentProject } = get()
    if (!currentProject) return 0
    return currentProject.nodes.reduce((sum, n) => {
      const sn = n.data.serviceNode as ServiceNode
      return sum + (sn.estimatedMonthlyCost ?? 0)
    }, 0)
  },

  getSecuritySummary: () => {
    const { currentProject } = get()
    const result = { critical: 0, high: 0, medium: 0, low: 0, total: 0 }
    if (!currentProject) return result
    currentProject.nodes.forEach(n => {
      const sn = n.data.serviceNode as ServiceNode
      ;(sn.securityIssues ?? []).forEach(issue => {
        result[issue.severity]++
        result.total++
      })
    })
    return result
  },

  getSelectedServiceNode: () => {
    const { currentProject, selectedNodeId } = get()
    if (!currentProject || !selectedNodeId) return null
    const node = currentProject.nodes.find(n => n.id === selectedNodeId)
    return node ? (node.data.serviceNode as ServiceNode) : null
  },

  updateProjectName: (name) => {
    const { currentProject } = get()
    if (!currentProject) return
    set({ currentProject: { ...currentProject, name, updatedAt: new Date().toISOString() } })
  },
}))

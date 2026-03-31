import type { Node, Edge } from "@xyflow/react"
import type { ServiceNode, CloudProvider } from "@/stores/infrastructure-store"

function cfnLogicalId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "").replace(/^[^a-zA-Z]/, "R")
}

const resourceMap: Record<string, { type: string; propsGen: (sn: ServiceNode) => Record<string, unknown> }> = {
  EC2: { type: "AWS::EC2::Instance", propsGen: (sn) => ({ InstanceType: sn.config?.instanceType ?? "t3.medium", ImageId: "ami-0abcdef1234567890", Tags: [{ Key: "Name", Value: sn.label }] }) },
  S3: { type: "AWS::S3::Bucket", propsGen: (sn) => ({ BucketName: { "Fn::Sub": `\${AWS::StackName}-${sn.label.toLowerCase().replace(/[^a-z0-9-]/g, "-")}` }, VersioningConfiguration: { Status: "Enabled" }, BucketEncryption: { ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } }] } }) },
  VPC: { type: "AWS::EC2::VPC", propsGen: (sn) => ({ CidrBlock: sn.config?.cidr ?? "10.0.0.0/16", EnableDnsHostnames: true, EnableDnsSupport: true, Tags: [{ Key: "Name", Value: sn.label }] }) },
  RDS: { type: "AWS::RDS::DBInstance", propsGen: (sn) => ({ DBInstanceClass: sn.config?.instanceClass ?? "db.t3.medium", Engine: sn.config?.engine ?? "postgres", EngineVersion: "17", AllocatedStorage: 100, StorageEncrypted: true, MasterUsername: { Ref: "DBUsername" }, MasterUserPassword: { Ref: "DBPassword" } }) },
  Lambda: { type: "AWS::Lambda::Function", propsGen: (sn) => ({ FunctionName: sn.label, Runtime: sn.config?.runtime ?? "nodejs20.x", Handler: "index.handler", MemorySize: sn.config?.memory ?? 256, Timeout: sn.config?.timeout ?? 30, Code: { ZipFile: "exports.handler = async (event) => ({ statusCode: 200 })" } }) },
  EKS: { type: "AWS::EKS::Cluster", propsGen: (sn) => ({ Name: sn.label, Version: sn.config?.version ?? "1.30", ResourcesVpcConfig: { SubnetIds: [{ Ref: "SubnetA" }, { Ref: "SubnetB" }] } }) },
  ALB: { type: "AWS::ElasticLoadBalancingV2::LoadBalancer", propsGen: (sn) => ({ Name: sn.label, Type: "application", Scheme: "internet-facing", Subnets: [{ Ref: "SubnetA" }, { Ref: "SubnetB" }] }) },
  NLB: { type: "AWS::ElasticLoadBalancingV2::LoadBalancer", propsGen: (sn) => ({ Name: sn.label, Type: "network", Scheme: "internet-facing", Subnets: [{ Ref: "SubnetA" }, { Ref: "SubnetB" }] }) },
  Route53: { type: "AWS::Route53::HostedZone", propsGen: (sn) => ({ Name: sn.config?.domain ?? "example.com" }) },
  CloudFront: { type: "AWS::CloudFront::Distribution", propsGen: (sn) => ({ DistributionConfig: { Enabled: true, DefaultCacheBehavior: { ViewerProtocolPolicy: "redirect-to-https", TargetOriginId: "default", ForwardedValues: { QueryString: false } }, Origins: [{ Id: "default", DomainName: "origin.example.com", CustomOriginConfig: { OriginProtocolPolicy: "https-only" } }] } }) },
  SQS: { type: "AWS::SQS::Queue", propsGen: (sn) => ({ QueueName: sn.label, VisibilityTimeout: 30, MessageRetentionPeriod: 345600 }) },
  SNS: { type: "AWS::SNS::Topic", propsGen: (sn) => ({ TopicName: sn.label }) },
  DynamoDB: { type: "AWS::DynamoDB::Table", propsGen: (sn) => ({ TableName: sn.label, BillingMode: "PAY_PER_REQUEST", AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }], KeySchema: [{ AttributeName: "id", KeyType: "HASH" }] }) },
  ElastiCache: { type: "AWS::ElastiCache::CacheCluster", propsGen: (sn) => ({ CacheNodeType: "cache.t3.medium", Engine: "redis", NumCacheNodes: 1 }) },
  EFS: { type: "AWS::EFS::FileSystem", propsGen: (sn) => ({ Encrypted: true, PerformanceMode: "generalPurpose", Tags: [{ Key: "Name", Value: sn.label }] }) },
  ECS: { type: "AWS::ECS::Cluster", propsGen: (sn) => ({ ClusterName: sn.label, CapacityProviders: ["FARGATE", "FARGATE_SPOT"] }) },
  Subnet: { type: "AWS::EC2::Subnet", propsGen: (sn) => ({ VpcId: { Ref: "VPC" }, CidrBlock: sn.config?.cidr ?? "10.0.1.0/24", Tags: [{ Key: "Name", Value: sn.label }] }) },
  SecurityGroup: { type: "AWS::EC2::SecurityGroup", propsGen: (sn) => ({ GroupDescription: sn.label, VpcId: { Ref: "VPC" } }) },
  NAT: { type: "AWS::EC2::NatGateway", propsGen: () => ({ SubnetId: { Ref: "SubnetA" }, AllocationId: { "Fn::GetAtt": ["EIP", "AllocationId"] } }) },
  IGW: { type: "AWS::EC2::InternetGateway", propsGen: (sn) => ({ Tags: [{ Key: "Name", Value: sn.label }] }) },
  WAF: { type: "AWS::WAFv2::WebACL", propsGen: (sn) => ({ Name: sn.label, Scope: "REGIONAL", DefaultAction: { Allow: {} }, VisibilityConfig: { SampledRequestsEnabled: true, CloudWatchMetricsEnabled: true, MetricName: sn.label } }) },
  "API Gateway": { type: "AWS::ApiGatewayV2::Api", propsGen: (sn) => ({ Name: sn.label, ProtocolType: "HTTP" }) },
  Kinesis: { type: "AWS::Kinesis::Stream", propsGen: (sn) => ({ Name: sn.label, ShardCount: 1 }) },
  Redshift: { type: "AWS::Redshift::Cluster", propsGen: (sn) => ({ ClusterType: "single-node", NodeType: "dc2.large", DBName: "warehouse", MasterUsername: { Ref: "DBUsername" }, MasterUserPassword: { Ref: "DBPassword" } }) },
}

function yamlValue(v: unknown, indent: number): string {
  const pad = "  ".repeat(indent)
  if (v === null || v === undefined) return "null"
  if (typeof v === "string") return v.startsWith("!") ? v : `"${v}"`
  if (typeof v === "boolean" || typeof v === "number") return String(v)
  if (Array.isArray(v)) return "\n" + v.map(item => {
    if (typeof item === "object" && item !== null) {
      const entries = Object.entries(item)
      const first = entries[0]
      const rest = entries.slice(1)
      let s = `${pad}- ${first[0]}: ${yamlValue(first[1], indent + 2)}`
      for (const [k, val] of rest) s += `\n${pad}  ${k}: ${yamlValue(val, indent + 2)}`
      return s
    }
    return `${pad}- ${yamlValue(item, indent + 1)}`
  }).join("\n")
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>)
    return "\n" + entries.map(([k, val]) => `${pad}${k}: ${yamlValue(val, indent + 1)}`).join("\n")
  }
  return String(v)
}

function toYaml(obj: Record<string, unknown>, indent = 0): string {
  const pad = "  ".repeat(indent)
  return Object.entries(obj).map(([k, v]) => `${pad}${k}: ${yamlValue(v, indent + 1)}`).join("\n")
}

export function generateCloudFormation(
  nodes: Node[],
  edges: Edge[],
  provider: CloudProvider,
  projectName: string,
): string {
  const resources: Record<string, { Type: string; Properties: Record<string, unknown> }> = {}
  const parameters: Record<string, { Type: string; Default?: string; Description: string; NoEcho?: boolean }> = {
    Environment: { Type: "String", Default: "production", Description: "Deployment environment" },
    DBUsername: { Type: "String", Default: "admin", Description: "Database master username" },
    DBPassword: { Type: "String", NoEcho: true, Description: "Database master password" },
  }

  for (const node of nodes) {
    const sn = node.data as ServiceNode
    if (!sn?.type) continue
    const mapping = resourceMap[sn.type]
    if (!mapping) continue
    const logicalId = cfnLogicalId(sn.label || sn.type)
    resources[logicalId] = {
      Type: mapping.type,
      Properties: mapping.propsGen(sn),
    }
  }

  const template: Record<string, unknown> = {
    AWSTemplateFormatVersion: "2010-09-09",
    Description: `CloudFormation template for ${projectName} - generated by Cloud Manager`,
    Parameters: parameters,
    Resources: resources,
    Outputs: {
      StackName: { Description: "Stack name", Value: { Ref: "AWS::StackName" } },
    },
  }

  let yaml = `AWSTemplateFormatVersion: "2010-09-09"\n`
  yaml += `Description: "CloudFormation template for ${projectName} - generated by Cloud Manager"\n\n`
  yaml += `Parameters:\n`
  for (const [name, param] of Object.entries(parameters)) {
    yaml += `  ${name}:\n`
    yaml += `    Type: ${param.Type}\n`
    yaml += `    Description: "${param.Description}"\n`
    if (param.Default !== undefined) yaml += `    Default: "${param.Default}"\n`
    if (param.NoEcho) yaml += `    NoEcho: true\n`
  }
  yaml += `\nResources:\n`
  for (const [name, res] of Object.entries(resources)) {
    yaml += `  ${name}:\n`
    yaml += `    Type: ${res.Type}\n`
    yaml += `    Properties:\n`
    yaml += toYaml(res.Properties, 3) + "\n\n"
  }
  yaml += `Outputs:\n  StackName:\n    Description: "Stack name"\n    Value: !Ref AWS::StackName\n`

  return yaml
}

export function downloadCloudFormationFile(content: string, projectName: string) {
  const blob = new Blob([content], { type: "text/yaml" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${projectName}-cloudformation.yaml`
  a.click()
  URL.revokeObjectURL(url)
}

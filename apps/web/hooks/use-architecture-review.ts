"use client"

import { useState, useCallback } from "react"
import type { Node, Edge } from "@xyflow/react"
import type { ServiceNode } from "@/stores/infrastructure-store"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReviewSeverity = "critical" | "high" | "medium" | "low"

export type ReviewFinding = {
  id: string
  pillar: "security" | "reliability" | "performance" | "cost" | "operational"
  severity: ReviewSeverity
  title: string
  description: string
  recommendation: string
  affectedNodes: string[]
}

export type PillarScore = {
  pillar: string
  score: number
  findings: ReviewFinding[]
}

export type ArchitectureReview = {
  overallScore: number
  grade: string
  pillars: PillarScore[]
  timestamp: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getServiceNodes(nodes: Node[]): ServiceNode[] {
  return nodes
    .map((n) => n.data?.serviceNode as ServiceNode | undefined)
    .filter(Boolean) as ServiceNode[]
}

function hasNodeOfType(services: ServiceNode[], type: string): boolean {
  return services.some((s) => s.type === type)
}

function hasServiceNamed(services: ServiceNode[], ...names: string[]): boolean {
  return services.some((s) =>
    names.some((n) => s.serviceName.toLowerCase().includes(n.toLowerCase()))
  )
}

function findNodesOfType(services: ServiceNode[], type: string): ServiceNode[] {
  return services.filter((s) => s.type === type)
}

function computeGrade(score: number): string {
  if (score >= 90) return "A"
  if (score >= 80) return "B"
  if (score >= 70) return "C"
  if (score >= 60) return "D"
  return "F"
}

function severityWeight(s: ReviewSeverity): number {
  switch (s) {
    case "critical":
      return 20
    case "high":
      return 12
    case "medium":
      return 6
    case "low":
      return 3
  }
}

function pillarScore(findings: ReviewFinding[]): number {
  const penalty = findings.reduce((sum, f) => sum + severityWeight(f.severity), 0)
  return Math.max(0, Math.min(100, 100 - penalty))
}

let findingCounter = 0
function fid(): string {
  return `finding-${++findingCounter}-${Date.now()}`
}

// ---------------------------------------------------------------------------
// Analysis engine
// ---------------------------------------------------------------------------

function analyzeInfrastructure(nodes: Node[], _edges: Edge[]): ArchitectureReview {
  findingCounter = 0
  const services = getServiceNodes(nodes)
  const findings: ReviewFinding[] = []

  if (services.length === 0) {
    return {
      overallScore: 0,
      grade: "F",
      pillars: [
        { pillar: "Security", score: 0, findings: [] },
        { pillar: "Reliability", score: 0, findings: [] },
        { pillar: "Performance Efficiency", score: 0, findings: [] },
        { pillar: "Cost Optimization", score: 100, findings: [] },
        { pillar: "Operational Excellence", score: 0, findings: [] },
      ],
      timestamp: new Date().toISOString(),
    }
  }

  // -----------------------------------------------------------------------
  // Security checks
  // -----------------------------------------------------------------------
  const hasLB = hasNodeOfType(services, "loadbalancer")
  const hasWAF = hasServiceNamed(services, "WAF")
  if (hasLB && !hasWAF) {
    findings.push({
      id: fid(),
      pillar: "security",
      severity: "high",
      title: "Missing WAF protection",
      description:
        "A load balancer is exposed to the internet without a Web Application Firewall in front of it.",
      recommendation:
        "Add an AWS WAF resource in front of the load balancer to filter malicious requests.",
      affectedNodes: findNodesOfType(services, "loadbalancer").map((n) => n.id),
    })
  }

  const databases = findNodesOfType(services, "database")
  const dbWithoutPrivateSubnet = databases.filter((_db) => {
    const hasVPC = services.some(
      (s) => s.type === "networking" && ["VPC", "VNet"].includes(s.serviceName)
    )
    return !hasVPC
  })
  if (dbWithoutPrivateSubnet.length > 0) {
    findings.push({
      id: fid(),
      pillar: "security",
      severity: "critical",
      title: "Database not in private subnet",
      description:
        "Databases are deployed without a VPC/VNet, meaning they may be directly accessible from the internet.",
      recommendation:
        "Add a VPC or VNet and ensure databases are placed within private subnets.",
      affectedNodes: dbWithoutPrivateSubnet.map((n) => n.id),
    })
  }

  const storageWithoutEncryption = services.filter(
    (s) =>
      (s.type === "storage" || s.type === "database") && !s.config.encryption
  )
  if (storageWithoutEncryption.length > 0) {
    findings.push({
      id: fid(),
      pillar: "security",
      severity: "high",
      title: "Storage encryption not enabled",
      description:
        "One or more storage or database resources do not have encryption enabled at rest.",
      recommendation:
        "Enable encryption on all storage and database resources to protect data at rest.",
      affectedNodes: storageWithoutEncryption.map((n) => n.id),
    })
  }

  if (!hasServiceNamed(services, "IAM")) {
    findings.push({
      id: fid(),
      pillar: "security",
      severity: "medium",
      title: "No IAM configuration",
      description:
        "No IAM service is present in the architecture, which means access control policies are not explicitly defined.",
      recommendation:
        "Add an IAM resource to define roles and policies for least-privilege access.",
      affectedNodes: [],
    })
  }

  if (!hasServiceNamed(services, "KMS")) {
    findings.push({
      id: fid(),
      pillar: "security",
      severity: "medium",
      title: "No key management service",
      description:
        "No KMS is configured. Encryption keys are not being centrally managed.",
      recommendation:
        "Add a KMS resource to manage encryption keys centrally and enable automatic key rotation.",
      affectedNodes: [],
    })
  }

  // -----------------------------------------------------------------------
  // Reliability checks
  // -----------------------------------------------------------------------
  const computeNodes = services.filter(
    (s) => s.type === "compute" || s.type === "container" || s.type === "serverless"
  )
  const computeByName = new Map<string, ServiceNode[]>()
  computeNodes.forEach((c) => {
    const list = computeByName.get(c.serviceName) ?? []
    list.push(c)
    computeByName.set(c.serviceName, list)
  })
  const singleInstances = [...computeByName.entries()].filter(
    ([, list]) => list.length === 1 && list[0].type !== "serverless"
  )
  if (singleInstances.length > 0) {
    findings.push({
      id: fid(),
      pillar: "reliability",
      severity: "high",
      title: "Single point of failure",
      description:
        "One or more compute/container services have only a single instance with no redundancy.",
      recommendation:
        "Add a second instance or enable auto-scaling to eliminate single points of failure.",
      affectedNodes: singleInstances.flatMap(([, list]) =>
        list.map((n) => n.id)
      ),
    })
  }

  const dbWithoutMultiAZ = databases.filter(
    (db) => !db.config.multiAz && !db.config.highAvailability && !db.config.zoneRedundant
  )
  if (dbWithoutMultiAZ.length > 0) {
    findings.push({
      id: fid(),
      pillar: "reliability",
      severity: "high",
      title: "Database not multi-AZ",
      description:
        "Databases are running in a single availability zone. An AZ failure would cause downtime.",
      recommendation:
        "Enable Multi-AZ deployment for production databases to ensure automatic failover.",
      affectedNodes: dbWithoutMultiAZ.map((n) => n.id),
    })
  }

  if (!hasLB && computeNodes.length > 1) {
    findings.push({
      id: fid(),
      pillar: "reliability",
      severity: "medium",
      title: "No load balancing",
      description:
        "Multiple compute instances exist without a load balancer to distribute traffic.",
      recommendation:
        "Add a load balancer to distribute traffic across compute instances.",
      affectedNodes: computeNodes.map((n) => n.id),
    })
  }

  // Check for auto-scaling: if compute nodes exist but config.count === 1 and no auto-scaling mention
  const noAutoScaling = computeNodes.filter(
    (s) => s.type === "compute" && (s.config.count ?? 1) <= 1
  )
  if (noAutoScaling.length > 0) {
    findings.push({
      id: fid(),
      pillar: "reliability",
      severity: "medium",
      title: "No auto-scaling configured",
      description:
        "Compute instances have a fixed count without auto-scaling, limiting elasticity.",
      recommendation:
        "Configure auto-scaling groups to automatically adjust capacity based on demand.",
      affectedNodes: noAutoScaling.map((n) => n.id),
    })
  }

  const hasBackup =
    hasServiceNamed(services, "S3", "GCS", "Blob Storage") ||
    services.some((s) => s.config.versioning)
  if (!hasBackup && databases.length > 0) {
    findings.push({
      id: fid(),
      pillar: "reliability",
      severity: "high",
      title: "No backup strategy",
      description:
        "No storage or snapshot service is present for database backups.",
      recommendation:
        "Add a storage service with versioning enabled to serve as a backup target for databases.",
      affectedNodes: databases.map((n) => n.id),
    })
  }

  // -----------------------------------------------------------------------
  // Performance Efficiency checks
  // -----------------------------------------------------------------------
  if (!hasNodeOfType(services, "cdn")) {
    findings.push({
      id: fid(),
      pillar: "performance",
      severity: "medium",
      title: "No CDN for content delivery",
      description:
        "No CDN is configured. Static content is served directly from origin servers, increasing latency.",
      recommendation:
        "Add a CDN (CloudFront, Cloud CDN, or Front Door) to serve static content from edge locations.",
      affectedNodes: [],
    })
  }

  if (!hasNodeOfType(services, "cache")) {
    findings.push({
      id: fid(),
      pillar: "performance",
      severity: "medium",
      title: "No caching layer",
      description:
        "No cache service is present. Repeated database queries will not be cached, increasing latency.",
      recommendation:
        "Add a caching layer (ElastiCache, Memorystore, or Azure Cache) to cache frequent queries.",
      affectedNodes: databases.map((n) => n.id),
    })
  }

  if (databases.length > 0 && databases.every((db) => !db.config.readReplicas)) {
    findings.push({
      id: fid(),
      pillar: "performance",
      severity: "low",
      title: "No read replicas",
      description:
        "Databases have no read replicas configured, limiting read throughput.",
      recommendation:
        "Consider adding read replicas for read-heavy workloads to improve performance.",
      affectedNodes: databases.map((n) => n.id),
    })
  }

  // -----------------------------------------------------------------------
  // Cost Optimization checks
  // -----------------------------------------------------------------------
  const largeCompute = computeNodes.filter((s) => {
    const it = (s.config.instanceType ?? s.config.vmSize ?? "") as string
    return (
      it.includes("xlarge") ||
      it.includes("large") ||
      it.includes("Standard_D") ||
      it.includes("Standard_E")
    )
  })
  if (largeCompute.length > 0) {
    findings.push({
      id: fid(),
      pillar: "cost",
      severity: "medium",
      title: "Consider rightsizing instances",
      description:
        "Some compute instances are using large instance types that may be oversized for the workload.",
      recommendation:
        "Review CPU and memory utilization and consider downsizing to smaller instance types.",
      affectedNodes: largeCompute.map((n) => n.id),
    })
  }

  if (computeNodes.length > 0) {
    findings.push({
      id: fid(),
      pillar: "cost",
      severity: "low",
      title: "Consider reserved instances",
      description:
        "All compute resources are using on-demand pricing. Reserved instances offer significant savings.",
      recommendation:
        "For stable workloads, purchase reserved instances or savings plans for up to 72% cost savings.",
      affectedNodes: computeNodes.map((n) => n.id),
    })
  }

  const serviceTypeCount = new Map<string, number>()
  services.forEach((s) => {
    serviceTypeCount.set(s.type, (serviceTypeCount.get(s.type) ?? 0) + 1)
  })
  const duplicatedTypes = [...serviceTypeCount.entries()].filter(
    ([type, count]) => count > 3 && type !== "compute"
  )
  if (duplicatedTypes.length > 0) {
    findings.push({
      id: fid(),
      pillar: "cost",
      severity: "low",
      title: "Potential service consolidation",
      description:
        "Multiple services of the same type are deployed. Consider whether some can be consolidated.",
      recommendation:
        "Review whether separate instances can be consolidated to reduce costs.",
      affectedNodes: [],
    })
  }

  // -----------------------------------------------------------------------
  // Operational Excellence checks
  // -----------------------------------------------------------------------
  if (!hasNodeOfType(services, "monitoring")) {
    findings.push({
      id: fid(),
      pillar: "operational",
      severity: "high",
      title: "No monitoring configured",
      description:
        "No monitoring service is present. Issues will go undetected until users report them.",
      recommendation:
        "Add a monitoring service (CloudWatch, Cloud Monitoring, or Azure Monitor) with dashboards and alarms.",
      affectedNodes: [],
    })
  }

  // Check for logging — we treat monitoring as covering logging if present
  if (!hasNodeOfType(services, "monitoring") && services.length >= 3) {
    findings.push({
      id: fid(),
      pillar: "operational",
      severity: "medium",
      title: "No centralized logging",
      description:
        "No centralized logging service is configured. Debugging production issues will be difficult.",
      recommendation:
        "Set up centralized logging with CloudWatch Logs, Cloud Logging, or Azure Log Analytics.",
      affectedNodes: [],
    })
  }

  // No CI/CD — we look for API Gateway + serverless as a proxy for pipelines
  const hasAPIGateway = hasServiceNamed(services, "API Gateway", "Apigee", "APIM")
  if (!hasAPIGateway && services.length >= 3) {
    findings.push({
      id: fid(),
      pillar: "operational",
      severity: "medium",
      title: "No deployment pipeline",
      description:
        "No API Gateway or deployment pipeline is configured, suggesting manual deployments.",
      recommendation:
        "Consider adding an API Gateway for managed deployment stages and traffic control.",
      affectedNodes: [],
    })
  }

  // -----------------------------------------------------------------------
  // Assemble pillar scores
  // -----------------------------------------------------------------------
  const pillarMap: Record<string, { label: string; key: ReviewFinding["pillar"] }> = {
    security: { label: "Security", key: "security" },
    reliability: { label: "Reliability", key: "reliability" },
    performance: { label: "Performance Efficiency", key: "performance" },
    cost: { label: "Cost Optimization", key: "cost" },
    operational: { label: "Operational Excellence", key: "operational" },
  }

  const pillars: PillarScore[] = Object.values(pillarMap).map(({ label, key }) => {
    const pillarFindings = findings.filter((f) => f.pillar === key)
    return {
      pillar: label,
      score: pillarScore(pillarFindings),
      findings: pillarFindings,
    }
  })

  const overallScore = Math.round(
    pillars.reduce((sum, p) => sum + p.score, 0) / pillars.length
  )

  return {
    overallScore,
    grade: computeGrade(overallScore),
    pillars,
    timestamp: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useArchitectureReview() {
  const [review, setReview] = useState<ArchitectureReview | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const runReview = useCallback((nodes: Node[], edges: Edge[]) => {
    setIsAnalyzing(true)
    setReview(null)

    // Simulate analysis delay
    setTimeout(() => {
      const result = analyzeInfrastructure(nodes, edges)
      setReview(result)
      setIsAnalyzing(false)
    }, 1500)
  }, [])

  return { review, isAnalyzing, runReview }
}

import type { CloudProvider } from "./cloud"

export type Severity = "critical" | "high" | "medium" | "low" | "informational"
export type FindingStatus = "open" | "resolved" | "suppressed" | "in_progress"

export interface SecurityFinding {
  id: string
  title: string
  description: string
  severity: Severity
  status: FindingStatus
  provider: CloudProvider
  resourceId: string
  resourceType: string
  remediation?: string
  cvss?: number
  cve?: string
  detectedAt: string
}

export type ComplianceFramework = "soc2" | "iso27001" | "hipaa" | "pci_dss" | "gdpr" | "nist_csf" | "cis"

export interface ComplianceStatus {
  framework: ComplianceFramework
  score: number
  totalControls: number
  passingControls: number
  failingControls: number
  lastAssessed: string
}

export interface ScanResult {
  id: string
  type: "vulnerability" | "compliance" | "penetration" | "posture"
  status: "running" | "completed" | "failed"
  startedAt: string
  completedAt?: string
  findingsCount: number
  criticalCount: number
  highCount: number
}

export interface SecurityPosture {
  overallScore: number
  categories: { name: string; score: number; weight: number }[]
  trend: "improving" | "declining" | "stable"
  lastUpdated: string
}

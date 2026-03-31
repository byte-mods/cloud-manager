"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const labelMap: Record<string, string> = {
  dashboard: "Dashboard",
  compute: "Compute",
  instances: "Instances",
  containers: "Containers",
  kubernetes: "Kubernetes",
  serverless: "Serverless",
  batch: "Batch",
  storage: "Storage",
  object: "Object Storage",
  file: "File Storage",
  block: "Block Storage",
  archive: "Archive",
  backup: "Backup",
  networking: "Networking",
  vpc: "VPC",
  "load-balancers": "Load Balancers",
  dns: "DNS",
  cdn: "CDN",
  firewall: "Firewall",
  vpn: "VPN",
  databases: "Databases",
  relational: "Relational",
  nosql: "NoSQL",
  "in-memory": "In-Memory",
  warehouse: "Data Warehouse",
  "ai-ml": "AI/ML",
  models: "Models",
  training: "Training",
  mlops: "MLOps",
  "ai-services": "AI Services",
  genai: "GenAI",
  security: "Security",
  iam: "IAM",
  secrets: "Secrets",
  certificates: "Certificates",
  "threat-detection": "Threat Detection",
  audit: "Audit",
  "security-testing": "Security Testing",
  vapt: "VAPT",
  "vulnerability-scanner": "Vulnerability Scanner",
  "ddos-testing": "DDoS Testing",
  "pen-testing": "Pen Testing",
  compliance: "Compliance",
  posture: "Posture",
  monitoring: "Monitoring",
  dashboards: "Dashboards",
  metrics: "Metrics",
  logs: "Logs",
  alerts: "Alerts",
  tracing: "Tracing",
  uptime: "Uptime",
  devops: "DevOps",
  pipelines: "Pipelines",
  iac: "IaC",
  gitops: "GitOps",
  deployment: "Deployment",
  config: "Config",
  "data-engineering": "Data Engineering",
  etl: "ETL",
  streaming: "Streaming",
  "data-lake": "Data Lake",
  integration: "Integration",
  cost: "Cost Management",
  overview: "Overview",
  explorer: "Explorer",
  budgets: "Budgets",
  recommendations: "Recommendations",
  reservations: "Reservations",
  iot: "IoT",
  devices: "Devices",
  "digital-twins": "Digital Twins",
  rules: "Rules",
  edge: "Edge",
  analytics: "Analytics",
  "query-engines": "Query Engines",
  visualization: "Visualization",
  search: "Search",
  reports: "Reports",
  "ai-assistant": "AI Assistant",
  terminal: "Terminal",
  chat: "Chat",
  suggestions: "Suggestions",
  learn: "Learn",
  paths: "Learning Paths",
  tutorials: "Tutorials",
  sandbox: "Sandbox",
  progress: "Progress",
  settings: "Settings",
  profile: "Profile",
  organization: "Organization",
  "cloud-accounts": "Cloud Accounts",
  "api-keys": "API Keys",
}

function segmentToLabel(segment: string): string {
  return labelMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ")
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
      {segments.map((segment, index) => {
        const href = "/" + segments.slice(0, index + 1).join("/")
        const isLast = index === segments.length - 1
        const label = segmentToLabel(segment)

        return (
          <span key={href} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
            {isLast ? (
              <span className={cn("font-medium text-foreground")}>{label}</span>
            ) : (
              <Link
                href={href}
                className="hover:text-foreground transition-colors"
              >
                {label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}

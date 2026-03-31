"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Server,
  HardDrive,
  Network,
  Database,
  Brain,
  Shield,
  Bug,
  Activity,
  GitBranch,
  Workflow,
  DollarSign,
  Cpu,
  BarChart3,
  Bot,
  GraduationCap,
  Settings,
  Cloud,
  Container,
  Globe,
  Lock,
  Eye,
  Terminal,
  MessageSquare,
  Lightbulb,
  BookOpen,
  Users,
  Key,
  CreditCard,
  Layers,
  Radio,
  Search,
  FileText,
  Gauge,
  Bell,
  Zap,
  Route,
  Wifi,
  Archive,
  Upload,
  Box,
  MonitorSpeaker,
  FlaskConical,
  LayoutDashboard,
  Link2,
  Unplug,
  Map,
  Antenna,
  ScanEye,
  AlertTriangle,
  GitCompare,
  Siren,
  FileCode,
  CheckSquare,
  History,
  PieChart,
  Flame,
  Wrench,
  Calendar,
  Plug,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { usePermissions, type Module } from "@/hooks/use-permissions"

type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  module?: Module
}

type NavSection = {
  label: string
  items: NavItem[]
}

const navigation: NavSection[] = [
  {
    label: "Main",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: Home },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { title: "Designer", href: "/dashboard/infrastructure/designer", icon: LayoutDashboard, module: "infrastructure" },
      { title: "Projects", href: "/dashboard/infrastructure/projects", icon: Layers, module: "infrastructure" },
      { title: "Templates", href: "/dashboard/infrastructure", icon: FileText, module: "infrastructure" },
      { title: "Drift Detection", href: "/dashboard/infrastructure/drift", icon: GitCompare, module: "infrastructure" },
    ],
  },
  {
    label: "Cloud Connect",
    items: [
      { title: "Dashboard", href: "/dashboard/cloud-connect", icon: Link2, module: "cloud_connect" },
      { title: "Topology", href: "/dashboard/cloud-connect/topology", icon: Map, module: "cloud_connect" },
      { title: "Services", href: "/dashboard/cloud-connect/services", icon: Server, module: "cloud_connect" },
      { title: "Live Traffic", href: "/dashboard/cloud-connect/traffic", icon: Antenna, module: "cloud_connect" },
      { title: "Security", href: "/dashboard/cloud-connect/security", icon: ScanEye, module: "cloud_connect" },
      { title: "Dependencies", href: "/dashboard/cloud-connect/dependencies", icon: Network, module: "cloud_connect" },
    ],
  },
  {
    label: "Compute",
    items: [
      { title: "Instances", href: "/dashboard/compute/instances", icon: Server, module: "compute" },
      { title: "Containers", href: "/dashboard/compute/containers", icon: Container, module: "compute" },
      { title: "Kubernetes", href: "/dashboard/compute/kubernetes", icon: Layers, module: "compute" },
      { title: "Serverless", href: "/dashboard/compute/serverless", icon: Zap, module: "compute" },
      { title: "Batch", href: "/dashboard/compute/batch", icon: Cpu, module: "compute" },
      { title: "Spot Instances", href: "/dashboard/compute/spot", icon: Zap, module: "compute" },
    ],
  },
  {
    label: "Storage",
    items: [
      { title: "Object", href: "/dashboard/storage/object", icon: Box, module: "storage" },
      { title: "File", href: "/dashboard/storage/file", icon: FileText, module: "storage" },
      { title: "Block", href: "/dashboard/storage/block", icon: HardDrive, module: "storage" },
      { title: "Archive", href: "/dashboard/storage/archive", icon: Archive, module: "storage" },
      { title: "Backup", href: "/dashboard/storage/backup", icon: Upload, module: "storage" },
    ],
  },
  {
    label: "Networking",
    items: [
      { title: "VPC", href: "/dashboard/networking/vpc", icon: Network, module: "networking" },
      { title: "Elastic IPs", href: "/dashboard/networking/elastic-ips", icon: Globe, module: "networking" },
      { title: "NAT Gateways", href: "/dashboard/networking/nat-gateways", icon: Unplug, module: "networking" },
      { title: "Internet Gateways", href: "/dashboard/networking/internet-gateways", icon: Globe, module: "networking" },
      { title: "Route Tables", href: "/dashboard/networking/route-tables", icon: Route, module: "networking" },
      { title: "Security Groups", href: "/dashboard/networking/security-groups", icon: Shield, module: "networking" },
      { title: "VPC Peering", href: "/dashboard/networking/vpc-peering", icon: Link2, module: "networking" },
      { title: "Load Balancers", href: "/dashboard/networking/load-balancers", icon: Route, module: "networking" },
      { title: "DNS", href: "/dashboard/networking/dns", icon: Globe, module: "networking" },
      { title: "CDN", href: "/dashboard/networking/cdn", icon: Radio, module: "networking" },
      { title: "Firewall", href: "/dashboard/networking/firewall", icon: Shield, module: "networking" },
      { title: "VPN", href: "/dashboard/networking/vpn", icon: Wifi, module: "networking" },
      { title: "Transit Gateway", href: "/dashboard/networking/transit-gateway", icon: Layers, module: "networking" },
      { title: "Direct Connect", href: "/dashboard/networking/direct-connect", icon: Zap, module: "networking" },
      { title: "Endpoints", href: "/dashboard/networking/endpoints", icon: Link2, module: "networking" },
      { title: "Flow Logs", href: "/dashboard/networking/flow-logs", icon: FileText, module: "networking" },
      { title: "Network Map", href: "/dashboard/networking/network-map", icon: Map, module: "networking" },
    ],
  },
  {
    label: "Messaging",
    items: [
      { title: "Overview", href: "/dashboard/messaging", icon: MessageSquare, module: "messaging" },
      { title: "Queues", href: "/dashboard/messaging/queues", icon: MessageSquare, module: "messaging" },
      { title: "Topics", href: "/dashboard/messaging/topics", icon: Radio, module: "messaging" },
    ],
  },
  {
    label: "Container Registries",
    items: [
      { title: "Registries", href: "/dashboard/container-registries", icon: Container, module: "container_registries" },
    ],
  },
  {
    label: "Auto Scaling",
    items: [
      { title: "Scaling Groups", href: "/dashboard/autoscaling", icon: Gauge, module: "autoscaling" },
    ],
  },
  {
    label: "Databases",
    items: [
      { title: "Relational", href: "/dashboard/databases/relational", icon: Database, module: "databases" },
      { title: "NoSQL", href: "/dashboard/databases/nosql", icon: Layers, module: "databases" },
      { title: "In-Memory", href: "/dashboard/databases/in-memory", icon: Zap, module: "databases" },
      { title: "Warehouse", href: "/dashboard/databases/warehouse", icon: HardDrive, module: "databases" },
    ],
  },
  {
    label: "AI/ML",
    items: [
      { title: "Models", href: "/dashboard/ai-ml/models", icon: Brain, module: "ai_ml" },
      { title: "Training", href: "/dashboard/ai-ml/training", icon: Activity, module: "ai_ml" },
      { title: "MLOps", href: "/dashboard/ai-ml/mlops", icon: GitBranch, module: "ai_ml" },
      { title: "AI Services", href: "/dashboard/ai-ml/ai-services", icon: Bot, module: "ai_ml" },
      { title: "GenAI", href: "/dashboard/ai-ml/genai", icon: Lightbulb, module: "ai_ml" },
    ],
  },
  {
    label: "Security",
    items: [
      { title: "IAM", href: "/dashboard/security/iam", icon: Lock, module: "security" },
      { title: "IAM Users", href: "/dashboard/security/iam/users", icon: Users, module: "security" },
      { title: "IAM Roles", href: "/dashboard/security/iam/roles", icon: Shield, module: "security" },
      { title: "IAM Policies", href: "/dashboard/security/iam/policies", icon: FileText, module: "security" },
      { title: "Secrets", href: "/dashboard/security/secrets", icon: Key, module: "security" },
      { title: "Certificates", href: "/dashboard/security/certificates", icon: Shield, module: "security" },
      { title: "Threat Detection", href: "/dashboard/security/threat-detection", icon: Eye, module: "security" },
      { title: "Audit", href: "/dashboard/security/audit", icon: FileText, module: "security" },
      { title: "Audit Trail", href: "/dashboard/security/audit-trail", icon: History, module: "security" },
      { title: "Vault", href: "/dashboard/security/vault", icon: Lock, module: "security" },
    ],
  },
  {
    label: "WAF",
    items: [
      { title: "WAF", href: "/dashboard/waf", icon: Shield, module: "waf" },
    ],
  },
  {
    label: "KMS",
    items: [
      { title: "Keys", href: "/dashboard/kms", icon: Key, module: "kms" },
    ],
  },
  {
    label: "Security Testing",
    items: [
      { title: "VAPT", href: "/dashboard/security-testing/vapt", icon: Bug, module: "security_testing" },
      { title: "Vulnerability Scanner", href: "/dashboard/security-testing/vulnerability-scanner", icon: Search, module: "security_testing" },
      { title: "DDoS Testing", href: "/dashboard/security-testing/ddos-testing", icon: FlaskConical, module: "security_testing" },
      { title: "Pen Testing", href: "/dashboard/security-testing/pen-testing", icon: Shield, module: "security_testing" },
      { title: "Compliance", href: "/dashboard/security-testing/compliance", icon: FileText, module: "security_testing" },
      { title: "Compliance Code", href: "/dashboard/security-testing/compliance-code", icon: FileCode, module: "security_testing" },
      { title: "Posture", href: "/dashboard/security-testing/posture", icon: Gauge, module: "security_testing" },
      { title: "Chaos Engineering", href: "/dashboard/security-testing/chaos", icon: Flame, module: "security_testing" },
      { title: "Remediation", href: "/dashboard/security-testing/remediation", icon: Wrench, module: "security_testing" },
      { title: "Container Scan", href: "/dashboard/security-testing/container-scan", icon: Container, module: "security_testing" },
      { title: "Reports", href: "/dashboard/security-testing/reports", icon: FileText, module: "security_testing" },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { title: "Dashboards", href: "/dashboard/monitoring/dashboards", icon: MonitorSpeaker, module: "monitoring" },
      { title: "Metrics", href: "/dashboard/monitoring/metrics", icon: Activity, module: "monitoring" },
      { title: "Logs", href: "/dashboard/monitoring/logs", icon: FileText, module: "monitoring" },
      { title: "Alerts", href: "/dashboard/monitoring/alerts", icon: Bell, module: "monitoring" },
      { title: "Tracing", href: "/dashboard/monitoring/tracing", icon: Route, module: "monitoring" },
      { title: "Uptime", href: "/dashboard/monitoring/uptime", icon: Gauge, module: "monitoring" },
      { title: "Incidents", href: "/dashboard/monitoring/incidents", icon: Siren, module: "monitoring" },
      { title: "SLA", href: "/dashboard/monitoring/sla", icon: Gauge, module: "monitoring" },
    ],
  },
  {
    label: "DevOps",
    items: [
      { title: "Pipelines", href: "/dashboard/devops/pipelines", icon: Workflow, module: "devops" },
      { title: "IaC", href: "/dashboard/devops/iac", icon: FileText, module: "devops" },
      { title: "GitOps", href: "/dashboard/devops/gitops", icon: GitBranch, module: "devops" },
      { title: "Deployment", href: "/dashboard/devops/deployment", icon: Upload, module: "devops" },
      { title: "Config", href: "/dashboard/devops/config", icon: Settings, module: "devops" },
      { title: "Approvals", href: "/dashboard/devops/approvals", icon: CheckSquare, module: "devops" },
      { title: "Change Management", href: "/dashboard/devops/change-management", icon: Calendar, module: "devops" },
      { title: "Runbooks", href: "/dashboard/devops/runbooks", icon: BookOpen, module: "devops" },
    ],
  },
  {
    label: "Data Engineering",
    items: [
      { title: "ETL", href: "/dashboard/data-engineering/etl", icon: Workflow, module: "data_engineering" },
      { title: "Streaming", href: "/dashboard/data-engineering/streaming", icon: Radio, module: "data_engineering" },
      { title: "Data Lake", href: "/dashboard/data-engineering/data-lake", icon: Database, module: "data_engineering" },
      { title: "Integration", href: "/dashboard/data-engineering/integration", icon: Layers, module: "data_engineering" },
    ],
  },
  {
    label: "Cost Management",
    items: [
      { title: "Overview", href: "/dashboard/cost/overview", icon: DollarSign, module: "cost" },
      { title: "Explorer", href: "/dashboard/cost/explorer", icon: Search, module: "cost" },
      { title: "Budgets", href: "/dashboard/cost/budgets", icon: CreditCard, module: "cost" },
      { title: "Recommendations", href: "/dashboard/cost/recommendations", icon: Lightbulb, module: "cost" },
      { title: "Reservations", href: "/dashboard/cost/reservations", icon: BookOpen, module: "cost" },
      { title: "Anomalies", href: "/dashboard/cost/anomalies", icon: AlertTriangle, module: "cost" },
      { title: "FinOps", href: "/dashboard/cost/finops", icon: PieChart, module: "cost" },
      { title: "Allocation", href: "/dashboard/cost/allocation", icon: PieChart, module: "cost" },
    ],
  },
  {
    label: "IoT",
    items: [
      { title: "Devices", href: "/dashboard/iot/devices", icon: Cpu, module: "iot" },
      { title: "Digital Twins", href: "/dashboard/iot/digital-twins", icon: Cloud, module: "iot" },
      { title: "Rules", href: "/dashboard/iot/rules", icon: Settings, module: "iot" },
      { title: "Edge", href: "/dashboard/iot/edge", icon: Server, module: "iot" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { title: "Query Engines", href: "/dashboard/analytics/query-engines", icon: Database, module: "analytics" },
      { title: "Visualization", href: "/dashboard/analytics/visualization", icon: BarChart3, module: "analytics" },
      { title: "Search", href: "/dashboard/analytics/search", icon: Search, module: "analytics" },
      { title: "Reports", href: "/dashboard/analytics/reports", icon: FileText, module: "analytics" },
    ],
  },
  {
    label: "AI Assistant",
    items: [
      { title: "Terminal", href: "/dashboard/terminal", icon: Terminal, module: "ai_assistant" },
      { title: "AI Terminal", href: "/dashboard/ai/terminal", icon: Terminal, module: "ai_assistant" },
      { title: "Chat", href: "/dashboard/ai/chat", icon: MessageSquare, module: "ai_assistant" },
      { title: "Suggestions", href: "/dashboard/ai/suggestions", icon: Lightbulb, module: "ai_assistant" },
      { title: "Query", href: "/dashboard/ai/query", icon: Search, module: "ai_assistant" },
    ],
  },
  {
    label: "Learn",
    items: [
      { title: "Paths", href: "/dashboard/learn/paths", icon: GraduationCap, module: "tutorials" },
      { title: "Tutorials", href: "/dashboard/learn/tutorials", icon: BookOpen, module: "tutorials" },
      { title: "Sandbox", href: "/dashboard/learn/sandbox", icon: FlaskConical, module: "tutorials" },
      { title: "Progress", href: "/dashboard/learn/progress", icon: BarChart3, module: "tutorials" },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Profile", href: "/dashboard/settings/profile", icon: Users },
      { title: "Organization", href: "/dashboard/settings/organization", icon: Globe },
      { title: "Cloud Accounts", href: "/dashboard/settings/cloud-accounts", icon: Cloud },
      { title: "API Keys", href: "/dashboard/settings/api-keys", icon: Key },
      { title: "Notifications", href: "/dashboard/settings/notifications", icon: Bell },
      { title: "Security", href: "/dashboard/settings/security", icon: Shield },
      { title: "Webhooks", href: "/dashboard/settings/webhooks", icon: Link2 },
      { title: "Integrations", href: "/dashboard/settings/integrations", icon: Plug },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { can, role } = usePermissions()

  const filteredNavigation = navigation
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.module) return true
        return can("read", item.module)
      }),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Cloud className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold group-data-[collapsible=icon]:hidden">
            Cloud Manager
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {filteredNavigation.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

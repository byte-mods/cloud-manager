"use client"

import { useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  Cloud,
  Cpu,
  Database,
  FileCode2,
  Globe,
  HardDrive,
  LayoutDashboard,
  LineChart,
  Lock,
  Moon,
  Network,
  Plus,
  Rocket,
  Search,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  Sun,
  Activity,
  Brain,
  BookOpen,
  BarChart3,
  Wifi,
  type LucideIcon,
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useUIStore } from "@/stores/ui-store"
import { useCloudContextStore } from "@/stores/cloud-context-store"
import { useCloudConnectStore } from "@/stores/cloud-connect-store"
import { useRecentPagesStore } from "@/stores/recent-pages-store"

// ---- Data ----

type PageItem = {
  href: string
  title: string
  icon: LucideIcon
  description: string
  shortcut?: string
}

const pages: PageItem[] = [
  { href: "/dashboard", title: "Dashboard", icon: LayoutDashboard, description: "Overview dashboard" },
  { href: "/dashboard/compute", title: "Compute", icon: Cpu, description: "EC2, VMs, instances", shortcut: "G C" },
  { href: "/dashboard/storage", title: "Storage", icon: HardDrive, description: "S3, Blobs, GCS buckets" },
  { href: "/dashboard/networking", title: "Networking", icon: Network, description: "VPCs, subnets, firewalls" },
  { href: "/dashboard/databases", title: "Databases", icon: Database, description: "RDS, Cloud SQL, Cosmos DB" },
  { href: "/dashboard/ai-ml", title: "AI / ML", icon: Brain, description: "Machine learning services" },
  { href: "/dashboard/security", title: "Security", icon: Lock, description: "IAM, policies, encryption" },
  { href: "/dashboard/security-testing", title: "Security Testing", icon: ShieldAlert, description: "Vulnerability scans, pen tests" },
  { href: "/dashboard/monitoring", title: "Monitoring", icon: Activity, description: "Metrics, logs, alerts" },
  { href: "/dashboard/devops", title: "DevOps", icon: Rocket, description: "CI/CD, pipelines, deployments" },
  { href: "/dashboard/data-engineering", title: "Data Engineering", icon: FileCode2, description: "ETL, data pipelines" },
  { href: "/dashboard/cost", title: "Cost Management", icon: LineChart, description: "Budgets, cost analysis", shortcut: "G $" },
  { href: "/dashboard/iot", title: "IoT", icon: Wifi, description: "IoT Hub, device management" },
  { href: "/dashboard/analytics", title: "Analytics", icon: BarChart3, description: "Business analytics" },
  { href: "/dashboard/ai", title: "AI Services", icon: Brain, description: "AI-powered features" },
  { href: "/dashboard/learn", title: "Learn", icon: BookOpen, description: "Tutorials and documentation" },
  { href: "/dashboard/settings", title: "Settings", icon: Settings, description: "Account and preferences", shortcut: "G S" },
  { href: "/dashboard/infrastructure", title: "Infrastructure", icon: Server, description: "IaC projects, designer" },
  { href: "/dashboard/cloud-connect", title: "Cloud Connect", icon: Globe, description: "Multi-cloud connectivity" },
]

type QuickAction = {
  id: string
  title: string
  description: string
  icon: LucideIcon
  action: "navigate"
  href: string
  shortcut?: string
}

const quickActions: QuickAction[] = [
  { id: "create-instance", title: "Create Instance", description: "Launch a new compute instance", icon: Plus, action: "navigate", href: "/dashboard/compute", shortcut: "N I" },
  { id: "create-bucket", title: "Create Bucket", description: "Create a new storage bucket", icon: Plus, action: "navigate", href: "/dashboard/storage" },
  { id: "create-vpc", title: "Create VPC", description: "Create a new virtual private cloud", icon: Plus, action: "navigate", href: "/dashboard/networking" },
  { id: "create-database", title: "Create Database", description: "Provision a new database", icon: Plus, action: "navigate", href: "/dashboard/databases" },
  { id: "new-infra-project", title: "New Infrastructure Project", description: "Start a new IaC project", icon: FileCode2, action: "navigate", href: "/dashboard/infrastructure" },
  { id: "run-security-scan", title: "Run Security Scan", description: "Start a security assessment", icon: Shield, action: "navigate", href: "/dashboard/security-testing" },
  { id: "view-cost-overview", title: "View Cost Overview", description: "Check spending and budgets", icon: LineChart, action: "navigate", href: "/dashboard/cost" },
]

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard, Cpu, HardDrive, Network, Database, Brain, Lock, ShieldAlert,
  Activity, Rocket, FileCode2, LineChart, Wifi, BarChart3, BookOpen, Settings,
  Server, Globe, Search,
}

function getIconComponent(name: string): LucideIcon {
  return iconMap[name] || Search
}

// ---- Component ----

export function CommandPalette() {
  const router = useRouter()
  const { setTheme } = useTheme()
  const { commandPaletteOpen, toggleCommandPalette } = useUIStore()
  const setProvider = useCloudContextStore((s) => s.setProvider)
  const services = useCloudConnectStore((s) => s.services)
  const { recentPages, addRecentPage } = useRecentPagesStore()

  const setOpen = useCallback(
    (open: boolean) => {
      if (open !== commandPaletteOpen) toggleCommandPalette()
    },
    [commandPaletteOpen, toggleCommandPalette],
  )

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggleCommandPalette()
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [toggleCommandPalette])

  const navigateTo = useCallback(
    (page: { href: string; title: string; iconName?: string }) => {
      addRecentPage({ href: page.href, title: page.title, icon: page.iconName ?? "Search" })
      router.push(page.href)
      setOpen(false)
    },
    [router, addRecentPage, setOpen],
  )

  const runAction = useCallback(
    (action: QuickAction) => {
      router.push(action.href)
      setOpen(false)
    },
    [router, setOpen],
  )

  return (
    <CommandDialog open={commandPaletteOpen} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, resources, actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Recently Visited */}
        {recentPages.length > 0 && (
          <>
            <CommandGroup heading="Recently Visited">
              {recentPages.map((page) => {
                const Icon = getIconComponent(page.icon)
                return (
                  <CommandItem
                    key={`recent-${page.href}`}
                    value={`recent ${page.title}`}
                    onSelect={() => navigateTo({ href: page.href, title: page.title, iconName: page.icon })}
                  >
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{page.title}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Pages */}
        <CommandGroup heading="Pages">
          {pages.map((page) => (
            <CommandItem
              key={page.href}
              value={`page ${page.title} ${page.description}`}
              onSelect={() => navigateTo({ href: page.href, title: page.title, iconName: page.icon.displayName ?? "Search" })}
            >
              <page.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span>{page.title}</span>
                <span className="text-xs text-muted-foreground">{page.description}</span>
              </div>
              {page.shortcut && <CommandShortcut>{page.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Quick Actions */}
        <CommandGroup heading="Quick Actions">
          {quickActions.map((action) => (
            <CommandItem
              key={action.id}
              value={`action ${action.title} ${action.description}`}
              onSelect={() => runAction(action)}
            >
              <action.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span>{action.title}</span>
                <span className="text-xs text-muted-foreground">{action.description}</span>
              </div>
              {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Resources (cloud-connect services) */}
        <CommandGroup heading="Resources">
          {services.slice(0, 20).map((svc) => (
            <CommandItem
              key={svc.id}
              value={`resource ${svc.resourceName} ${svc.serviceName} ${svc.type} ${svc.provider}`}
              onSelect={() => navigateTo({ href: `/dashboard/cloud-connect`, title: svc.resourceName, iconName: "Globe" })}
            >
              <Server className="mr-2 h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span>{svc.resourceName}</span>
                <span className="text-xs text-muted-foreground">
                  {svc.serviceName} &middot; {svc.provider.toUpperCase()} &middot; {svc.region}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Cloud Providers */}
        <CommandGroup heading="Cloud Providers">
          <CommandItem
            value="provider aws amazon"
            onSelect={() => {
              setProvider("aws")
              setOpen(false)
            }}
          >
            <Cloud className="mr-2 h-4 w-4 text-orange-500" />
            <span>Switch to AWS</span>
          </CommandItem>
          <CommandItem
            value="provider gcp google"
            onSelect={() => {
              setProvider("gcp")
              setOpen(false)
            }}
          >
            <Cloud className="mr-2 h-4 w-4 text-blue-500" />
            <span>Switch to GCP</span>
          </CommandItem>
          <CommandItem
            value="provider azure microsoft"
            onSelect={() => {
              setProvider("azure")
              setOpen(false)
            }}
          >
            <Cloud className="mr-2 h-4 w-4 text-sky-500" />
            <span>Switch to Azure</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Theme */}
        <CommandGroup heading="Theme">
          <CommandItem
            value="theme light mode"
            onSelect={() => {
              setTheme("light")
              setOpen(false)
            }}
          >
            <Sun className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Light Mode</span>
          </CommandItem>
          <CommandItem
            value="theme dark mode"
            onSelect={() => {
              setTheme("dark")
              setOpen(false)
            }}
          >
            <Moon className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Dark Mode</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

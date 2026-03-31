"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Search,
  Server,
  Database,
  HardDrive,
  Network,
  Shield,
  Zap,
  Container,
  Radio,
  Globe,
  Cloud,
  Layers,
  LayoutGrid,
  LayoutList,
  ArrowUpDown,
  Download,
  AlertTriangle,
  ChevronRight,
  Play,
  Square,
  Trash2,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useCloudConnectStore,
  type DiscoveredService,
  type CloudProvider,
  type ServiceType,
} from "@/stores/cloud-connect-store"
import { useCloudServices } from "@/hooks/use-cloud-connect"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const providerMeta: Record<CloudProvider, { label: string; color: string; bg: string }> = {
  aws: { label: "AWS", color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/30" },
  gcp: { label: "GCP", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" },
  azure: { label: "Azure", color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/30" },
}

const typeIcons: Record<ServiceType, typeof Server> = {
  compute: Server,
  storage: HardDrive,
  database: Database,
  networking: Network,
  serverless: Zap,
  container: Container,
  cache: Layers,
  queue: Radio,
  cdn: Globe,
  dns: Globe,
  loadbalancer: Network,
  monitoring: Cloud,
  security: Shield,
  ml: Cloud,
}

const statusColors: Record<string, string> = {
  running: "bg-green-500/10 text-green-700 border-green-200",
  stopped: "bg-gray-500/10 text-gray-600 border-gray-200",
  warning: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  error: "bg-red-500/10 text-red-700 border-red-200",
  creating: "bg-blue-500/10 text-blue-600 border-blue-200",
  deleting: "bg-red-500/10 text-red-400 border-red-200",
}

function formatCost(v: number) {
  return v === 0 ? "$0" : `$${v.toLocaleString()}`
}

function formatBytes(b: number) {
  if (b === 0) return "0 B/s"
  if (b < 1024) return `${b} B/s`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB/s`
  return `${(b / (1024 * 1024)).toFixed(1)} MB/s`
}

const typeTabs = [
  { value: "all", label: "All" },
  { value: "compute", label: "Compute" },
  { value: "storage", label: "Storage" },
  { value: "database", label: "Database" },
  { value: "networking", label: "Networking" },
  { value: "security", label: "Security" },
  { value: "other", label: "Other" },
]

const otherTypes: ServiceType[] = ["serverless", "container", "cache", "queue", "cdn", "dns", "loadbalancer", "monitoring", "ml"]

type SortKey = "name" | "cost" | "traffic" | "issues"

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ServicesPage() {
  const { services } = useCloudConnectStore()
  const { data: servicesData } = useCloudServices()
  const [search, setSearch] = useState("")
  const [typeTab, setTypeTab] = useState("all")
  const [providerFilter, setProviderFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState<SortKey>("name")
  const [viewMode, setViewMode] = useState<"grid" | "table">("table")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    let result = services

    // Search
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.resourceName.toLowerCase().includes(q) ||
          s.serviceName.toLowerCase().includes(q) ||
          s.region.toLowerCase().includes(q),
      )
    }

    // Type tab
    if (typeTab !== "all") {
      if (typeTab === "other") {
        result = result.filter((s) => otherTypes.includes(s.type))
      } else {
        result = result.filter((s) => s.type === typeTab)
      }
    }

    // Provider
    if (providerFilter !== "all") result = result.filter((s) => s.provider === providerFilter)

    // Status
    if (statusFilter !== "all") result = result.filter((s) => s.status === statusFilter)

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "cost":
          return b.monthlyCost - a.monthlyCost
        case "traffic":
          return b.trafficIn + b.trafficOut - (a.trafficIn + a.trafficOut)
        case "issues":
          return b.securityIssues.length - a.securityIssues.length
        default:
          return a.resourceName.localeCompare(b.resourceName)
      }
    })

    return result
  }, [services, search, typeTab, providerFilter, statusFilter, sortBy])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((s) => s.id)))
    }
  }

  function exportCSV() {
    const header = "Name,Service,Provider,Region,Status,Cost,Traffic In,Traffic Out,Security Issues\n"
    const rows = filtered
      .map(
        (s) =>
          `${s.resourceName},${s.serviceName},${s.provider},${s.region},${s.status},${s.monthlyCost},${s.trafficIn},${s.trafficOut},${s.securityIssues.length}`,
      )
      .join("\n")
    const blob = new Blob([header + rows], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "cloud-services.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Discovered Services</h1>
          <p className="text-muted-foreground mt-1">
            {services.length} services discovered across all connected cloud accounts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <Badge variant="secondary">{selected.size} selected</Badge>
              <Button variant="outline" size="sm">
                <Play className="mr-1 h-3 w-3" /> Start
              </Button>
              <Button variant="outline" size="sm">
                <Square className="mr-1 h-3 w-3" /> Stop
              </Button>
              <Button variant="outline" size="sm" className="text-destructive">
                <Trash2 className="mr-1 h-3 w-3" /> Delete
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-1 h-3 w-3" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Providers</SelectItem>
            <SelectItem value="aws">AWS</SelectItem>
            <SelectItem value="gcp">GCP</SelectItem>
            <SelectItem value="azure">Azure</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="stopped">Stopped</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-[130px]">
            <ArrowUpDown className="mr-1 h-3 w-3" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="cost">Cost</SelectItem>
            <SelectItem value="traffic">Traffic</SelectItem>
            <SelectItem value="issues">Security Issues</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center border rounded-lg overflow-hidden">
          <Button
            variant={viewMode === "table" ? "default" : "ghost"}
            size="sm"
            className="rounded-none h-9"
            onClick={() => setViewMode("table")}
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            className="rounded-none h-9"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Type Tabs */}
      <Tabs value={typeTab} onValueChange={setTypeTab}>
        <TabsList>
          {typeTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Results */}
      <div className="text-sm text-muted-foreground">
        Showing {filtered.length} of {services.length} services
      </div>

      {viewMode === "table" ? (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="p-3 text-left">Service</th>
                <th className="p-3 text-left">Provider</th>
                <th className="p-3 text-left">Region</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Cost/mo</th>
                <th className="p-3 text-right">Traffic</th>
                <th className="p-3 text-center">Security</th>
                <th className="p-3 text-right w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((svc) => {
                const Icon = typeIcons[svc.type] || Cloud
                const meta = providerMeta[svc.provider]
                const critHigh = svc.securityIssues.filter(
                  (i) => i.severity === "critical" || i.severity === "high",
                ).length

                return (
                  <tr key={svc.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.has(svc.id)}
                        onChange={() => toggleSelect(svc.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <div className="font-medium">{svc.resourceName}</div>
                          <div className="text-xs text-muted-foreground">{svc.serviceName} / {svc.type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={meta.color}>
                        {meta.label}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{svc.region}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={statusColors[svc.status]}>
                        {svc.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right font-medium">{formatCost(svc.monthlyCost)}</td>
                    <td className="p-3 text-right text-xs text-muted-foreground">
                      <div>↓ {formatBytes(svc.trafficIn)}</div>
                      <div>↑ {formatBytes(svc.trafficOut)}</div>
                    </td>
                    <td className="p-3 text-center">
                      {svc.securityIssues.length === 0 ? (
                        <span className="text-green-600 text-xs">Clean</span>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          {critHigh > 0 && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              {critHigh}
                            </Badge>
                          )}
                          {svc.securityIssues.length - critHigh > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-600">
                              {svc.securityIssues.length - critHigh}
                            </Badge>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <Link href={`/dashboard/cloud-connect/services/${svc.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((svc) => {
            const Icon = typeIcons[svc.type] || Cloud
            const meta = providerMeta[svc.provider]

            return (
              <Link key={svc.id} href={`/dashboard/cloud-connect/services/${svc.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.bg}`}>
                          <Icon className={`h-4 w-4 ${meta.color}`} />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{svc.resourceName}</div>
                          <div className="text-xs text-muted-foreground">{svc.serviceName}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className={statusColors[svc.status]}>
                        {svc.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{meta.label} / {svc.region}</span>
                      <span className="font-medium text-foreground">{formatCost(svc.monthlyCost)}/mo</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        ↓{formatBytes(svc.trafficIn)} / ↑{formatBytes(svc.trafficOut)}
                      </span>
                      {svc.securityIssues.length > 0 && (
                        <div className="flex items-center gap-1 text-yellow-600">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{svc.securityIssues.length} issue{svc.securityIssues.length !== 1 ? "s" : ""}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

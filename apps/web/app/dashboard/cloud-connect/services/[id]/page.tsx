"use client"

import { useCloudServices } from "@/hooks/use-cloud-connect"
import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
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
  DollarSign,
  Activity,
  AlertTriangle,
  CheckCircle,
  Play,
  Square,
  RotateCw,
  Trash2,
  Copy,
  Settings,
  Link2,
  Tag,
  Code,
  TrendingUp,
  TrendingDown,
  Clock,
  MapPin,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts"
import {
  useCloudConnectStore,
  type DiscoveredService,
  type CloudProvider,
  type ServiceType,
  type TrafficMetric,
} from "@/stores/cloud-connect-store"

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

const severityColors: Record<string, string> = {
  critical: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-blue-500 text-white",
  info: "bg-gray-500 text-white",
}

function formatCost(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v)
}

function formatBytes(b: number) {
  if (b === 0) return "0 B/s"
  if (b < 1024) return `${b} B/s`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB/s`
  return `${(b / (1024 * 1024)).toFixed(1)} MB/s`
}

/** Generate 24h of historical traffic data (96 points, one per 15min) */
function generateHistoricalTraffic(baseIn: number, baseOut: number): TrafficMetric[] {
  const data: TrafficMetric[] = []
  const now = Date.now()
  for (let i = 95; i >= 0; i--) {
    const ts = new Date(now - i * 15 * 60 * 1000)
    const hour = ts.getHours()
    // Simulate higher traffic during business hours 8-18
    const hourFactor = hour >= 8 && hour <= 18 ? 1.0 + 0.3 * Math.sin(((hour - 8) / 10) * Math.PI) : 0.4 + Math.random() * 0.2
    const noise = () => 0.8 + Math.random() * 0.4
    data.push({
      timestamp: ts.toISOString(),
      inbound: Math.round(baseIn * hourFactor * noise()),
      outbound: Math.round(baseOut * hourFactor * noise()),
      requests: Math.round((baseIn + baseOut) * hourFactor * noise() * 0.01),
      errors: Math.round(Math.random() * 5),
      latency: Math.round(15 + Math.random() * 80),
    })
  }
  return data
}

/** Generate 6 months of cost data */
function generateCostHistory(currentCost: number) {
  const months = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
  return months.map((m, i) => ({
    month: m,
    cost: Math.round(currentCost * (0.75 + i * 0.05 + Math.random() * 0.1)),
  }))
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ServiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: servicesData } = useCloudServices()
  const { services, getServiceById, updateServiceTraffic } = useCloudConnectStore()
  const svc = getServiceById(id)

  const [activeTab, setActiveTab] = useState("overview")
  const [showRawConfig, setShowRawConfig] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [liveTraffic, setLiveTraffic] = useState<TrafficMetric[]>([])

  const historicalTraffic = useMemo(
    () => (svc ? generateHistoricalTraffic(svc.trafficIn, svc.trafficOut) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  )

  const costHistory = useMemo(() => (svc ? generateCostHistory(svc.monthlyCost) : []), [svc?.monthlyCost, id])

  // Connected services
  const connectedServices = useMemo(() => {
    if (!svc) return []
    return svc.connections
      .map((cid) => services.find((s) => s.id === cid))
      .filter(Boolean) as DiscoveredService[]
  }, [svc, services])

  // Simulated live traffic
  useEffect(() => {
    if (!svc) return
    const interval = setInterval(() => {
      updateServiceTraffic()
      const current = useCloudConnectStore.getState().getServiceById(id)
      if (!current) return
      setLiveTraffic((prev) => {
        const point: TrafficMetric = {
          timestamp: new Date().toISOString(),
          inbound: current.trafficIn,
          outbound: current.trafficOut,
          requests: Math.round((current.trafficIn + current.trafficOut) * 0.01),
          errors: Math.round(Math.random() * 3),
          latency: Math.round(15 + Math.random() * 80),
        }
        const next = [...prev, point]
        return next.length > 30 ? next.slice(-30) : next
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [id, svc, updateServiceTraffic])

  if (!svc) {
    return (
      <div className="p-6">
        <div className="text-center py-20">
          <h2 className="text-xl font-semibold">Service not found</h2>
          <p className="text-muted-foreground mt-2">The service with ID &quot;{id}&quot; could not be found.</p>
          <Button className="mt-4" asChild>
            <Link href="/dashboard/cloud-connect/services">Back to Services</Link>
          </Button>
        </div>
      </div>
    )
  }

  const Icon = typeIcons[svc.type] || Cloud
  const meta = providerMeta[svc.provider]
  const isCompute = ["compute", "container", "serverless"].includes(svc.type)
  const isStorage = svc.type === "storage"

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${meta.bg}`}>
            <Icon className={`h-5 w-5 ${meta.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{svc.resourceName}</h1>
              <Badge variant="outline" className={statusColors[svc.status]}>
                {svc.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
              <span>{svc.serviceName}</span>
              <span>|</span>
              <MapPin className="h-3 w-3" />
              <span>{svc.region}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isCompute && svc.status === "running" && (
            <>
              <Button variant="outline" size="sm">
                <Square className="mr-1 h-3 w-3" /> Stop
              </Button>
              <Button variant="outline" size="sm">
                <RotateCw className="mr-1 h-3 w-3" /> Restart
              </Button>
            </>
          )}
          {isCompute && svc.status === "stopped" && (
            <Button variant="outline" size="sm">
              <Play className="mr-1 h-3 w-3" /> Start
            </Button>
          )}
          <Button variant="outline" size="sm">
            <Copy className="mr-1 h-3 w-3" /> Snapshot
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="mr-1 h-3 w-3" /> Configure
          </Button>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="mr-1 h-3 w-3" /> Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Service</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete <strong>{svc.resourceName}</strong>? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={() => { setDeleteOpen(false); router.push("/dashboard/cloud-connect/services") }}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="traffic">Traffic</TabsTrigger>
          <TabsTrigger value="cost">Cost</TabsTrigger>
        </TabsList>

        {/* ====================== OVERVIEW ====================== */}
        <TabsContent value="overview" className="space-y-6">
          {/* Metric cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCost(svc.monthlyCost)}</div>
              </CardContent>
            </Card>
            {isCompute && (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">vCPUs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{svc.config.vCPUs || svc.config.vCores || "-"}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Memory</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{svc.config.memoryGb || svc.config.memorySizeGb || "-"} GB</div>
                  </CardContent>
                </Card>
              </>
            )}
            {isStorage && (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{svc.config.sizeGb ? `${svc.config.sizeGb} GB` : "-"}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Objects</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {svc.config.objectCount ? svc.config.objectCount.toLocaleString() : "-"}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Request Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round((svc.trafficIn + svc.trafficOut) * 0.01)}/s
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Traffic chart */}
          <Card>
            <CardHeader>
              <CardTitle>Traffic (Last 24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historicalTraffic}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      tick={{ fontSize: 11 }}
                      interval={11}
                    />
                    <YAxis tickFormatter={(v) => formatBytes(v)} tick={{ fontSize: 11 }} />
                    <Tooltip
                      labelFormatter={(v) => new Date(v as string).toLocaleString()}
                      formatter={(v: number, name: string) => [formatBytes(v), name]}
                    />
                    <Area type="monotone" dataKey="inbound" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} strokeWidth={2} />
                    <Area type="monotone" dataKey="outbound" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Connected Services */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Connected Services ({connectedServices.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {connectedServices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No connected services.</p>
              ) : (
                <div className="space-y-2">
                  {connectedServices.map((cs) => {
                    const CsIcon = typeIcons[cs.type] || Cloud
                    const csMeta = providerMeta[cs.provider]
                    return (
                      <Link
                        key={cs.id}
                        href={`/dashboard/cloud-connect/services/${cs.id}`}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <CsIcon className={`h-4 w-4 ${csMeta.color}`} />
                          <div>
                            <div className="text-sm font-medium">{cs.resourceName}</div>
                            <div className="text-xs text-muted-foreground">{cs.serviceName} ({csMeta.label})</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={statusColors[cs.status]}>{cs.status}</Badge>
                          <span className="text-xs text-muted-foreground">
                            ↓{formatBytes(cs.trafficIn)} ↑{formatBytes(cs.trafficOut)}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====================== CONFIGURATION ====================== */}
        <TabsContent value="configuration" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Configuration Properties</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowRawConfig(!showRawConfig)}>
                <Code className="mr-1 h-3 w-3" /> {showRawConfig ? "Table View" : "Raw JSON"}
              </Button>
            </CardHeader>
            <CardContent>
              {showRawConfig ? (
                <pre className="rounded-lg bg-muted p-4 text-sm overflow-auto max-h-[400px] font-mono">
                  {JSON.stringify(svc.config, null, 2)}
                </pre>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-left font-medium">Property</th>
                        <th className="p-3 text-left font-medium">Value</th>
                        <th className="p-3 text-right w-20" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {Object.entries(svc.config).map(([key, value]) => (
                        <tr key={key}>
                          <td className="p-3 font-mono text-muted-foreground">{key}</td>
                          <td className="p-3">
                            {typeof value === "object" ? JSON.stringify(value) : String(value)}
                          </td>
                          <td className="p-3 text-right">
                            <Button variant="ghost" size="sm" className="h-7 text-xs">Edit</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(svc.tags).map(([k, v]) => (
                  <Badge key={k} variant="secondary">
                    {k}: {v}
                  </Badge>
                ))}
                <Button variant="outline" size="sm" className="h-6 text-xs">
                  + Add Tag
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====================== SECURITY ====================== */}
        <TabsContent value="security" className="space-y-6">
          {/* Score */}
          <Card>
            <CardHeader>
              <CardTitle>Security Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className={`text-4xl font-bold ${svc.securityIssues.length === 0 ? "text-green-500" : svc.securityIssues.some((i) => i.severity === "critical") ? "text-red-500" : "text-yellow-500"}`}>
                    {svc.securityIssues.length === 0 ? "A+" : svc.securityIssues.some((i) => i.severity === "critical") ? "D" : svc.securityIssues.some((i) => i.severity === "high") ? "C" : "B"}
                  </div>
                  <div className="text-sm text-muted-foreground">Grade</div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{svc.securityIssues.length} issue{svc.securityIssues.length !== 1 ? "s" : ""} found</span>
                    <span className={svc.securityIssues.length === 0 ? "text-green-600" : "text-yellow-600"}>
                      {svc.securityIssues.length === 0 ? "All clear" : "Attention needed"}
                    </span>
                  </div>
                  <Progress value={svc.securityIssues.length === 0 ? 100 : Math.max(20, 100 - svc.securityIssues.length * 25)} className="h-3" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Issues */}
          {svc.securityIssues.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Issues</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {svc.securityIssues.map((issue) => (
                  <div key={issue.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={severityColors[issue.severity]}>{issue.severity}</Badge>
                        <span className="font-medium">{issue.title}</span>
                      </div>
                      <Button size="sm">Fix</Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{issue.description}</p>
                    <div className="text-sm">
                      <span className="font-medium">Remediation: </span>
                      <span className="text-muted-foreground">{issue.remediation}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold">No Security Issues</h3>
                <p className="text-sm text-muted-foreground">This service has passed all security checks.</p>
              </CardContent>
            </Card>
          )}

          {/* Storage-specific: Bucket security */}
          {isStorage && (
            <Card>
              <CardHeader>
                <CardTitle>Storage Security Audit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Public Access", value: svc.config.publicAccess || false, good: false },
                    { label: "Encryption", value: !!svc.config.encryption, good: true },
                    { label: "Versioning", value: !!svc.config.versioning, good: true },
                    { label: "Access Logging", value: svc.config.accessLogging || false, good: true },
                  ].map((check) => (
                    <div key={check.label} className="flex items-center justify-between p-3 rounded-lg border">
                      <span className="text-sm font-medium">{check.label}</span>
                      <Badge variant={
                        check.label === "Public Access"
                          ? (check.value ? "destructive" : "default")
                          : (check.value ? "default" : "secondary")
                      }>
                        {check.label === "Public Access"
                          ? (check.value ? "Enabled (Risk)" : "Disabled")
                          : (check.value ? "Enabled" : "Disabled")}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Compute: code security */}
          {isCompute && (
            <Card>
              <CardHeader>
                <CardTitle>Runtime Security</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Exposed Ports", status: "clean", detail: "No unexpected open ports" },
                    { label: "OS Patches", status: svc.securityIssues.some((i) => i.title.includes("patch")) ? "warning" : "clean", detail: svc.securityIssues.some((i) => i.title.includes("patch")) ? "Updates available" : "Up to date" },
                    { label: "Package Vulnerabilities", status: svc.securityIssues.some((i) => i.title.includes("package") || i.title.includes("runtime")) ? "warning" : "clean", detail: svc.securityIssues.some((i) => i.title.includes("package")) ? "Low severity CVEs" : "No known CVEs" },
                  ].map((check) => (
                    <div key={check.label} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="text-sm font-medium">{check.label}</div>
                        <div className="text-xs text-muted-foreground">{check.detail}</div>
                      </div>
                      <Badge variant={check.status === "clean" ? "default" : "secondary"}>
                        {check.status === "clean" ? "Clean" : "Attention"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ====================== TRAFFIC ====================== */}
        <TabsContent value="traffic" className="space-y-6">
          {/* Live stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Inbound</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatBytes(svc.trafficIn)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Outbound</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{formatBytes(svc.trafficOut)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Requests/s</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {liveTraffic.length > 0 ? liveTraffic[liveTraffic.length - 1].requests : 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {liveTraffic.length > 0
                    ? Math.round(liveTraffic.reduce((s, t) => s + t.latency, 0) / liveTraffic.length)
                    : 0}ms
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Real-time bandwidth chart */}
          <Card>
            <CardHeader>
              <CardTitle>Real-Time Bandwidth</CardTitle>
              <CardDescription>Updates every 2 seconds</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={liveTraffic}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(v) => new Date(v).toLocaleTimeString([], { second: "2-digit", minute: "2-digit" })}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis tickFormatter={(v) => formatBytes(v)} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number, name: string) => [formatBytes(v), name]} />
                    <Line type="monotone" dataKey="inbound" stroke="#22c55e" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="outbound" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Latency distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Latency Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={liveTraffic.slice(-15)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="timestamp" tickFormatter={(v) => new Date(v).toLocaleTimeString([], { second: "2-digit", minute: "2-digit" })} tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [`${v}ms`, "Latency"]} />
                    <Bar dataKey="latency" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top connections by traffic */}
          <Card>
            <CardHeader>
              <CardTitle>Top Connections by Traffic</CardTitle>
            </CardHeader>
            <CardContent>
              {connectedServices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No connections.</p>
              ) : (
                <div className="space-y-3">
                  {[...connectedServices]
                    .sort((a, b) => b.trafficIn + b.trafficOut - (a.trafficIn + a.trafficOut))
                    .map((cs) => {
                      const csMeta = providerMeta[cs.provider]
                      const total = cs.trafficIn + cs.trafficOut
                      const maxTotal = Math.max(...connectedServices.map((c) => c.trafficIn + c.trafficOut), 1)
                      return (
                        <div key={cs.id} className="flex items-center gap-3">
                          <div className="w-40 truncate text-sm font-medium">{cs.resourceName}</div>
                          <Badge variant="outline" className={`${csMeta.color} shrink-0`}>{csMeta.label}</Badge>
                          <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${(total / maxTotal) * 100}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-24 text-right">{formatBytes(total)}</span>
                        </div>
                      )
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Region breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Geographic Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {connectedServices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No connections to analyze.</p>
                ) : (
                  (() => {
                    const regionMap: Record<string, number> = {}
                    for (const cs of connectedServices) {
                      regionMap[cs.region] = (regionMap[cs.region] || 0) + 1
                    }
                    return Object.entries(regionMap).map(([region, count]) => (
                      <div key={region} className="flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{region}</span>
                        </div>
                        <span className="text-sm font-medium">{count} service{count !== 1 ? "s" : ""}</span>
                      </div>
                    ))
                  })()
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====================== COST ====================== */}
        <TabsContent value="cost" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Current Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCost(svc.monthlyCost)}</div>
                <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                  <TrendingDown className="h-3 w-3" /> 3.2% vs last month
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">6-Month Average</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCost(Math.round(costHistory.reduce((s, c) => s + c.cost, 0) / costHistory.length))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Projected Next Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCost(Math.round(svc.monthlyCost * 1.02))}</div>
                <div className="flex items-center gap-1 text-xs text-yellow-600 mt-1">
                  <TrendingUp className="h-3 w-3" /> +2% projected
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cost chart */}
          <Card>
            <CardHeader>
              <CardTitle>Cost History (6 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costHistory}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [formatCost(v), "Cost"]} />
                    <Bar dataKey="cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Cost breakdown */}
          {isCompute && (
            <Card>
              <CardHeader>
                <CardTitle>Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Compute", pct: 65, amount: Math.round(svc.monthlyCost * 0.65) },
                    { label: "Storage (EBS)", pct: 20, amount: Math.round(svc.monthlyCost * 0.2) },
                    { label: "Network Transfer", pct: 10, amount: Math.round(svc.monthlyCost * 0.1) },
                    { label: "Other", pct: 5, amount: Math.round(svc.monthlyCost * 0.05) },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="text-sm w-32">{item.label}</span>
                      <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${item.pct}%` }} />
                      </div>
                      <span className="text-sm font-medium w-20 text-right">{formatCost(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Optimization suggestions */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Optimization Suggestions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {svc.status === "stopped" ? (
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Service is stopped</div>
                    <div className="text-xs text-muted-foreground">
                      No compute charges accruing. Consider terminating if not needed.
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {isCompute && svc.monthlyCost > 200 && (
                    <div className="flex items-start gap-3 p-3 rounded-lg border">
                      <DollarSign className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium">Consider Reserved Instances</div>
                        <div className="text-xs text-muted-foreground">
                          Switching to a 1-year reserved instance could save up to 40% (~{formatCost(Math.round(svc.monthlyCost * 0.4))}/mo).
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="shrink-0">Explore</Button>
                    </div>
                  )}
                  {isCompute && (
                    <div className="flex items-start gap-3 p-3 rounded-lg border">
                      <TrendingDown className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium">Right-size instance</div>
                        <div className="text-xs text-muted-foreground">
                          Average CPU utilization is 35%. Consider downsizing to save ~{formatCost(Math.round(svc.monthlyCost * 0.25))}/mo.
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="shrink-0">Analyze</Button>
                    </div>
                  )}
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <Clock className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Schedule off-hours</div>
                      <div className="text-xs text-muted-foreground">
                        Stop during non-business hours to save up to 60% on compute costs.
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0">Setup</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

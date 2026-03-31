"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Cloud,
  Server,
  Database,
  HardDrive,
  Shield,
  Network,
  RefreshCw,
  Plus,
  ArrowRight,
  Unplug,
  Activity,
  DollarSign,
  Globe,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Zap,
  BarChart3,
  Link2,
  ExternalLink,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { useCloudConnectStore, type CloudAccount, type CloudProvider } from "@/stores/cloud-connect-store"
import { useCloudTopology } from "@/hooks/use-cloud-connect"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const providerMeta: Record<CloudProvider, { label: string; color: string; bg: string; icon: string }> = {
  aws: { label: "AWS", color: "text-orange-500", bg: "bg-orange-500/10", icon: "☁" },
  gcp: { label: "GCP", color: "text-blue-500", bg: "bg-blue-500/10", icon: "◆" },
  azure: { label: "Azure", color: "text-purple-500", bg: "bg-purple-500/10", icon: "◇" },
}

const statusBadge: Record<CloudAccount["status"], { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  connected: { variant: "default", label: "Connected" },
  disconnected: { variant: "secondary", label: "Disconnected" },
  error: { variant: "destructive", label: "Error" },
  syncing: { variant: "outline", label: "Syncing..." },
}

function scoreColor(score: number) {
  if (score >= 90) return "text-green-500"
  if (score >= 75) return "text-yellow-500"
  if (score >= 60) return "text-orange-500"
  return "text-red-500"
}

function formatCost(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v)
}

function relativeTime(iso: string | null) {
  if (!iso) return "Never"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B/s`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB/s`
  return `${(b / (1024 * 1024)).toFixed(1)} MB/s`
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CloudConnectPage() {
  const {
    accounts,
    services,
    activities,
    addAccount,
    removeAccount,
    syncAccount,
    getCrossCloudConnections,
    getTotalCost,
    getSecuritySummary,
  } = useCloudConnectStore()
  const { data: topology } = useCloudTopology()

  const [addOpen, setAddOpen] = useState(false)
  const [newProvider, setNewProvider] = useState<CloudProvider>("aws")
  const [newName, setNewName] = useState("")
  const [newAccountId, setNewAccountId] = useState("")

  const crossCloud = getCrossCloudConnections()
  const totalCost = getTotalCost()
  const secSummary = getSecuritySummary()
  const totalIssues = secSummary.critical + secSummary.high + secSummary.medium + secSummary.low + secSummary.info
  const avgScore = accounts.length > 0 ? Math.round(accounts.reduce((s, a) => s + a.securityScore, 0) / accounts.length) : 0

  // Service distribution by type
  const typeDistribution: Record<string, number> = {}
  for (const svc of services) {
    typeDistribution[svc.type] = (typeDistribution[svc.type] || 0) + 1
  }
  const typeEntries = Object.entries(typeDistribution).sort((a, b) => b[1] - a[1])
  const maxTypeCount = Math.max(...typeEntries.map(([, c]) => c), 1)

  const typeColors: Record<string, string> = {
    compute: "bg-blue-500",
    storage: "bg-green-500",
    database: "bg-purple-500",
    networking: "bg-cyan-500",
    serverless: "bg-yellow-500",
    container: "bg-orange-500",
    cache: "bg-red-500",
    queue: "bg-pink-500",
    cdn: "bg-teal-500",
    dns: "bg-indigo-500",
    loadbalancer: "bg-emerald-500",
    security: "bg-rose-500",
    monitoring: "bg-amber-500",
    ml: "bg-violet-500",
  }

  function handleAddAccount() {
    if (!newName.trim() || !newAccountId.trim()) return
    const account: CloudAccount = {
      id: `acc-${Date.now()}`,
      provider: newProvider,
      name: newName.trim(),
      accountId: newAccountId.trim(),
      status: "connected",
      lastSynced: new Date().toISOString(),
      resourceCount: 0,
      monthlyCost: 0,
      securityScore: 100,
      regions: [],
    }
    addAccount(account)
    setNewName("")
    setNewAccountId("")
    setAddOpen(false)
  }

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cloud Connect</h1>
          <p className="text-muted-foreground mt-1">
            Manage multi-cloud accounts, discover services, and monitor traffic across providers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/cloud-connect/topology">
              <Network className="mr-2 h-4 w-4" /> Topology
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/cloud-connect/traffic">
              <Activity className="mr-2 h-4 w-4" /> Traffic
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/cloud-connect/security">
              <Shield className="mr-2 h-4 w-4" /> Security
            </Link>
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect Cloud Account</DialogTitle>
                <DialogDescription>
                  Add a new cloud provider account to discover and manage its resources.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={newProvider} onValueChange={(v) => setNewProvider(v as CloudProvider)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aws">Amazon Web Services (AWS)</SelectItem>
                      <SelectItem value="gcp">Google Cloud Platform (GCP)</SelectItem>
                      <SelectItem value="azure">Microsoft Azure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Account Name</Label>
                  <Input
                    placeholder="e.g. Production AWS"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    {newProvider === "aws"
                      ? "Account ID"
                      : newProvider === "gcp"
                        ? "Project ID"
                        : "Subscription ID"}
                  </Label>
                  <Input
                    placeholder={
                      newProvider === "aws"
                        ? "123456789012"
                        : newProvider === "gcp"
                          ? "my-project-id"
                          : "xxxxxxxx-xxxx-xxxx-xxxx"
                    }
                    value={newAccountId}
                    onChange={(e) => setNewAccountId(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddAccount} disabled={!newName.trim() || !newAccountId.trim()}>
                  Connect
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Resources</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{services.length}</div>
            <p className="text-xs text-muted-foreground">
              Across {accounts.filter((a) => a.status === "connected").length} connected accounts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(totalCost)}</div>
            <p className="text-xs text-muted-foreground">Combined across all providers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${scoreColor(avgScore)}`}>{avgScore}/100</div>
            <p className="text-xs text-muted-foreground">
              {totalIssues} issue{totalIssues !== 1 ? "s" : ""} found
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cross-Cloud Links</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{crossCloud.length}</div>
            <p className="text-xs text-muted-foreground">Services connected across providers</p>
          </CardContent>
        </Card>
      </div>

      {/* Connected Accounts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Connected Accounts</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/cloud-connect/services">
              View All Services <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {accounts.map((acc) => {
            const meta = providerMeta[acc.provider]
            const badge = statusBadge[acc.status]
            return (
              <Card key={acc.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg ${meta.bg} ${meta.color}`}>
                        {meta.icon}
                      </div>
                      <div>
                        <CardTitle className="text-base">{acc.name}</CardTitle>
                        <CardDescription className="text-xs font-mono">{acc.accountId}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold">{acc.resourceCount}</div>
                      <div className="text-xs text-muted-foreground">Resources</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{formatCost(acc.monthlyCost)}</div>
                      <div className="text-xs text-muted-foreground">Monthly</div>
                    </div>
                    <div>
                      <div className={`text-lg font-bold ${scoreColor(acc.securityScore)}`}>{acc.securityScore}</div>
                      <div className="text-xs text-muted-foreground">Security</div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Security Score</span>
                      <span>{acc.securityScore}%</span>
                    </div>
                    <Progress value={acc.securityScore} className="h-2" />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Last synced: {relativeTime(acc.lastSynced)}</span>
                    <span>{acc.regions.length} region{acc.regions.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => syncAccount(acc.id)}
                      disabled={acc.status === "syncing"}
                    >
                      <RefreshCw className={`mr-1 h-3 w-3 ${acc.status === "syncing" ? "animate-spin" : ""}`} />
                      Sync
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-destructive hover:text-destructive"
                      onClick={() => removeAccount(acc.id)}
                    >
                      <Unplug className="mr-1 h-3 w-3" />
                      Disconnect
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Two-column: Service Distribution + Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Service Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Service Distribution
            </CardTitle>
            <CardDescription>Breakdown of {services.length} services by type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {typeEntries.map(([type, count]) => (
              <div key={type} className="flex items-center gap-3">
                <div className="w-24 text-sm capitalize truncate">{type}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${typeColors[type] || "bg-gray-500"}`}
                        style={{ width: `${(count / maxTypeCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{count}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest events across all cloud accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.map((act) => {
                const iconMap = {
                  info: <Info className="h-4 w-4 text-blue-500" />,
                  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
                  error: <XCircle className="h-4 w-4 text-red-500" />,
                  success: <CheckCircle className="h-4 w-4 text-green-500" />,
                }
                return (
                  <div key={act.id} className="flex items-start gap-3">
                    <div className="mt-0.5">{iconMap[act.type]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{act.message}</p>
                      <p className="text-xs text-muted-foreground">{relativeTime(act.timestamp)}</p>
                    </div>
                    <Link href={`/dashboard/cloud-connect/services/${act.serviceId}`}>
                      <Button variant="ghost" size="sm" className="h-6 px-2">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cross-Cloud Connections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Cross-Cloud Connections
          </CardTitle>
          <CardDescription>
            Services connected across different cloud providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {crossCloud.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cross-cloud connections found.</p>
          ) : (
            <div className="space-y-3">
              {crossCloud.map(({ from, to }, i) => {
                const fromMeta = providerMeta[from.provider]
                const toMeta = providerMeta[to.provider]
                const latency = Math.round(15 + Math.random() * 45)
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge variant="outline" className={fromMeta.color}>
                        {fromMeta.label}
                      </Badge>
                      <div className="truncate">
                        <span className="text-sm font-medium">{from.resourceName}</span>
                        <span className="text-xs text-muted-foreground ml-1">({from.serviceName})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                      <Zap className="h-3 w-3" />
                      <span className="text-xs">{latency}ms</span>
                      <ArrowRight className="h-3 w-3 mx-1" />
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <div className="truncate text-right">
                        <span className="text-sm font-medium">{to.resourceName}</span>
                        <span className="text-xs text-muted-foreground ml-1">({to.serviceName})</span>
                      </div>
                      <Badge variant="outline" className={toMeta.color}>
                        {toMeta.label}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

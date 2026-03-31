"use client"

import { useState, useMemo } from "react"
import {
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Server,
  CheckCircle2,
  Search,
  Clock,
  ArrowUpRight,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Scatter,
} from "recharts"
import {
  useCostAnomalyStore,
  type CostAnomaly,
  type AnomalyStatus,
  type AnomalySeverity,
  type CloudProvider,
} from "@/stores/cost-anomaly-store"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const severityColors: Record<AnomalySeverity, string> = {
  critical: "bg-red-500/10 text-red-700 border-red-200",
  high: "bg-orange-500/10 text-orange-700 border-orange-200",
  medium: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  low: "bg-blue-500/10 text-blue-700 border-blue-200",
}

const statusColors: Record<AnomalyStatus, string> = {
  ACTIVE: "bg-red-500/10 text-red-700 border-red-200",
  INVESTIGATING: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  RESOLVED: "bg-green-500/10 text-green-700 border-green-200",
  AUTO_RESOLVED: "bg-green-500/10 text-green-600 border-green-200",
  DISMISSED: "bg-zinc-500/10 text-zinc-600 border-zinc-200",
}

const providerBadge: Record<CloudProvider, { label: string; className: string }> = {
  aws: { label: "AWS", className: "bg-amber-500/10 text-amber-700 border-amber-200" },
  gcp: { label: "GCP", className: "bg-blue-500/10 text-blue-700 border-blue-200" },
  azure: { label: "Azure", className: "bg-sky-500/10 text-sky-700 border-sky-200" },
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) return "Just now"
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

// ---------------------------------------------------------------------------
// Aggregated chart data
// ---------------------------------------------------------------------------

function buildAggregatedChart(anomalies: CostAnomaly[]) {
  const map = new Map<string, { date: string; actual: number; expected: number; upper: number; lower: number }>()
  for (const a of anomalies) {
    for (const d of a.dailySpend) {
      const existing = map.get(d.date)
      if (existing) {
        existing.actual += d.actual
        existing.expected += d.expected
        existing.upper += d.upper
        existing.lower += d.lower
      } else {
        map.set(d.date, { ...d })
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CostAnomaliesPage() {
  const { data: costAnomalies } = useQuery({ queryKey: ['cost-anomalies'], queryFn: () => apiClient.get('/v1/cost/anomalies') })
  const { anomalies, resolveAnomaly, dismissAnomaly } = useCostAnomalyStore()
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d")
  const [selectedAnomaly, setSelectedAnomaly] = useState<CostAnomaly | null>(null)

  const activeAnomalies = anomalies.filter(
    (a) => a.status === "ACTIVE" || a.status === "INVESTIGATING",
  )
  const totalImpact = anomalies.reduce((s, a) => s + a.amountAboveBaseline, 0)
  const servicesAffected = new Set(anomalies.filter((a) => a.status !== "DISMISSED").map((a) => a.service)).size
  const autoResolved = anomalies.filter((a) => a.status === "AUTO_RESOLVED").length

  const chartData = useMemo(() => {
    const full = buildAggregatedChart(anomalies)
    if (timeRange === "7d") return full.slice(-7)
    if (timeRange === "30d") return full.slice(-30)
    return full
  }, [anomalies, timeRange])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cost Anomalies</h1>
          <p className="text-muted-foreground">
            Detect and investigate unexpected cloud spend changes
          </p>
        </div>
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
          <TabsList>
            <TabsTrigger value="7d">7d</TabsTrigger>
            <TabsTrigger value="30d">30d</TabsTrigger>
            <TabsTrigger value="90d">90d</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Anomalies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{anomalies.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeAnomalies.length} currently active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Estimated Impact</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalImpact)}</div>
            <p className="text-xs text-muted-foreground">Above baseline spend</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Services Affected</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{servicesAffected}</div>
            <p className="text-xs text-muted-foreground">Across all providers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Auto-Resolved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{autoResolved}</div>
            <p className="text-xs text-muted-foreground">Resolved without intervention</p>
          </CardContent>
        </Card>
      </div>

      {/* Anomaly detection chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Spend with Anomaly Detection</CardTitle>
          <CardDescription>
            Gray band shows expected range. Red dots indicate anomalies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => {
                    const d = new Date(v)
                    return `${d.getMonth() + 1}/${d.getDate()}`
                  }}
                  className="text-xs"
                />
                <YAxis
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
                  className="text-xs"
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "actual"
                      ? "Actual Spend"
                      : name === "expected"
                        ? "Expected"
                        : name === "upper"
                          ? "Upper Bound"
                          : "Lower Bound",
                  ]}
                  labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
                />
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="none"
                  fill="hsl(var(--muted))"
                  fillOpacity={0.4}
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="none"
                  fill="hsl(var(--background))"
                  fillOpacity={1}
                />
                <Line
                  type="monotone"
                  dataKey="expected"
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props
                    if (payload.actual > payload.upper) {
                      return (
                        <circle
                          key={`dot-${payload.date}`}
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill="#ef4444"
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      )
                    }
                    return <circle key={`dot-${payload.date}`} cx={cx} cy={cy} r={0} />
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Anomalies list */}
      <Card>
        <CardHeader>
          <CardTitle>Detected Anomalies</CardTitle>
          <CardDescription>
            {anomalies.length} anomalies detected in the selected time range
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {anomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50 cursor-pointer"
                onClick={() => setSelectedAnomaly(anomaly)}
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div className="mt-0.5">
                    <AlertTriangle
                      className={`h-5 w-5 ${
                        anomaly.severity === "critical"
                          ? "text-red-500"
                          : anomaly.severity === "high"
                            ? "text-orange-500"
                            : anomaly.severity === "medium"
                              ? "text-yellow-500"
                              : "text-blue-500"
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{anomaly.service}</span>
                      <Badge variant="outline" className={providerBadge[anomaly.provider].className}>
                        {providerBadge[anomaly.provider].label}
                      </Badge>
                      <Badge variant="outline" className={severityColors[anomaly.severity]}>
                        {anomaly.severity}
                      </Badge>
                      <Badge variant="outline" className={statusColors[anomaly.status]}>
                        {anomaly.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        {formatCurrency(anomaly.amountAboveBaseline)} above baseline
                      </span>
                      <span className="flex items-center gap-1">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        {anomaly.percentageIncrease}% increase
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTimeAgo(anomaly.detectedAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedAnomaly(anomaly)
                  }}
                >
                  <Search className="mr-1 h-3.5 w-3.5" />
                  Investigate
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Anomaly detail dialog */}
      <Dialog
        open={selectedAnomaly !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedAnomaly(null)
        }}
      >
        {selectedAnomaly && (
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle>{selectedAnomaly.service}</DialogTitle>
                <Badge variant="outline" className={providerBadge[selectedAnomaly.provider].className}>
                  {providerBadge[selectedAnomaly.provider].label}
                </Badge>
                <Badge variant="outline" className={severityColors[selectedAnomaly.severity]}>
                  {selectedAnomaly.severity}
                </Badge>
                <Badge variant="outline" className={statusColors[selectedAnomaly.status]}>
                  {selectedAnomaly.status.replace("_", " ")}
                </Badge>
              </div>
              <DialogDescription>
                {formatCurrency(selectedAnomaly.amountAboveBaseline)} above baseline ({selectedAnomaly.percentageIncrease}% increase) - Detected {formatTimeAgo(selectedAnomaly.detectedAt)}
              </DialogDescription>
            </DialogHeader>

            {/* Service spend chart */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Service Spend (Last 30 Days)</h3>
              <div className="h-[220px] rounded-md border p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={selectedAnomaly.dailySpend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => {
                        const d = new Date(v)
                        return `${d.getMonth() + 1}/${d.getDate()}`
                      }}
                      className="text-xs"
                    />
                    <YAxis
                      tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                      className="text-xs"
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value)]}
                      labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
                    />
                    <Area
                      type="monotone"
                      dataKey="upper"
                      stroke="none"
                      fill="hsl(var(--muted))"
                      fillOpacity={0.4}
                    />
                    <Area
                      type="monotone"
                      dataKey="lower"
                      stroke="none"
                      fill="hsl(var(--background))"
                      fillOpacity={1}
                    />
                    <Line
                      type="monotone"
                      dataKey="expected"
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="5 5"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props
                        if (payload.actual > payload.upper) {
                          return (
                            <circle
                              key={`dot-${payload.date}`}
                              cx={cx}
                              cy={cy}
                              r={5}
                              fill="#ef4444"
                              stroke="#fff"
                              strokeWidth={2}
                            />
                          )
                        }
                        return <circle key={`dot-${payload.date}`} cx={cx} cy={cy} r={0} />
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Root cause */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Root Cause Analysis</h3>
              <div className="rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
                {selectedAnomaly.rootCauseAnalysis}
              </div>
            </div>

            {/* Recommended actions */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Recommended Actions</h3>
              <ul className="space-y-1.5">
                {selectedAnomaly.recommendedActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  dismissAnomaly(selectedAnomaly.id)
                  setSelectedAnomaly(null)
                }}
              >
                Dismiss
              </Button>
              <Button variant="outline">Create Alert Rule</Button>
              <Button
                onClick={() => {
                  resolveAnomaly(selectedAnomaly.id)
                  setSelectedAnomaly(null)
                }}
              >
                <CheckCircle2 className="mr-1 h-4 w-4" />
                Resolve
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

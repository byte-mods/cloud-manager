"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  Zap,
  Globe,
  ChevronRight,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  useCloudConnectStore,
  type DiscoveredService,
  type CloudProvider,
} from "@/stores/cloud-connect-store"
import { useCloudTraffic } from "@/hooks/use-cloud-connect"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const providerMeta: Record<CloudProvider, { label: string; color: string }> = {
  aws: { label: "AWS", color: "text-orange-600" },
  gcp: { label: "GCP", color: "text-blue-600" },
  azure: { label: "Azure", color: "text-purple-600" },
}

function formatBytes(b: number) {
  if (b === 0) return "0 B/s"
  if (b < 1024) return `${b} B/s`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB/s`
  return `${(b / (1024 * 1024)).toFixed(1)} MB/s`
}

function formatBytesShort(b: number) {
  if (b < 1024) return `${b}B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}K`
  return `${(b / (1024 * 1024)).toFixed(1)}M`
}

type HistoryPoint = {
  timestamp: string
  totalIn: number
  totalOut: number
  requests: number
  errors: number
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TrafficPage() {
  const { services, updateServiceTraffic, getCrossCloudConnections } = useCloudConnectStore()
  const { data: traffic } = useCloudTraffic()
  const [history, setHistory] = useState<HistoryPoint[]>([])

  // Live update
  useEffect(() => {
    const interval = setInterval(() => {
      updateServiceTraffic()
      const current = useCloudConnectStore.getState().services
      const totalIn = current.reduce((s, svc) => s + svc.trafficIn, 0)
      const totalOut = current.reduce((s, svc) => s + svc.trafficOut, 0)
      setHistory((prev) => {
        const point: HistoryPoint = {
          timestamp: new Date().toISOString(),
          totalIn,
          totalOut,
          requests: Math.round((totalIn + totalOut) * 0.005),
          errors: Math.round(Math.random() * 12),
        }
        const next = [...prev, point]
        return next.length > 60 ? next.slice(-60) : next
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [updateServiceTraffic])

  const totalIn = services.reduce((s, svc) => s + svc.trafficIn, 0)
  const totalOut = services.reduce((s, svc) => s + svc.trafficOut, 0)
  const totalRequests = Math.round((totalIn + totalOut) * 0.005)
  const totalErrors = history.length > 0 ? history[history.length - 1].errors : 0

  // Sorted by total traffic
  const sortedByTraffic = useMemo(
    () =>
      [...services]
        .filter((s) => s.trafficIn + s.trafficOut > 0)
        .sort((a, b) => b.trafficIn + b.trafficOut - (a.trafficIn + a.trafficOut)),
    [services],
  )

  const top10 = sortedByTraffic.slice(0, 10)
  const maxTraffic = top10.length > 0 ? top10[0].trafficIn + top10[0].trafficOut : 1

  // Cross-cloud traffic
  const crossCloud = getCrossCloudConnections()

  // Group cross-cloud by provider pair
  const crossCloudPairs: Record<string, { from: string; to: string; count: number; services: { from: DiscoveredService; to: DiscoveredService }[] }> = {}
  for (const cc of crossCloud) {
    const pair = [cc.from.provider, cc.to.provider].sort().join("-")
    if (!crossCloudPairs[pair]) {
      const sorted = [cc.from.provider, cc.to.provider].sort()
      crossCloudPairs[pair] = {
        from: sorted[0],
        to: sorted[1],
        count: 0,
        services: [],
      }
    }
    crossCloudPairs[pair].count++
    crossCloudPairs[pair].services.push({ from: cc.from, to: cc.to })
  }

  // Anomaly detection: services with traffic > 2x their average neighbors
  const anomalies = useMemo(() => {
    const avgTraffic = services.reduce((s, svc) => s + svc.trafficIn + svc.trafficOut, 0) / Math.max(services.filter((s) => s.trafficIn + s.trafficOut > 0).length, 1)
    return services.filter((s) => s.trafficIn + s.trafficOut > avgTraffic * 2.5 && s.trafficIn + s.trafficOut > 100000)
  }, [services])

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Real-Time Traffic</h1>
        <p className="text-muted-foreground mt-1">
          Live traffic monitoring across all connected cloud services. Updates every 2 seconds.
        </p>
      </div>

      {/* Overall stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Inbound</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatBytes(totalIn)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Outbound</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatBytes(totalOut)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Requests/sec</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Errors/sec</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalErrors}</div>
          </CardContent>
        </Card>
      </div>

      {/* Live traffic chart */}
      <Card>
        <CardHeader>
          <CardTitle>Aggregate Bandwidth</CardTitle>
          <CardDescription>Total inbound/outbound across all services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            {history.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(v) => new Date(v).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" })}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis tickFormatter={(v) => formatBytesShort(v)} tick={{ fontSize: 10 }} />
                  <Tooltip
                    labelFormatter={(v) => new Date(v as string).toLocaleTimeString()}
                    formatter={(v: number, name: string) => [formatBytes(v), name]}
                  />
                  <Line type="monotone" dataKey="totalIn" name="Inbound" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="totalOut" name="Outbound" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Collecting data...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Per-service traffic table */}
        <Card>
          <CardHeader>
            <CardTitle>Per-Service Traffic</CardTitle>
            <CardDescription>Top services by bandwidth</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 text-left">Service</th>
                    <th className="p-2 text-left">Provider</th>
                    <th className="p-2 text-right">In</th>
                    <th className="p-2 text-right">Out</th>
                    <th className="p-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedByTraffic.slice(0, 15).map((svc) => {
                    const meta = providerMeta[svc.provider]
                    return (
                      <tr key={svc.id} className="hover:bg-muted/30">
                        <td className="p-2">
                          <div className="font-medium text-xs">{svc.resourceName}</div>
                          <div className="text-[10px] text-muted-foreground">{svc.serviceName}</div>
                        </td>
                        <td className="p-2">
                          <Badge variant="outline" className={`${meta.color} text-[10px]`}>{meta.label}</Badge>
                        </td>
                        <td className="p-2 text-right text-xs text-green-600">{formatBytes(svc.trafficIn)}</td>
                        <td className="p-2 text-right text-xs text-blue-600">{formatBytes(svc.trafficOut)}</td>
                        <td className="p-2">
                          <Link href={`/dashboard/cloud-connect/services/${svc.id}`}>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Bandwidth utilization - top 10 */}
        <Card>
          <CardHeader>
            <CardTitle>Bandwidth Utilization</CardTitle>
            <CardDescription>Top 10 services by total traffic</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {top10.map((svc) => {
              const total = svc.trafficIn + svc.trafficOut
              const pct = (total / maxTraffic) * 100
              const meta = providerMeta[svc.provider]
              return (
                <div key={svc.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-medium ${meta.color}`}>{meta.label}</span>
                      <span className="font-medium">{svc.resourceName}</span>
                    </div>
                    <span className="text-muted-foreground">{formatBytes(total)}</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-green-500 to-blue-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Cross-cloud traffic */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Cross-Cloud Traffic
          </CardTitle>
          <CardDescription>Traffic flowing between different cloud providers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(crossCloudPairs).map(([pair, data]) => {
              const fromLabel = providerMeta[data.from as CloudProvider]?.label || data.from
              const toLabel = providerMeta[data.to as CloudProvider]?.label || data.to
              const totalTraffic = data.services.reduce(
                (s, cc) => s + cc.from.trafficIn + cc.from.trafficOut,
                0,
              )
              return (
                <Card key={pair}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-center gap-3">
                      <Badge variant="outline" className={providerMeta[data.from as CloudProvider]?.color}>
                        {fromLabel}
                      </Badge>
                      <Zap className="h-4 w-4 text-amber-500" />
                      <Badge variant="outline" className={providerMeta[data.to as CloudProvider]?.color}>
                        {toLabel}
                      </Badge>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold">{data.count} connection{data.count !== 1 ? "s" : ""}</div>
                      <div className="text-xs text-muted-foreground">{formatBytes(totalTraffic)} combined</div>
                    </div>
                    <div className="space-y-1">
                      {data.services.slice(0, 3).map((cc, i) => (
                        <div key={i} className="text-[11px] text-muted-foreground flex items-center gap-1 justify-center">
                          <span>{cc.from.resourceName}</span>
                          <span className="text-muted-foreground/50">→</span>
                          <span>{cc.to.resourceName}</span>
                        </div>
                      ))}
                      {data.services.length > 3 && (
                        <div className="text-[10px] text-muted-foreground text-center">
                          +{data.services.length - 3} more
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Traffic alerts */}
      {anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Traffic Alerts
            </CardTitle>
            <CardDescription>Services with unusually high traffic patterns</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {anomalies.map((svc) => (
              <div key={svc.id} className="flex items-center justify-between p-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
                  <div>
                    <div className="text-sm font-medium">{svc.resourceName}</div>
                    <div className="text-xs text-muted-foreground">
                      {svc.serviceName} ({providerMeta[svc.provider].label}) -- {formatBytes(svc.trafficIn + svc.trafficOut)} total
                    </div>
                  </div>
                </div>
                <Link href={`/dashboard/cloud-connect/services/${svc.id}`}>
                  <Button variant="outline" size="sm">Investigate</Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

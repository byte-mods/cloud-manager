"use client"

import {
  Gauge,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { useSLATargets, type SLATarget } from "@/hooks/use-sla"

function uptimeStatus(target: number, actual: number): { label: string; color: string; icon: typeof CheckCircle2 } {
  const diff = actual - target
  if (diff >= 0) return { label: "Met", color: "text-green-500", icon: CheckCircle2 }
  if (diff >= -0.5) return { label: "At Risk", color: "text-yellow-500", icon: AlertTriangle }
  return { label: "Breached", color: "text-red-500", icon: XCircle }
}

function latencyStatus(target: number, actual: number): { label: string; color: string; icon: typeof CheckCircle2 } {
  if (actual <= target) return { label: "Met", color: "text-green-500", icon: CheckCircle2 }
  if (actual <= target * 1.2) return { label: "At Risk", color: "text-yellow-500", icon: AlertTriangle }
  return { label: "Breached", color: "text-red-500", icon: XCircle }
}

export default function SLADashboardPage() {
  const { data, isLoading, error } = useSLATargets()

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SLA Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitor service level agreements and compliance.</p>
        </div>
        <Card className="border-red-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-red-500">Failed to load SLA targets. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const targets = data?.targets ?? []
  const metCount = targets.filter((t) => t.actualUptime >= t.targetUptime && t.actualLatency <= t.targetLatency).length
  const breachedCount = targets.filter((t) => t.actualUptime < t.targetUptime - 0.5 || t.actualLatency > t.targetLatency * 1.2).length
  const atRiskCount = targets.length - metCount - breachedCount

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">SLA Dashboard</h1>
        <p className="text-muted-foreground mt-1">Monitor service level agreements and compliance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Services</CardDescription>
            <CardTitle className="text-3xl">{targets.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>SLAs Met</CardDescription>
            <CardTitle className="text-3xl text-green-500">{metCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>At Risk</CardDescription>
            <CardTitle className="text-3xl text-yellow-500">{atRiskCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Breached</CardDescription>
            <CardTitle className="text-3xl text-red-500">{breachedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {targets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Gauge className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No SLA targets configured</h3>
            <p className="text-muted-foreground text-sm mt-1">Configure SLA targets to start monitoring compliance.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {targets.map((target) => {
            const uptime = uptimeStatus(target.targetUptime, target.actualUptime)
            const latency = latencyStatus(target.targetLatency, target.actualLatency)
            const UptimeIcon = uptime.icon
            const LatencyIcon = latency.icon
            const uptimePercent = Math.min(100, (target.actualUptime / target.targetUptime) * 100)
            const latencyPercent = Math.min(100, (target.targetLatency / Math.max(target.actualLatency, 1)) * 100)

            return (
              <Card key={target.serviceName}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">{target.serviceName}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={uptime.color}>
                        <UptimeIcon className="mr-1 h-3 w-3" /> Uptime: {uptime.label}
                      </Badge>
                      <Badge variant="outline" className={latency.color}>
                        <LatencyIcon className="mr-1 h-3 w-3" /> Latency: {latency.label}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Uptime</span>
                        <span className="font-medium">{target.actualUptime}% / {target.targetUptime}%</span>
                      </div>
                      <Progress value={uptimePercent} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Latency</span>
                        <span className="font-medium">{target.actualLatency}ms / {target.targetLatency}ms</span>
                      </div>
                      <Progress value={latencyPercent} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

"use client"

import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Clock,
  FileText,
  Gauge,
  Heart,
  TrendingUp,
  Zap,
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  useMonitoringOverview,
  useMonitoringAlerts,
  useMonitoringUptime,
} from "@/hooks/use-monitoring"

const severityColors: Record<string, string> = {
  critical: "bg-red-500",
  warning: "bg-yellow-500",
  info: "bg-blue-500",
}

const severityBadgeVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  critical: "destructive",
  warning: "secondary",
  info: "outline",
}

const statusColors: Record<string, string> = {
  healthy: "bg-green-500",
  degraded: "bg-yellow-500",
  down: "bg-red-500",
}

function ResponseTimeSparkline() {
  const points = [120, 135, 128, 145, 160, 142, 138, 155, 148, 142, 136, 130]
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const width = 200
  const height = 60

  const pathData = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width
      const y = height - ((p - min) / range) * height
      return `${i === 0 ? "M" : "L"} ${x} ${y}`
    })
    .join(" ")

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16">
      <path d={pathData} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
    </svg>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}

export default function MonitoringOverviewPage() {
  const { data: overviewData, isLoading: isLoadingOverview } = useMonitoringOverview()
  const { data: alertsData, isLoading: isLoadingAlerts } = useMonitoringAlerts()
  const { data: uptimeData, isLoading: isLoadingUptime } = useMonitoringUptime()

  const overview = overviewData
  const alerts = alertsData?.alerts ?? []
  const services = uptimeData?.services ?? []

  const isLoading = isLoadingOverview || isLoadingAlerts || isLoadingUptime

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitoring</h1>
          <p className="text-muted-foreground mt-1">
            Unified observability across all cloud infrastructure.
          </p>
        </div>
        <LoadingSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitoring</h1>
          <p className="text-muted-foreground mt-1">
            Unified observability across all cloud infrastructure.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/monitoring/dashboards">
              <BarChart3 className="mr-2 h-4 w-4" />
              Dashboards
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/monitoring/alerts">
              <Zap className="mr-2 h-4 w-4" />
              Alerts
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.uptime?.toFixed(2) ?? 0}%</div>
            <p className={`text-xs mt-1 ${
              (overview?.uptime ?? 0) >= 99.9 ? "text-green-500" : "text-yellow-500"
            }`}>
              +0.02% from last period
            </p>
            <Button variant="ghost" size="sm" className="mt-3 -ml-2 h-8" asChild>
              <Link href="/dashboard/monitoring/uptime">
                View Details <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.errorRate?.toFixed(2) ?? 0}%</div>
            <p className={`text-xs mt-1 ${
              (overview?.errorRate ?? 0) <= 1 ? "text-green-500" : "text-red-500"
            }`}>
              -0.05% from last period
            </p>
            <Button variant="ghost" size="sm" className="mt-3 -ml-2 h-8" asChild>
              <Link href="/dashboard/monitoring/metrics">
                View Details <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.avgResponseTime ?? 0}ms</div>
            <p className="text-xs mt-1 text-muted-foreground">
              +8ms from last period
            </p>
            <Button variant="ghost" size="sm" className="mt-3 -ml-2 h-8" asChild>
              <Link href="/dashboard/monitoring/metrics">
                View Details <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.activeAlerts ?? 0}</div>
            <p className="text-xs mt-1 text-muted-foreground">
              +1 from last period
            </p>
            <Button variant="ghost" size="sm" className="mt-3 -ml-2 h-8" asChild>
              <Link href="/dashboard/monitoring/alerts">
                View Details <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>Latest alerts across all services</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/monitoring/alerts">
                  View All <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.slice(0, 4).map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${severityColors[alert.severity]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{alert.name}</span>
                      <Badge variant={severityBadgeVariants[alert.severity]} className="text-xs">
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{alert.message}</p>
                    <span className="text-xs text-muted-foreground">{alert.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Response Time Trend</CardTitle>
                <CardDescription>Average response time over last 12 hours</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/monitoring/metrics">
                  <TrendingUp className="mr-1 h-3 w-3" /> Explore
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponseTimeSparkline />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>12h ago</span>
              <span>Now</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Service Health</CardTitle>
              <CardDescription>Current status of monitored services</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/monitoring/uptime">
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <div key={service.name} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className={`w-3 h-3 rounded-full shrink-0 ${statusColors[service.status]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{service.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground">{service.uptime}% uptime</span>
                    {service.responseTime > 0 && (
                      <span className="text-xs text-muted-foreground">{service.responseTime}ms</span>
                    )}
                  </div>
                </div>
                <Badge
                  variant={service.status === "healthy" ? "outline" : service.status === "degraded" ? "secondary" : "destructive"}
                  className="text-xs capitalize"
                >
                  {service.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/dashboard/monitoring/logs">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Log Explorer</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Search and analyze logs across all services with real-time streaming.</p>
            </CardContent>
          </Link>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/dashboard/monitoring/tracing">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Distributed Tracing</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Trace requests across microservices with waterfall timeline views.</p>
            </CardContent>
          </Link>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/dashboard/monitoring/metrics">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Metrics Explorer</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Explore and visualize metrics with custom queries and time ranges.</p>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  )
}

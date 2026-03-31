"use client"

import { useState, useMemo, useEffect } from "react"
import { useMonitoringMetrics } from "@/hooks/use-monitoring"
import {
  BarChart3,
  Plus,
  X,
  RefreshCw,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d"

type MetricSeries = {
  id: string
  name: string
  provider: string
  service: string
  metric: string
  color: string
  data: number[]
}

const providers = ["All Providers", "AWS", "GCP", "Azure"]
const services = ["All Services", "EC2", "Lambda", "RDS", "S3", "CloudFront", "EKS"]
const metricNames = ["CPU Utilization", "Memory Usage", "Network In", "Network Out", "Disk IOPS", "Request Count", "Error Rate", "Latency P99"]
const timeRanges: { label: string; value: TimeRange }[] = [
  { label: "1h", value: "1h" },
  { label: "6h", value: "6h" },
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
]

const seriesColors = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"]

function generateData(points: number): number[] {
  const data: number[] = []
  let value = 40 + Math.random() * 30
  for (let i = 0; i < points; i++) {
    value += (Math.random() - 0.5) * 10
    value = Math.max(5, Math.min(95, value))
    data.push(Math.round(value * 100) / 100)
  }
  return data
}


function MetricsChart({ series, timeRange }: { series: MetricSeries[]; timeRange: TimeRange }) {
  const width = 800
  const height = 300
  const padding = { top: 20, right: 20, bottom: 30, left: 50 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const allValues = series.flatMap((s) => s.data)
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : 100
  const minValue = allValues.length > 0 ? Math.min(...allValues) : 0
  const range = maxValue - minValue || 1

  const yTicks = 5
  const yTickValues = Array.from({ length: yTicks }, (_, i) =>
    Math.round(minValue + (range * i) / (yTicks - 1))
  )

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {yTickValues.map((tick) => {
        const y = padding.top + chartHeight - ((tick - minValue) / range) * chartHeight
        return (
          <g key={tick}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.1}
            />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-muted-foreground" fontSize={11}>
              {tick}
            </text>
          </g>
        )
      })}

      {/* Data lines */}
      {series.map((s) => {
        const points = s.data.length
        const pathData = s.data
          .map((value, i) => {
            const x = padding.left + (i / (points - 1)) * chartWidth
            const y = padding.top + chartHeight - ((value - minValue) / range) * chartHeight
            return `${i === 0 ? "M" : "L"} ${x} ${y}`
          })
          .join(" ")

        return <path key={s.id} d={pathData} fill="none" stroke={s.color} strokeWidth="2" />
      })}

      {/* X axis labels */}
      <text x={padding.left} y={height - 5} className="fill-muted-foreground" fontSize={11}>
        {timeRange === "1h" ? "60m ago" : timeRange === "6h" ? "6h ago" : timeRange === "24h" ? "24h ago" : timeRange === "7d" ? "7d ago" : "30d ago"}
      </text>
      <text x={width - padding.right} y={height - 5} textAnchor="end" className="fill-muted-foreground" fontSize={11}>
        Now
      </text>
    </svg>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-[160px]" />
        ))}
      </div>
      <Skeleton className="h-[300px] w-full" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No metrics selected</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Select a provider, service, and metric to start exploring.
      </p>
    </div>
  )
}

export default function MetricsExplorerPage() {
  const { data: metricsData, isLoading: metricsLoading } = useMonitoringMetrics()
  const [provider, setProvider] = useState("All Providers")
  const [service, setService] = useState("All Services")
  const [metric, setMetric] = useState("CPU Utilization")
  const [timeRange, setTimeRange] = useState<TimeRange>("24h")
  const [activeSeries, setActiveSeries] = useState<MetricSeries[]>([])
  const isLoading = metricsLoading

  useEffect(() => {
    if (metricsData?.metrics && metricsData.metrics.length > 0) {
      const apiSeries: MetricSeries[] = metricsData.metrics.slice(0, 5).map((m: any, i: number) => ({
        id: m.id ?? `api-${i}`,
        name: m.name ?? `Metric ${i}`,
        provider: m.provider ?? "AWS",
        service: m.service ?? "EC2",
        metric: m.metric ?? m.name ?? "Unknown",
        color: seriesColors[i % seriesColors.length],
        data: m.datapoints?.map((d: any) => d.value) ?? generateData(24),
      }))
      setActiveSeries(apiSeries)
    }
  }, [metricsData])

  const handleAddMetric = () => {
    const newSeries: MetricSeries = {
      id: `s-${Date.now()}`,
      name: `${metric} - ${service}`,
      provider,
      service,
      metric,
      color: seriesColors[activeSeries.length % seriesColors.length],
      data: generateData(24),
    }
    setActiveSeries([...activeSeries, newSeries])
  }

  const handleRemoveSeries = (id: string) => {
    setActiveSeries(activeSeries.filter((s) => s.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Metrics Explorer</h1>
          <p className="text-muted-foreground mt-1">
            Explore and visualize metrics across all cloud services.
          </p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Query Builder</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Provider</span>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Service</span>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Metric</span>
              <Select value={metric} onValueChange={setMetric}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {metricNames.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Time Range</span>
              <div className="flex rounded-md border">
                {timeRanges.map((tr) => (
                  <button
                    key={tr.value}
                    onClick={() => setTimeRange(tr.value)}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      timeRange === tr.value
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    } ${tr.value === "1h" ? "rounded-l-md" : ""} ${tr.value === "30d" ? "rounded-r-md" : ""}`}
                  >
                    {tr.label}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleAddMetric}>
              <Plus className="mr-2 h-4 w-4" /> Add Metric
            </Button>
          </div>
        </CardContent>
      </Card>

      {activeSeries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeSeries.map((s) => (
            <Badge key={s.id} variant="secondary" className="gap-1 pr-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
              <button
                onClick={() => handleRemoveSeries(s.id)}
                className="ml-1 p-0.5 rounded-full hover:bg-muted-foreground/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : activeSeries.length === 0 ? (
            <EmptyState />
          ) : (
            <MetricsChart series={activeSeries} timeRange={timeRange} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

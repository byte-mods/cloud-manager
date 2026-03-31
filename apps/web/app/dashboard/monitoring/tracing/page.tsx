"use client"

import { useState } from "react"
import {
  Activity,
  Search,
  ChevronDown,
  ChevronRight,
  Clock,
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
import { Skeleton } from "@/components/ui/skeleton"
import { useMonitoringTraces } from "@/hooks/use-monitoring"

type Span = {
  id: string
  operationName: string
  service: string
  duration: number
  startOffset: number
  status: "ok" | "error"
  tags: Record<string, string>
  logs: { timestamp: string; message: string }[]
}

type Trace = {
  id: string
  rootService: string
  rootOperation: string
  totalDuration: number
  spanCount: number
  timestamp: string
  status: "ok" | "error"
  spans: Span[]
}

const serviceColors: Record<string, string> = {
  "api-gateway": "#3b82f6",
  "order-service": "#22c55e",
  "inventory-service": "#f59e0b",
  "payment-service": "#ef4444",
  "auth-service": "#8b5cf6",
  "notification-service": "#ec4899",
  database: "#6b7280",
}


function SpanBar({ span, totalDuration }: { span: Span; totalDuration: number }) {
  const [expanded, setExpanded] = useState(false)
  const left = (span.startOffset / totalDuration) * 100
  const width = Math.max((span.duration / totalDuration) * 100, 1)
  const color = serviceColors[span.service] ?? "#6b7280"

  return (
    <div className="border-b last:border-b-0">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <span className="text-xs font-medium w-[140px] shrink-0 truncate" style={{ color }}>
          {span.service}
        </span>
        <span className="text-xs text-muted-foreground w-[180px] shrink-0 truncate">
          {span.operationName}
        </span>
        <div className="flex-1 relative h-6">
          <div className="absolute inset-y-0 w-full">
            <div
              className="absolute h-full rounded-sm"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: color,
                opacity: span.status === "error" ? 1 : 0.7,
              }}
            />
          </div>
        </div>
        <span className="text-xs text-muted-foreground w-[60px] text-right shrink-0">
          {span.duration}ms
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-2 border-t bg-muted/30 space-y-3">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Tags</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {Object.entries(span.tags).map(([key, value]) => (
                <Badge key={key} variant="outline" className="text-xs font-mono">
                  {key}={value}
                </Badge>
              ))}
            </div>
          </div>
          {span.logs.length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Logs</span>
              <div className="mt-1 space-y-1">
                {span.logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-muted-foreground font-mono shrink-0">{log.timestamp}</span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TraceDetail({ trace }: { trace: Trace }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{trace.rootOperation}</CardTitle>
            <CardDescription className="flex items-center gap-3 mt-1">
              <code className="text-xs font-mono">{trace.id}</code>
              <span>{trace.spanCount} spans</span>
              <span>{trace.totalDuration}ms</span>
            </CardDescription>
          </div>
          <Badge variant={trace.status === "ok" ? "default" : "destructive"}>
            {trace.status === "ok" ? "OK" : "Error"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-t">
          {trace.spans.map((span) => (
            <SpanBar key={span.id} span={span} totalDuration={trace.totalDuration} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full max-w-md" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Activity className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No traces found</h3>
      <p className="text-muted-foreground text-sm mt-1">
        Search by trace ID or service name to find traces.
      </p>
    </div>
  )
}

export default function TracingPage() {
  const { data, isLoading } = useMonitoringTraces()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null)

  const traces: Trace[] = []

  const filteredTraces = traces.filter((trace) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      trace.id.toLowerCase().includes(q) ||
      trace.rootService.toLowerCase().includes(q) ||
      trace.rootOperation.toLowerCase().includes(q) ||
      trace.spans.some((s) => s.service.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Distributed Tracing</h1>
          <p className="text-muted-foreground mt-1">
            Trace requests across microservices.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by trace ID or service name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton />
      ) : filteredTraces.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {selectedTrace ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setSelectedTrace(null)}>
                Back to Traces
              </Button>
              <TraceDetail trace={selectedTrace} />
            </>
          ) : (
            <>
              {filteredTraces.map((trace) => (
                <Card
                  key={trace.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedTrace(trace)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full ${trace.status === "ok" ? "bg-green-500" : "bg-red-500"}`} />
                        <div>
                          <p className="text-sm font-medium">{trace.rootOperation}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <code className="text-xs text-muted-foreground font-mono">{trace.id}</code>
                            <span className="text-xs text-muted-foreground">{trace.rootService}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{trace.spanCount} spans</span>
                        <span className="font-mono">{trace.totalDuration}ms</span>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-xs">{new Date(trace.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

import type { CloudProvider } from "./cloud"

export interface Metric {
  name: string
  namespace: string
  provider: CloudProvider
  unit: string
  datapoints: { timestamp: string; value: number }[]
  statistics: { average: number; min: number; max: number; sum: number }
}

export interface LogEntry {
  id: string
  timestamp: string
  level: "debug" | "info" | "warn" | "error" | "fatal"
  message: string
  source: string
  metadata?: Record<string, unknown>
}

export interface Alert {
  id: string
  name: string
  description: string
  severity: "critical" | "warning" | "info"
  status: "firing" | "resolved" | "silenced"
  metric: string
  threshold: number
  channels: string[]
  lastTriggered?: string
}

export interface Dashboard {
  id: string
  name: string
  description?: string
  widgets: DashboardWidget[]
  createdAt: string
  updatedAt: string
}

export interface DashboardWidget {
  id: string
  type: "line" | "bar" | "gauge" | "stat" | "table" | "log"
  title: string
  query: string
  position: { x: number; y: number; w: number; h: number }
}

export interface Trace {
  traceId: string
  spanId: string
  operationName: string
  serviceName: string
  duration: number
  status: "ok" | "error"
  startTime: string
  spans: TraceSpan[]
}

export interface TraceSpan {
  spanId: string
  parentSpanId?: string
  operationName: string
  serviceName: string
  duration: number
  status: "ok" | "error"
}

"use client"

import { useState } from "react"
import {
  Siren,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Server,
  Brain,
  UserCheck,
  UserPlus,
  MessageSquarePlus,
  Shield,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  useIncidentStore,
  type Incident,
  type TimelineEventType,
} from "@/stores/incident-store"
import { useIncidents } from "@/hooks/use-incidents"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const severityColor: Record<string, string> = {
  critical: "bg-red-500/10 text-red-500 border-red-500/20",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
}

const statusColor: Record<string, string> = {
  ACTIVE: "bg-red-500/10 text-red-500",
  RESOLVED: "bg-green-500/10 text-green-500",
}

const eventDotColor: Record<TimelineEventType, string> = {
  alert: "bg-red-500",
  warning: "bg-yellow-500",
  action: "bg-blue-500",
  resolution: "bg-green-500",
}

const eventBorderColor: Record<TimelineEventType, string> = {
  alert: "border-red-500/30",
  warning: "border-yellow-500/30",
  action: "border-blue-500/30",
  resolution: "border-green-500/30",
}

const serviceStatusColor: Record<string, string> = {
  degraded: "text-red-500",
  down: "text-red-600",
  recovering: "text-yellow-500",
  healthy: "text-green-500",
}

function formatTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IncidentsPage() {
  const { data: incidentsData } = useIncidents()
  const { incidents, resolveIncident, acknowledgeIncident, addUpdate } =
    useIncidentStore()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [timeRange, setTimeRange] = useState<string>("7d")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addUpdateDialogId, setAddUpdateDialogId] = useState<string | null>(null)
  const [updateText, setUpdateText] = useState("")

  const filtered = incidents.filter((inc) => {
    if (statusFilter === "active") return inc.status === "ACTIVE"
    if (statusFilter === "resolved") return inc.status === "RESOLVED"
    return true
  })

  const activeIncidents = incidents.filter((i) => i.status === "ACTIVE")

  const handleAddUpdate = () => {
    if (addUpdateDialogId && updateText.trim()) {
      addUpdate(addUpdateDialogId, updateText.trim(), "action")
      setUpdateText("")
      setAddUpdateDialogId(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-red-500/10 p-2">
            <Siren className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Incident Timeline
            </h1>
            <p className="text-muted-foreground mt-1">
              Correlated incidents with timeline, root cause analysis, and
              metrics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last 1 hour</SelectItem>
              <SelectItem value="6h">Last 6 hours</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active incidents summary */}
      {activeIncidents.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {activeIncidents.map((inc) => (
            <Card
              key={inc.id}
              className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
              style={{
                borderLeftColor:
                  inc.severity === "critical"
                    ? "rgb(239 68 68)"
                    : inc.severity === "high"
                      ? "rgb(249 115 22)"
                      : inc.severity === "medium"
                        ? "rgb(234 179 8)"
                        : "rgb(59 130 246)",
              }}
              onClick={() =>
                setExpandedId(expandedId === inc.id ? null : inc.id)
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={severityColor[inc.severity]}>
                    {inc.severity}
                  </Badge>
                  <Badge className={statusColor[inc.status]}>Active</Badge>
                </div>
                <CardTitle className="text-sm mt-2">{inc.title}</CardTitle>
                <CardDescription className="text-xs">
                  {inc.id} &middot; Started {formatTime(inc.startedAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Server className="h-3 w-3" />
                  {inc.affectedServices.length} services affected
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Incident list */}
      <div className="space-y-4">
        {filtered.map((incident) => (
          <IncidentRow
            key={incident.id}
            incident={incident}
            isExpanded={expandedId === incident.id}
            onToggle={() =>
              setExpandedId(expandedId === incident.id ? null : incident.id)
            }
            onResolve={() => resolveIncident(incident.id)}
            onAcknowledge={() => acknowledgeIncident(incident.id)}
            onAddUpdate={() => setAddUpdateDialogId(incident.id)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mb-4 text-green-500" />
            <p className="text-lg font-medium">No incidents found</p>
            <p className="text-sm">All systems are operating normally.</p>
          </CardContent>
        </Card>
      )}

      {/* Add update dialog */}
      <Dialog
        open={!!addUpdateDialogId}
        onOpenChange={(open) => {
          if (!open) {
            setAddUpdateDialogId(null)
            setUpdateText("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Update</DialogTitle>
            <DialogDescription>
              Add a status update to incident {addUpdateDialogId}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Update Message</Label>
              <Input
                value={updateText}
                onChange={(e) => setUpdateText(e.target.value)}
                placeholder="Describe the update..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddUpdateDialogId(null)
                setUpdateText("")
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddUpdate}>Add Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Incident row with expandable detail
// ---------------------------------------------------------------------------

function IncidentRow({
  incident,
  isExpanded,
  onToggle,
  onResolve,
  onAcknowledge,
  onAddUpdate,
}: {
  incident: Incident
  isExpanded: boolean
  onToggle: () => void
  onResolve: () => void
  onAcknowledge: () => void
  onAddUpdate: () => void
}) {
  return (
    <Card className="overflow-hidden">
      {/* Collapsed summary row */}
      <div
        className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Badge variant="outline" className={severityColor[incident.severity]}>
            {incident.severity}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">
            {incident.id}
          </span>
          <span className="font-medium truncate">{incident.title}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {incident.acknowledged && (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-xs">
              Acknowledged
            </Badge>
          )}
          <Badge className={statusColor[incident.status]}>
            {incident.status === "ACTIVE" ? "Active" : "Resolved"}
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTime(incident.startedAt)}
          </span>
          {incident.duration && (
            <span className="text-xs text-muted-foreground">
              ({incident.duration})
            </span>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t bg-muted/20 px-6 py-6 space-y-6">
          {/* Actions bar */}
          <div className="flex items-center gap-2">
            {!incident.acknowledged && incident.status === "ACTIVE" && (
              <Button size="sm" variant="outline" onClick={onAcknowledge}>
                <UserCheck className="h-4 w-4 mr-1" />
                Acknowledge
              </Button>
            )}
            {incident.status === "ACTIVE" && (
              <>
                <Button size="sm" variant="outline" onClick={onAddUpdate}>
                  <MessageSquarePlus className="h-4 w-4 mr-1" />
                  Add Update
                </Button>
                <Button size="sm" variant="outline">
                  <UserPlus className="h-4 w-4 mr-1" />
                  Assign
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={onResolve}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Resolve
                </Button>
              </>
            )}
            {incident.assignee && (
              <span className="ml-auto text-sm text-muted-foreground">
                Assigned to <span className="font-medium text-foreground">{incident.assignee}</span>
              </span>
            )}
          </div>

          {/* Impact */}
          {incident.impact && (
            <div className="rounded-lg border bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-1">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Impact
              </div>
              <p className="text-sm text-muted-foreground">
                {incident.impact}
              </p>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: Timeline */}
            <div>
              <h3 className="text-sm font-semibold mb-4">Event Timeline</h3>
              <div className="relative space-y-0">
                {incident.timeline.map((event, idx) => (
                  <div key={event.id} className="flex gap-4 pb-6 last:pb-0">
                    {/* Vertical line + dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`h-3 w-3 rounded-full shrink-0 ${eventDotColor[event.type]} ring-4 ring-background`}
                      />
                      {idx < incident.timeline.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-1" />
                      )}
                    </div>
                    {/* Content */}
                    <div className={`rounded-lg border p-3 flex-1 ${eventBorderColor[event.type]}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {formatTimestamp(event.timestamp)}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {event.type}
                        </Badge>
                      </div>
                      <p className="text-sm">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Services + RCA + Metrics */}
            <div className="space-y-6">
              {/* Affected services */}
              {incident.affectedServices.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">
                    Affected Services
                  </h3>
                  <div className="space-y-2">
                    {incident.affectedServices.map((svc) => (
                      <div
                        key={svc.name}
                        className="flex items-center justify-between rounded-lg border bg-background px-4 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-mono">
                            {svc.name}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={serviceStatusColor[svc.status]}
                        >
                          {svc.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Root Cause Analysis */}
              {incident.rootCauseAnalysis && (
                <div className="rounded-lg border bg-gradient-to-br from-violet-500/5 to-blue-500/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Brain className="h-4 w-4 text-violet-500" />
                    AI Root Cause Analysis
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {incident.rootCauseAnalysis}
                  </p>
                </div>
              )}

              {/* Metrics correlation */}
              <div>
                <h3 className="text-sm font-semibold mb-3">
                  Metrics Correlation
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <MetricSparkline
                    title="CPU %"
                    data={incident.metrics.cpu}
                    color="#3b82f6"
                  />
                  <MetricSparkline
                    title="Error Rate %"
                    data={incident.metrics.errorRate}
                    color="#ef4444"
                  />
                  <MetricSparkline
                    title="Latency (ms)"
                    data={incident.metrics.latency}
                    color="#f59e0b"
                  />
                  <MetricSparkline
                    title="Connections"
                    data={incident.metrics.connections}
                    color="#8b5cf6"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------

function MetricSparkline({
  title,
  data,
  color,
}: {
  title: string
  data: { time: string; value: number }[]
  color: string
}) {
  const currentValue = data[data.length - 1]?.value ?? 0
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{title}</span>
        <span className="text-xs font-mono font-semibold">{currentValue}</span>
      </div>
      <div className="h-[60px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              dot={false}
            />
            <Tooltip
              contentStyle={{
                fontSize: "11px",
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

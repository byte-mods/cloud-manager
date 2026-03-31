"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  History,
  Download,
  Calendar,
  Users,
  AlertTriangle,
  XCircle,
  LayoutList,
  Clock,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useAuditStore,
  type AuditEvent,
  type AuditEventStatus,
} from "@/stores/audit-store"
import { useAuditLog } from "@/hooks/use-audit-log"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusColors: Record<AuditEventStatus, string> = {
  success: "bg-green-500/10 text-green-500 border-green-500/20",
  failed: "bg-red-500/10 text-red-500 border-red-500/20",
  warning: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
}

const statusDotColors: Record<AuditEventStatus, string> = {
  success: "bg-green-500",
  failed: "bg-red-500",
  warning: "bg-yellow-500",
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function actionVerb(action: string): string {
  const parts = action.split(".")
  const verbs: Record<string, string> = {
    login: "logged in",
    create: "created",
    delete: "deleted",
    modify: "modified",
    change: "changed",
    start: "started",
    rollback: "rolled back",
    scan_start: "started scan on",
    role_change: "changed role for",
    mfa_disable: "attempted to disable MFA for",
    budget_create: "created budget",
    design_save: "saved design",
    approve: "approved",
    reject: "rejected",
  }
  return verbs[parts[1]] || parts[1]
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function groupEventsByDate(events: AuditEvent[]): Map<string, AuditEvent[]> {
  const groups = new Map<string, AuditEvent[]>()
  const sorted = [...events].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )
  for (const event of sorted) {
    const dateKey = event.createdAt.toLocaleDateString()
    const existing = groups.get(dateKey) || []
    existing.push(event)
    groups.set(dateKey, existing)
  }
  return groups
}

// ---------------------------------------------------------------------------
// Event Detail Dialog
// ---------------------------------------------------------------------------

function EventDetailDialog({
  event,
  open,
  onOpenChange,
  allEvents,
}: {
  event: AuditEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  allEvents: AuditEvent[]
}) {
  if (!event) return null

  const relatedEvents = allEvents.filter(
    (e) =>
      e.id !== event.id &&
      (e.resourceId === event.resourceId || e.userId === event.userId) &&
      Math.abs(e.createdAt.getTime() - event.createdAt.getTime()) <
        24 * 60 * 60 * 1000,
  )

  const details = event.details as Record<string, unknown>

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${statusDotColors[event.status]}`}
            />
            {event.action}
          </DialogTitle>
          <DialogDescription>
            Event ID: {event.id} | {formatDate(event.createdAt)} at{" "}
            {formatTime(event.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">User</p>
              <p className="text-sm">{event.userName} ({event.userEmail})</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge variant="outline" className={statusColors[event.status]}>
                {event.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Resource</p>
              <p className="text-sm">
                {event.resourceType} / {event.resourceId}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">IP Address</p>
              <p className="text-sm font-mono">{event.ipAddress}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm font-medium text-muted-foreground">User Agent</p>
              <p className="text-sm font-mono">{event.userAgent}</p>
            </div>
          </div>

          {/* Full details JSON */}
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Full Details
            </p>
            <div className="rounded-lg bg-muted/50 p-4">
              <pre className="whitespace-pre-wrap text-sm font-mono text-muted-foreground">
                {JSON.stringify(event.details, null, 2)}
              </pre>
            </div>
          </div>

          {/* Before/After state */}
          {(details.before !== undefined || details.after !== undefined) && (
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Before / After State
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-red-500/5 p-3 border border-red-500/10">
                  <p className="mb-1 text-xs font-medium text-red-500">Before</p>
                  <pre className="whitespace-pre-wrap text-xs font-mono text-muted-foreground">
                    {details.before
                      ? JSON.stringify(details.before, null, 2)
                      : "null (new resource)"}
                  </pre>
                </div>
                <div className="rounded-lg bg-green-500/5 p-3 border border-green-500/10">
                  <p className="mb-1 text-xs font-medium text-green-500">After</p>
                  <pre className="whitespace-pre-wrap text-xs font-mono text-muted-foreground">
                    {details.after
                      ? JSON.stringify(details.after, null, 2)
                      : "null (deleted)"}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Related events */}
          {relatedEvents.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Related Events (within 24h)
              </p>
              <div className="space-y-2">
                {relatedEvents.slice(0, 5).map((re) => (
                  <div
                    key={re.id}
                    className="flex items-center gap-3 rounded-lg border p-2 text-sm"
                  >
                    <div
                      className={`h-2 w-2 rounded-full ${statusDotColors[re.status]}`}
                    />
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatTime(re.createdAt)}
                    </span>
                    <span>{re.userName}</span>
                    <span className="text-muted-foreground">
                      {actionVerb(re.action)}
                    </span>
                    <span className="font-mono text-xs">{re.resourceId}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Replay Component
// ---------------------------------------------------------------------------

function ReplayTimeline({ events }: { events: AuditEvent[] }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [visibleCount, setVisibleCount] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const sorted = [...events].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )

  const startReplay = useCallback(() => {
    setPlaying(true)
    setProgress(0)
    setVisibleCount(0)
  }, [])

  const stopReplay = useCallback(() => {
    setPlaying(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  const resetReplay = useCallback(() => {
    stopReplay()
    setProgress(0)
    setVisibleCount(0)
  }, [stopReplay])

  useEffect(() => {
    if (!playing) return
    const totalSteps = sorted.length
    const stepDuration = 500 // 500ms per event (10x speed simulation)
    let step = 0

    intervalRef.current = setInterval(() => {
      step++
      setVisibleCount(step)
      setProgress(Math.round((step / totalSteps) * 100))
      if (step >= totalSteps) {
        setPlaying(false)
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }, stepDuration)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [playing, sorted.length])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Event Replay
            </CardTitle>
            <CardDescription>
              Watch events play back at 10x speed
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!playing ? (
              <Button size="sm" onClick={startReplay}>
                <Play className="mr-1.5 h-4 w-4" />
                {progress > 0 ? "Resume" : "Start Replay"}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={stopReplay}>
                <Pause className="mr-1.5 h-4 w-4" />
                Pause
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={resetReplay}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1 text-sm text-muted-foreground">
            <span>
              {visibleCount} / {sorted.length} events
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="max-h-[400px] overflow-y-auto space-y-2">
          {sorted.slice(0, visibleCount).map((event, idx) => (
            <div
              key={event.id}
              className="flex items-center gap-3 rounded-lg border p-3 text-sm animate-in fade-in slide-in-from-left-2 duration-300"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div
                className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusDotColors[event.status]}`}
              />
              <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">
                {formatTime(event.createdAt)}
              </span>
              <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">
                {formatDateShort(event.createdAt)}
              </span>
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  {getInitials(event.userName)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{event.userName}</span>
              <span className="text-muted-foreground">
                {actionVerb(event.action)}
              </span>
              <span className="font-mono text-xs truncate">
                {event.resourceId}
              </span>
              <Badge
                variant="outline"
                className={`ml-auto shrink-0 ${statusColors[event.status]}`}
              >
                {event.status}
              </Badge>
            </div>
          ))}
          {visibleCount === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Play className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Click Start Replay to begin</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuditTrailPage() {
  const { data: auditData } = useAuditLog()
  const { events, getEvents, exportEvents } = useAuditStore()
  const [userFilter, setUserFilter] = useState<string>("all")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [resourceFilter, setResourceFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Compute unique values for filter dropdowns
  const uniqueUsers = Array.from(new Set(events.map((e) => e.userName)))
  const uniqueActions = Array.from(new Set(events.map((e) => e.action)))
  const uniqueResourceTypes = Array.from(new Set(events.map((e) => e.resourceType)))

  // Apply filters
  const filteredEvents = getEvents({
    user: userFilter !== "all" ? userFilter : undefined,
    action: actionFilter !== "all" ? actionFilter : undefined,
    resourceType: resourceFilter !== "all" ? resourceFilter : undefined,
    status: statusFilter !== "all" ? (statusFilter as AuditEventStatus) : undefined,
  })

  // Summary stats
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayEvents = events.filter((e) => e.createdAt >= today)
  const uniqueUsersToday = new Set(todayEvents.map((e) => e.userId)).size
  const criticalActions = events.filter(
    (e) =>
      e.action.startsWith("iam.") ||
      e.action.startsWith("security.") ||
      e.action === "resource.delete",
  ).length
  const failedAttempts = events.filter((e) => e.status === "failed").length

  // Group by date for timeline
  const groupedEvents = groupEventsByDate(filteredEvents)

  function handleExport() {
    const csv = exportEvents("csv")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "audit-trail.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleEventClick(event: AuditEvent) {
    setSelectedEvent(event)
    setDetailOpen(true)
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <History className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
            <p className="text-sm text-muted-foreground">
              Comprehensive log of all actions and events across your infrastructure
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Events Today
            </CardDescription>
            <CardTitle className="text-3xl">{todayEvents.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Active Users
            </CardDescription>
            <CardTitle className="text-3xl">{uniqueUsersToday}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Critical Actions
            </CardDescription>
            <CardTitle className="text-3xl text-orange-500">
              {criticalActions}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5" />
              Failed Attempts
            </CardDescription>
            <CardTitle className="text-3xl text-red-500">
              {failedAttempts}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {uniqueUsers.map((user) => (
              <SelectItem key={user} value={user}>
                {user}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {uniqueActions.map((action) => (
              <SelectItem key={action} value={action}>
                {action}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={resourceFilter} onValueChange={setResourceFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Resources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resource Types</SelectItem>
            {uniqueResourceTypes.map((rt) => (
              <SelectItem key={rt} value={rt}>
                {rt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
          </SelectContent>
        </Select>
        {(userFilter !== "all" ||
          actionFilter !== "all" ||
          resourceFilter !== "all" ||
          statusFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setUserFilter("all")
              setActionFilter("all")
              setResourceFilter("all")
              setStatusFilter("all")
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Views */}
      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline" className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="table" className="flex items-center gap-1.5">
            <LayoutList className="h-3.5 w-3.5" />
            Table
          </TabsTrigger>
          <TabsTrigger value="replay" className="flex items-center gap-1.5">
            <Play className="h-3.5 w-3.5" />
            Replay
          </TabsTrigger>
        </TabsList>

        {/* Timeline View */}
        <TabsContent value="timeline" className="mt-6">
          <div className="space-y-8">
            {Array.from(groupedEvents.entries()).map(
              ([dateKey, dateEvents]) => (
                <div key={dateKey}>
                  <h3 className="mb-4 text-sm font-semibold text-muted-foreground sticky top-0 bg-background py-2 z-10">
                    {formatDate(dateEvents[0].createdAt)}
                  </h3>
                  <div className="relative ml-4 border-l-2 border-border pl-6 space-y-4">
                    {dateEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => handleEventClick(event)}
                        className="relative flex items-start gap-4 w-full text-left rounded-lg p-3 -ml-3 hover:bg-muted/50 transition-colors group"
                      >
                        {/* Timeline dot */}
                        <div
                          className={`absolute -left-[33px] top-4 h-3 w-3 rounded-full border-2 border-background ${statusDotColors[event.status]}`}
                        />

                        {/* Time */}
                        <span className="font-mono text-xs text-muted-foreground w-16 shrink-0 pt-0.5">
                          {formatTime(event.createdAt)}
                        </span>

                        {/* Avatar */}
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(event.userName)}
                          </AvatarFallback>
                        </Avatar>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            <span className="font-medium">
                              {event.userName}
                            </span>{" "}
                            <span className="text-muted-foreground">
                              {actionVerb(event.action)}
                            </span>{" "}
                            <span className="font-mono text-xs">
                              {event.resourceId}
                            </span>
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-xs ${statusColors[event.status]}`}
                            >
                              {event.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-mono">
                              {event.ipAddress}
                            </span>
                          </div>
                        </div>

                        {/* Click hint */}
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                      </button>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        </TabsContent>

        {/* Table View */}
        <TabsContent value="table" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents
                    .sort(
                      (a, b) =>
                        b.createdAt.getTime() - a.createdAt.getTime(),
                    )
                    .map((event) => (
                      <TableRow
                        key={event.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleEventClick(event)}
                      >
                        <TableCell className="font-mono text-xs">
                          <div>
                            {formatDateShort(event.createdAt)}
                          </div>
                          <div className="text-muted-foreground">
                            {formatTime(event.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                {getInitials(event.userName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">
                                {event.userName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {event.userEmail}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {event.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{event.resourceType}</p>
                            <p className="text-xs font-mono text-muted-foreground">
                              {event.resourceId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusColors[event.status]}
                          >
                            {event.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {event.ipAddress}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Replay View */}
        <TabsContent value="replay" className="mt-6">
          <ReplayTimeline events={filteredEvents} />
        </TabsContent>
      </Tabs>

      {/* Event Detail Dialog */}
      <EventDetailDialog
        event={selectedEvent}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        allEvents={events}
      />
    </div>
  )
}

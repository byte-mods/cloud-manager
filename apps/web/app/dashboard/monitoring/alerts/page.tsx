"use client"

import { useState } from "react"
import { useMonitoringAlerts } from "@/hooks/use-monitoring"
import { ColumnDef } from "@tanstack/react-table"
import {
  Bell,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  VolumeX,
  Volume2,
  Zap,
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
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type AlertRule = {
  id: string
  name: string
  metric: string
  condition: ">" | "<" | ">=" | "<=" | "=="
  threshold: string
  status: "active" | "silenced"
  lastTriggered: string
  severity: "critical" | "warning" | "info"
}

type AlertHistoryEntry = {
  id: string
  alertName: string
  severity: "critical" | "warning" | "info"
  message: string
  triggeredAt: string
  resolvedAt: string | null
}


const severityBadgeVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  critical: "destructive",
  warning: "secondary",
  info: "outline",
}

const alertColumns: ColumnDef<AlertRule>[] = [
  { accessorKey: "name", header: "Alert Name", cell: ({ row }) => (
    <span className="font-medium">{row.original.name}</span>
  )},
  { accessorKey: "metric", header: "Metric", cell: ({ row }) => (
    <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{row.original.metric}</code>
  )},
  { id: "condition", header: "Condition", cell: ({ row }) => (
    <span className="text-sm font-mono">{row.original.condition} {row.original.threshold}</span>
  )},
  { accessorKey: "severity", header: "Severity", cell: ({ row }) => (
    <Badge variant={severityBadgeVariants[row.original.severity]} className="text-xs capitalize">
      {row.original.severity}
    </Badge>
  )},
  { accessorKey: "status", header: "Status", cell: ({ row }) => (
    <Badge variant={row.original.status === "active" ? "default" : "outline"} className="text-xs gap-1">
      {row.original.status === "active" ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
      {row.original.status === "active" ? "Active" : "Silenced"}
    </Badge>
  )},
  { accessorKey: "lastTriggered", header: "Last Triggered", cell: ({ row }) => (
    <span className="text-sm text-muted-foreground">{row.original.lastTriggered}</span>
  )},
  { id: "actions", header: "", cell: ({ row }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
        <DropdownMenuItem>
          {row.original.status === "active" ? (
            <><VolumeX className="mr-2 h-4 w-4" /> Silence</>
          ) : (
            <><Volume2 className="mr-2 h-4 w-4" /> Activate</>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )},
]

function CreateAlertDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Create Alert</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Alert Rule</DialogTitle>
          <DialogDescription>Define a new alert rule for monitoring.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="alert-name">Alert Name</Label>
            <Input id="alert-name" placeholder="High CPU Usage" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="alert-metric">Metric</Label>
            <Select>
              <SelectTrigger id="alert-metric"><SelectValue placeholder="Select metric" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cpu_utilization">CPU Utilization</SelectItem>
                <SelectItem value="memory_usage">Memory Usage</SelectItem>
                <SelectItem value="disk_usage">Disk Usage</SelectItem>
                <SelectItem value="error_rate">Error Rate</SelectItem>
                <SelectItem value="latency_p99">Latency P99</SelectItem>
                <SelectItem value="request_count">Request Count</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="alert-condition">Condition</Label>
              <Select>
                <SelectTrigger id="alert-condition"><SelectValue placeholder="Condition" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value=">">Greater than</SelectItem>
                  <SelectItem value="<">Less than</SelectItem>
                  <SelectItem value=">=">Greater or equal</SelectItem>
                  <SelectItem value="<=">Less or equal</SelectItem>
                  <SelectItem value="==">Equal to</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="alert-threshold">Threshold</Label>
              <Input id="alert-threshold" placeholder="90" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="alert-severity">Severity</Label>
            <Select>
              <SelectTrigger id="alert-severity"><SelectValue placeholder="Select severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Create Alert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Bell className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No alert rules</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Create your first alert rule to get notified of issues.
      </p>
    </div>
  )
}

export default function AlertsPage() {
  const { data: alertsData, isLoading } = useMonitoringAlerts()
  const apiRules = alertsData?.alerts ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alert Rules</h1>
          <p className="text-muted-foreground mt-1">
            Configure and manage monitoring alert rules.
          </p>
        </div>
        <CreateAlertDialog />
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : apiRules.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Alert Rules ({apiRules.length})</CardTitle>
            <CardDescription>Active and silenced alert configurations</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={alertColumns} data={apiRules} searchKey="name" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Alert History</CardTitle>
          <CardDescription>Recent alert triggers and resolutions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-sm text-muted-foreground">No data available</div>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Pause,
  Play,
  Globe,
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
import { useMonitoringUptime } from "@/hooks/use-monitoring"

type UptimeMonitor = {
  id: string
  endpoint: string
  name: string
  status: "up" | "down" | "degraded"
  responseTime: number
  uptime: number
  lastCheck: string
  checkInterval: string
  protocol: string
}

const statusColors: Record<string, string> = {
  up: "bg-green-500",
  down: "bg-red-500",
  degraded: "bg-yellow-500",
}

const columns: ColumnDef<UptimeMonitor>[] = [
  { accessorKey: "name", header: "Endpoint", cell: ({ row }) => (
    <div>
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${statusColors[row.original.status]}`} />
        <span className="font-medium">{row.original.name}</span>
      </div>
      <span className="text-xs text-muted-foreground font-mono ml-[18px]">{row.original.endpoint}</span>
    </div>
  )},
  { accessorKey: "status", header: "Status", cell: ({ row }) => (
    <Badge
      variant={row.original.status === "up" ? "default" : row.original.status === "degraded" ? "secondary" : "destructive"}
      className="text-xs capitalize"
    >
      {row.original.status}
    </Badge>
  )},
  { accessorKey: "responseTime", header: "Response Time", cell: ({ row }) => (
    <span className={`text-sm font-mono ${
      row.original.responseTime === 0 ? "text-muted-foreground" :
      row.original.responseTime > 500 ? "text-red-500" :
      row.original.responseTime > 200 ? "text-yellow-500" :
      ""
    }`}>
      {row.original.responseTime > 0 ? `${row.original.responseTime}ms` : "N/A"}
    </span>
  )},
  { accessorKey: "uptime", header: "Uptime %", cell: ({ row }) => (
    <span className={`text-sm font-medium ${
      row.original.uptime >= 99.9 ? "text-green-500" :
      row.original.uptime >= 99 ? "text-yellow-500" :
      "text-red-500"
    }`}>
      {row.original.uptime}%
    </span>
  )},
  { accessorKey: "protocol", header: "Protocol", cell: ({ row }) => (
    <Badge variant="outline" className="text-xs">{row.original.protocol}</Badge>
  )},
  { accessorKey: "lastCheck", header: "Last Check", cell: ({ row }) => (
    <span className="text-sm text-muted-foreground">{row.original.lastCheck}</span>
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
        <DropdownMenuItem><Pause className="mr-2 h-4 w-4" /> Pause</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )},
]

function AddMonitorDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Add Monitor</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Uptime Monitor</DialogTitle>
          <DialogDescription>Configure a new endpoint to monitor.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="monitor-name">Name</Label>
            <Input id="monitor-name" placeholder="My API" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="monitor-url">Endpoint URL</Label>
            <Input id="monitor-url" placeholder="https://api.example.com/health" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="monitor-protocol">Protocol</Label>
              <Select>
                <SelectTrigger id="monitor-protocol"><SelectValue placeholder="Protocol" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="https">HTTPS</SelectItem>
                  <SelectItem value="http">HTTP</SelectItem>
                  <SelectItem value="tcp">TCP</SelectItem>
                  <SelectItem value="icmp">ICMP (Ping)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="monitor-interval">Check Interval</Label>
              <Select>
                <SelectTrigger id="monitor-interval"><SelectValue placeholder="Interval" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15s">15 seconds</SelectItem>
                  <SelectItem value="30s">30 seconds</SelectItem>
                  <SelectItem value="1m">1 minute</SelectItem>
                  <SelectItem value="5m">5 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="monitor-timeout">Timeout (ms)</Label>
            <Input id="monitor-timeout" type="number" placeholder="5000" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Add Monitor</Button>
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
      <Globe className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No monitors configured</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Add your first uptime monitor to start tracking availability.
      </p>
    </div>
  )
}

export default function UptimeMonitoringPage() {
  const { data, isLoading } = useMonitoringUptime()

  const services = data?.services ?? []
  const monitors: UptimeMonitor[] = services.map((s) => ({
    id: `um-${s.name}`,
    endpoint: `https://${s.name.toLowerCase().replace(/\s+/g, '-')}.example.com/health`,
    name: s.name,
    status: s.status === 'healthy' ? 'up' : s.status === 'degraded' ? 'degraded' : 'down',
    responseTime: s.responseTime,
    uptime: s.uptime,
    lastCheck: "30s ago",
    checkInterval: "30s",
    protocol: "HTTPS",
  }))

  const upCount = monitors.filter((m) => m.status === "up").length
  const degradedCount = monitors.filter((m) => m.status === "degraded").length
  const downCount = monitors.filter((m) => m.status === "down").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Uptime Monitoring</h1>
          <p className="text-muted-foreground mt-1">
            Monitor endpoint availability and response times.
          </p>
        </div>
        <AddMonitorDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-green-500">{upCount}</div>
            <p className="text-sm text-muted-foreground">Up</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-yellow-500">{degradedCount}</div>
            <p className="text-sm text-muted-foreground">Degraded</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-red-500">{downCount}</div>
            <p className="text-sm text-muted-foreground">Down</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : monitors.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Monitors ({monitors.length})</CardTitle>
            <CardDescription>All configured uptime monitors</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={monitors} searchKey="name" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

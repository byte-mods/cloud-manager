"use client"

import { useState } from "react"
import { useMaintenanceWindows } from "@/hooks/use-maintenance-windows"
import {
  Calendar,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Server,
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

type MaintenanceWindow = {
  id: string
  title: string
  startTime: string
  endTime: string
  status: "scheduled" | "in-progress" | "completed" | "cancelled"
  affectedServices: string[]
  createdBy: string
  type: "planned" | "emergency"
}

// Mock data removed — uses useMaintenanceWindows() hook

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  scheduled: { label: "Scheduled", variant: "outline" },
  "in-progress": { label: "In Progress", variant: "secondary", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  completed: { label: "Completed", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
}

function CreateMaintenanceDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Schedule Window</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Schedule Maintenance Window</DialogTitle>
          <DialogDescription>Create a new maintenance window for planned changes.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="mw-title">Title</Label>
            <Input id="mw-title" placeholder="Database Migration" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="mw-start">Start Time</Label>
              <Input id="mw-start" type="datetime-local" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mw-end">End Time</Label>
              <Input id="mw-end" type="datetime-local" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mw-type">Type</Label>
            <Select>
              <SelectTrigger id="mw-type"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mw-services">Affected Services (comma-separated)</Label>
            <Input id="mw-services" placeholder="api-gateway, auth-service" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ChangeManagementPage() {
  const { data: maintenanceWindows } = useMaintenanceWindows()
  const [filter, setFilter] = useState("all")
  const windows: MaintenanceWindow[] = (maintenanceWindows?.windows ?? []) as MaintenanceWindow[]

  const filtered = windows.filter((w) => {
    if (filter === "all") return true
    return w.status === filter
  })

  const scheduledCount = windows.filter((w) => w.status === "scheduled").length
  const inProgressCount = windows.filter((w) => w.status === "in-progress").length
  const completedCount = windows.filter((w) => w.status === "completed").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Change Management</h1>
          <p className="text-muted-foreground mt-1">Schedule and manage maintenance windows for infrastructure changes.</p>
        </div>
        <CreateMaintenanceDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Windows</CardDescription>
            <CardTitle className="text-3xl">{windows.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Scheduled</CardDescription>
            <CardTitle className="text-3xl text-blue-500">{scheduledCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>In Progress</CardDescription>
            <CardTitle className="text-3xl text-yellow-500">{inProgressCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-3xl text-green-500">{completedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Windows</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No maintenance windows found</h3>
            <p className="text-muted-foreground text-sm mt-1">Schedule a maintenance window to plan infrastructure changes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((window) => {
            const config = statusConfig[window.status]
            const start = new Date(window.startTime)
            const end = new Date(window.endTime)
            const durationHrs = ((end.getTime() - start.getTime()) / 3600000).toFixed(1)

            return (
              <Card key={window.id} className={window.status === "in-progress" ? "border-blue-500/30" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{window.title}</h3>
                          {window.type === "emergency" && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="mr-1 h-3 w-3" /> Emergency
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {start.toLocaleString()} - {end.toLocaleTimeString()}
                          </span>
                          <span>({durationHrs}h)</span>
                          <span>by {window.createdBy}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {window.affectedServices.map((svc) => (
                            <Badge key={svc} variant="outline" className="text-xs">
                              <Server className="mr-1 h-3 w-3" /> {svc}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Badge variant={config.variant} className={config.className}>{config.label}</Badge>
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

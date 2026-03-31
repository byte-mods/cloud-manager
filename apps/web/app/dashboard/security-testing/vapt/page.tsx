"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import {
  Scan,
  Plus,
  MoreHorizontal,
  Eye,
  Trash2,
  Download,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
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
import { Progress } from "@/components/ui/progress"
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
import { useVAPTScans } from "@/hooks/use-security-testing"

type VAPTScan = {
  id: string
  name: string
  target: string
  type: "full" | "quick" | "api" | "web-app" | "network"
  status: "completed" | "running" | "scheduled" | "failed"
  findings: { critical: number; high: number; medium: number; low: number }
  startedAt: string
  completedAt: string
  duration: string
}

type ActiveScan = {
  id: string
  name: string
  target: string
  progress: number
  phase: string
  startedAt: string
  estimatedCompletion: string
}


const scanTypeLabels: Record<string, string> = {
  full: "Full Scan",
  quick: "Quick Scan",
  api: "API Scan",
  "web-app": "Web App Scan",
  network: "Network Scan",
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  running: "secondary",
  scheduled: "outline",
  failed: "destructive",
}

const completedColumns: ColumnDef<VAPTScan>[] = [
  { accessorKey: "name", header: "Scan Name", cell: ({ row }) => (
    <Link href={`/dashboard/security-testing/vapt/${row.original.id}`} className="font-medium hover:underline">
      {row.original.name}
    </Link>
  )},
  { accessorKey: "target", header: "Target", cell: ({ row }) => (
    <span className="font-mono text-sm">{row.original.target}</span>
  )},
  { accessorKey: "type", header: "Type", cell: ({ row }) => (
    <Badge variant="outline">{scanTypeLabels[row.original.type]}</Badge>
  )},
  { id: "findings", header: "Findings", cell: ({ row }) => {
    const f = row.original.findings
    const total = f.critical + f.high + f.medium + f.low
    if (row.original.status === "failed") return <span className="text-sm text-muted-foreground">N/A</span>
    return (
      <div className="flex items-center gap-1">
        {f.critical > 0 && <Badge variant="destructive" className="text-xs">{f.critical}C</Badge>}
        {f.high > 0 && <Badge className="text-xs bg-orange-500">{f.high}H</Badge>}
        {f.medium > 0 && <Badge variant="secondary" className="text-xs">{f.medium}M</Badge>}
        {f.low > 0 && <Badge variant="outline" className="text-xs">{f.low}L</Badge>}
        <span className="text-xs text-muted-foreground ml-1">({total})</span>
      </div>
    )
  }},
  { accessorKey: "completedAt", header: "Date", cell: ({ row }) => (
    <span className="text-sm">{row.original.completedAt}</span>
  )},
  { accessorKey: "status", header: "Status", cell: ({ row }) => (
    <Badge variant={statusVariants[row.original.status]}>{row.original.status}</Badge>
  )},
  { id: "actions", header: "", cell: ({ row }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/security-testing/vapt/${row.original.id}`}>
            <Eye className="mr-2 h-4 w-4" /> View Results
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem><Download className="mr-2 h-4 w-4" /> Export Report</DropdownMenuItem>
        <DropdownMenuItem><Play className="mr-2 h-4 w-4" /> Re-run Scan</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )},
]

function NewScanDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> New Scan</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configure New VAPT Scan</DialogTitle>
          <DialogDescription>Set up a new vulnerability assessment and penetration test.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="scan-name">Scan Name</Label>
            <Input id="scan-name" placeholder="Production API Scan" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="scan-target">Target</Label>
            <Input id="scan-target" placeholder="api.example.com or 10.0.0.0/24" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="scan-type">Scan Type</Label>
            <Select>
              <SelectTrigger id="scan-type"><SelectValue placeholder="Select scan type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Scan</SelectItem>
                <SelectItem value="quick">Quick Scan</SelectItem>
                <SelectItem value="api">API Scan</SelectItem>
                <SelectItem value="web-app">Web Application Scan</SelectItem>
                <SelectItem value="network">Network Scan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="scan-schedule">Schedule</Label>
            <Select>
              <SelectTrigger id="scan-schedule"><SelectValue placeholder="Select schedule" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="now">Run Now</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="custom">Custom Schedule</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="scan-auth">Authentication (optional)</Label>
            <Input id="scan-auth" placeholder="Bearer token or API key" type="password" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>
            <Play className="mr-2 h-4 w-4" /> Start Scan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Skeleton className="h-10 w-[180px]" />
        <Skeleton className="h-10 w-[180px]" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Scan className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No scans found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Start by configuring your first VAPT scan.
      </p>
    </div>
  )
}

export default function VAPTPage() {
  const { data, isLoading, error } = useVAPTScans()

  const completedScans: VAPTScan[] = useMemo(() =>
    (data?.scans ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      target: s.target,
      type: s.type as VAPTScan["type"],
      status: s.status as VAPTScan["status"],
      findings: { critical: s.criticalCount, high: s.highCount, medium: Math.max(0, s.findingsCount - s.criticalCount - s.highCount), low: 0 },
      startedAt: s.startedAt,
      completedAt: s.completedAt ?? "",
      duration: "-",
    })),
    [data]
  )

  const activeScans: ActiveScan[] = useMemo(() =>
    (data?.scans ?? [])
      .filter((s) => s.status === "running")
      .map((s) => ({
        id: s.id,
        name: s.name,
        target: s.target,
        progress: 50,
        phase: "Running",
        startedAt: s.startedAt,
        estimatedCompletion: "-",
      })),
    [data]
  )

  if (isLoading) return <div className="space-y-4">{Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">VAPT Scanning</h1>
          <p className="text-muted-foreground mt-1">Vulnerability Assessment and Penetration Testing.</p>
        </div>
        <Card className="border-red-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-red-500">Failed to load VAPT scans. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">VAPT Scanning</h1>
          <p className="text-muted-foreground mt-1">
            Vulnerability Assessment and Penetration Testing.
          </p>
        </div>
        <NewScanDialog />
      </div>

      {activeScans.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Active Scans</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {activeScans.map((scan) => (
              <Card key={scan.id} className="border-blue-500/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{scan.name}</CardTitle>
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3 animate-pulse" /> Running
                    </Badge>
                  </div>
                  <CardDescription className="font-mono">{scan.target}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{scan.phase}</span>
                      <span className="font-medium">{scan.progress}%</span>
                    </div>
                    <Progress value={scan.progress} className="h-2" />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Started: {scan.startedAt}</span>
                    <span>ETA: {scan.estimatedCompletion}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingSkeleton />
      ) : completedScans.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Completed Scans</CardTitle>
            <CardDescription>History of VAPT scan results</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={completedColumns} data={completedScans} searchKey="name" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

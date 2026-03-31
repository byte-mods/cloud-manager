"use client"

import { useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { useGitOps } from "@/hooks/use-devops"
import {
  GitBranch,
  RefreshCw,
  MoreHorizontal,
  RotateCcw,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Heart,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type GitOpsApp = {
  id: string
  name: string
  repo: string
  path: string
  syncStatus: "synced" | "out-of-sync" | "unknown"
  health: "healthy" | "degraded" | "missing" | "progressing"
  lastSynced: string
  targetRevision: string
  namespace: string
}

const syncStatusIcons: Record<string, React.ReactNode> = {
  synced: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  "out-of-sync": <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />,
  unknown: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
}

const syncStatusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  synced: "default",
  "out-of-sync": "secondary",
  unknown: "outline",
}

const healthIcons: Record<string, React.ReactNode> = {
  healthy: <Heart className="h-3.5 w-3.5 text-green-500" />,
  degraded: <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />,
  missing: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  progressing: <RefreshCw className="h-3.5 w-3.5 text-blue-500 animate-spin" />,
}

const healthVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  healthy: "default",
  degraded: "secondary",
  missing: "destructive",
  progressing: "outline",
}

const columns: ColumnDef<GitOpsApp>[] = [
  { accessorKey: "name", header: "App Name", cell: ({ row }) => (
    <span className="font-medium">{row.original.name}</span>
  )},
  { accessorKey: "repo", header: "Repo", cell: ({ row }) => (
    <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{row.original.repo}</code>
  )},
  { accessorKey: "path", header: "Path", cell: ({ row }) => (
    <code className="text-xs text-muted-foreground font-mono">{row.original.path}</code>
  )},
  { accessorKey: "syncStatus", header: "Sync Status", cell: ({ row }) => (
    <div className="flex items-center gap-1.5">
      {syncStatusIcons[row.original.syncStatus]}
      <Badge variant={syncStatusVariants[row.original.syncStatus]} className="text-xs capitalize">
        {row.original.syncStatus === "out-of-sync" ? "Out of Sync" : row.original.syncStatus}
      </Badge>
    </div>
  )},
  { accessorKey: "health", header: "Health", cell: ({ row }) => (
    <div className="flex items-center gap-1.5">
      {healthIcons[row.original.health]}
      <Badge variant={healthVariants[row.original.health]} className="text-xs capitalize">
        {row.original.health}
      </Badge>
    </div>
  )},
  { accessorKey: "lastSynced", header: "Last Synced", cell: ({ row }) => (
    <span className="text-sm text-muted-foreground">{row.original.lastSynced}</span>
  )},
  { id: "actions", header: "", cell: ({ row }) => (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
        <RotateCcw className="mr-1 h-3 w-3" /> Sync
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
          <DropdownMenuItem><RefreshCw className="mr-2 h-4 w-4" /> Hard Refresh</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem><RotateCcw className="mr-2 h-4 w-4" /> Rollback</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )},
]

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
      <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No GitOps applications</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Connect your first repository to start managing applications with GitOps.
      </p>
    </div>
  )
}

export default function GitOpsPage() {
  const { data, isLoading, error } = useGitOps()
  const apps: GitOpsApp[] = (data?.apps ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    repo: a.repository,
    path: a.path,
    syncStatus: a.syncStatus === "out-of-sync" ? "out-of-sync" : a.syncStatus === "synced" ? "synced" : "unknown",
    health: a.healthStatus === "healthy" ? "healthy" : a.healthStatus === "degraded" ? "degraded" : a.healthStatus === "missing" ? "missing" : "progressing",
    lastSynced: a.lastSyncedAt ?? "Never",
    targetRevision: a.targetRevision,
    namespace: a.namespace,
  }))

  const syncedCount = apps.filter((a) => a.syncStatus === "synced").length
  const outOfSyncCount = apps.filter((a) => a.syncStatus === "out-of-sync").length
  const healthyCount = apps.filter((a) => a.health === "healthy").length

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">GitOps</h1>
          <p className="text-muted-foreground mt-1">Git-based application deployment and synchronization.</p>
        </div>
        <div className="text-destructive text-sm">Failed to load GitOps data. Please try again later.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">GitOps</h1>
          <p className="text-muted-foreground mt-1">
            Git-based application deployment and synchronization.
          </p>
        </div>
        <Button variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh All
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">{apps.length}</div>
            <p className="text-sm text-muted-foreground">Total Apps</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-green-500">{syncedCount}</div>
            <p className="text-sm text-muted-foreground">Synced</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-yellow-500">{outOfSyncCount}</div>
            <p className="text-sm text-muted-foreground">Out of Sync</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-green-500">{healthyCount}</div>
            <p className="text-sm text-muted-foreground">Healthy</p>
          </CardContent>
        </Card>
      </div>

      {/* GitOps Provider Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>GitOps Provider</CardTitle>
              <CardDescription>ArgoCD and Flux controller configuration</CardDescription>
            </div>
            <Badge variant="default" className="gap-1">ArgoCD v2.12</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-muted-foreground text-xs">Controller</p><p className="font-medium">ArgoCD</p></div>
            <div><p className="text-muted-foreground text-xs">Server</p><p className="font-mono text-xs">argocd.internal:443</p></div>
            <div><p className="text-muted-foreground text-xs">Sync Policy</p><p className="font-medium">Auto-sync (prune enabled)</p></div>
            <div><p className="text-muted-foreground text-xs">Retry Policy</p><p className="font-medium">3 retries, 5s backoff</p></div>
            <div><p className="text-muted-foreground text-xs">Self-heal</p><Badge variant="default" className="text-[10px] h-5">Enabled</Badge></div>
            <div><p className="text-muted-foreground text-xs">Flux Fallback</p><Badge variant="secondary" className="text-[10px] h-5">Standby</Badge></div>
            <div><p className="text-muted-foreground text-xs">Default Cluster</p><p className="font-mono text-xs">prod-eks-cluster</p></div>
            <div><p className="text-muted-foreground text-xs">Notification</p><p className="font-medium">Slack #deploys</p></div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton />
      ) : apps.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Applications ({apps.length})</CardTitle>
            <CardDescription>GitOps-managed applications and their sync status</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={apps} searchKey="name" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

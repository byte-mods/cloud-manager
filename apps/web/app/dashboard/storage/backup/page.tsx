"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Shield,
  Cloud,
  Filter,
  MoreHorizontal,
  Trash2,
  Play,
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
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
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
import { useResources, type Resource } from "@/hooks/use-resources"

type BackupPlan = Resource & {
  metadata?: {
    resources?: number
    schedule?: string
    lastBackup?: string
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  completed: "default",
  running: "outline",
  failed: "destructive",
  disabled: "secondary",
}

const columns: ColumnDef<BackupPlan>[] = [
  {
    accessorKey: "name",
    header: "Backup Plan",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
  },
  {
    id: "resources",
    header: "Resources",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.metadata?.resources ?? 0} resource{(row.original.metadata?.resources ?? 0) !== 1 ? "s" : ""}
      </span>
    ),
  },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Cloud className="h-4 w-4" />
        <span className="uppercase text-xs font-medium">{row.original.provider}</span>
      </div>
    ),
  },
  {
    id: "schedule",
    header: "Schedule",
    cell: ({ row }) => (
      <span className="text-sm font-mono">
        {row.original.metadata?.schedule ?? "-"}
      </span>
    ),
  },
  {
    id: "lastBackup",
    header: "Last Backup",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.metadata?.lastBackup ?? "Never"}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status
      return (
        <Badge variant={statusVariants[status] ?? "outline"}>
          {status}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <Play className="mr-2 h-4 w-4" /> Run Now
          </DropdownMenuItem>
          <DropdownMenuItem>
            <RotateCcw className="mr-2 h-4 w-4" /> Restore
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-[180px]" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Shield className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No backup plans found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        No backup plans have been configured yet.
      </p>
    </div>
  )
}

export default function BackupManagementPage() {
  const { data, isLoading } = useResources("storage/backup")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const backups = (data?.resources ?? []) as BackupPlan[]

  const filtered = useMemo(() => {
    return backups.filter((b) => {
      if (providerFilter !== "all" && b.provider !== providerFilter) return false
      if (statusFilter !== "all" && b.status !== statusFilter) return false
      return true
    })
  }, [backups, providerFilter, statusFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Backup Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage backup plans, schedules, and recovery points.
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : backups.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filtered.length} Backup Plan{filtered.length !== 1 ? "s" : ""}
            </CardTitle>
            <CardDescription>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span className="text-sm">Filters:</span>
                </div>
                <Select value={providerFilter} onValueChange={setProviderFilter}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="gcp">GCP</SelectItem>
                    <SelectItem value="azure">Azure</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={filtered} searchKey="name" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

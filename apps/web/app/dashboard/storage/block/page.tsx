"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Database,
  Cloud,
  Filter,
  MoreHorizontal,
  Trash2,
  Settings,
  Unplug,
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

type BlockVolume = Resource & {
  metadata?: {
    size?: string
    volumeType?: string
    iops?: number
    attachedTo?: string
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "in-use": "default",
  available: "secondary",
  creating: "outline",
  deleting: "destructive",
  error: "destructive",
}

const columns: ColumnDef<BlockVolume>[] = [
  {
    accessorKey: "name",
    header: "Volume Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
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
    id: "size",
    header: "Size",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.metadata?.size ?? "-"}</span>
    ),
  },
  {
    id: "type",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant="outline">
        {row.original.metadata?.volumeType ?? "-"}
      </Badge>
    ),
  },
  {
    id: "iops",
    header: "IOPS",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.metadata?.iops?.toLocaleString() ?? "-"}
      </span>
    ),
  },
  {
    id: "attachedTo",
    header: "Attached To",
    cell: ({ row }) => (
      <span className="text-sm font-mono">
        {row.original.metadata?.attachedTo ?? "Unattached"}
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
            <Settings className="mr-2 h-4 w-4" /> Modify
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Unplug className="mr-2 h-4 w-4" /> Detach
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
      <div className="flex gap-4">
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
      <Database className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No block volumes found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        No block storage volumes have been created yet.
      </p>
    </div>
  )
}

export default function BlockStoragePage() {
  const { data, isLoading } = useResources("storage/block")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const volumes = (data?.resources ?? []) as BlockVolume[]

  const filtered = useMemo(() => {
    return volumes.filter((vol) => {
      if (providerFilter !== "all" && vol.provider !== providerFilter) return false
      if (statusFilter !== "all" && vol.status !== statusFilter) return false
      return true
    })
  }, [volumes, providerFilter, statusFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Block Storage</h1>
        <p className="text-muted-foreground mt-1">
          Manage EBS volumes, Persistent Disks, and Managed Disks.
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : volumes.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filtered.length} Volume{filtered.length !== 1 ? "s" : ""}
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
                    <SelectItem value="in-use">In Use</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
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

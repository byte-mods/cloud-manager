"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Zap,
  Cloud,
  Filter,
  MoreHorizontal,
  Trash2,
  Settings,
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

type CacheCluster = Resource & {
  metadata?: {
    engine?: string
    nodes?: number
    memory?: string
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  creating: "outline",
  modifying: "outline",
  deleting: "destructive",
  error: "destructive",
}

const columns: ColumnDef<CacheCluster>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
  },
  {
    id: "engine",
    header: "Engine",
    cell: ({ row }) => {
      const engine = row.original.metadata?.engine ?? "redis"
      return (
        <Badge variant={engine === "redis" ? "default" : "secondary"}>
          {engine}
        </Badge>
      )
    },
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
    id: "nodes",
    header: "Nodes",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.metadata?.nodes ?? 1}
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
    id: "memory",
    header: "Memory",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.metadata?.memory ?? "-"}
      </span>
    ),
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
            <Settings className="mr-2 h-4 w-4" /> Configure
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
      <Zap className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No cache clusters found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        No in-memory cache clusters have been created yet.
      </p>
    </div>
  )
}

export default function CachePage() {
  const { data, isLoading } = useResources("databases/cache")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [engineFilter, setEngineFilter] = useState<string>("all")

  const clusters = (data?.resources ?? []) as CacheCluster[]

  const filtered = useMemo(() => {
    return clusters.filter((c) => {
      if (providerFilter !== "all" && c.provider !== providerFilter) return false
      if (engineFilter !== "all" && c.metadata?.engine !== engineFilter) return false
      return true
    })
  }, [clusters, providerFilter, engineFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">In-Memory Caches</h1>
        <p className="text-muted-foreground mt-1">
          Manage Redis and Memcached clusters across providers.
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : clusters.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filtered.length} Cluster{filtered.length !== 1 ? "s" : ""}
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
                <Select value={engineFilter} onValueChange={setEngineFilter}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue placeholder="Engine" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Engines</SelectItem>
                    <SelectItem value="redis">Redis</SelectItem>
                    <SelectItem value="memcached">Memcached</SelectItem>
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

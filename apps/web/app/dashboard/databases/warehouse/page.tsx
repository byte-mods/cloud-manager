"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Warehouse,
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

type DataWarehouse = Resource & {
  metadata?: {
    warehouseType?: string
    nodes?: number
    storageUsed?: string
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  active: "default",
  paused: "secondary",
  creating: "outline",
  deleting: "destructive",
  error: "destructive",
}

const columns: ColumnDef<DataWarehouse>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
  },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => {
      const provider = row.original.provider
      const warehouseType = row.original.metadata?.warehouseType ?? "-"
      return (
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4" />
          <span className="uppercase text-xs font-medium">{provider}</span>
          <Badge variant="outline" className="text-xs">{warehouseType}</Badge>
        </div>
      )
    },
  },
  {
    id: "nodes",
    header: "Nodes",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.metadata?.nodes ?? "-"}
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
    id: "storageUsed",
    header: "Storage Used",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.metadata?.storageUsed ?? "-"}
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
      <Warehouse className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No data warehouses found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        No data warehouse clusters have been created yet.
      </p>
    </div>
  )
}

export default function DataWarehousePage() {
  const { data, isLoading } = useResources("databases/warehouse")
  const [providerFilter, setProviderFilter] = useState<string>("all")

  const warehouses = (data?.resources ?? []) as DataWarehouse[]

  const filtered = useMemo(() => {
    return warehouses.filter((w) => {
      if (providerFilter !== "all" && w.provider !== providerFilter) return false
      return true
    })
  }, [warehouses, providerFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Warehouses</h1>
        <p className="text-muted-foreground mt-1">
          Manage Redshift, BigQuery, and Synapse clusters.
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : warehouses.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filtered.length} Warehouse{filtered.length !== 1 ? "s" : ""}
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
                    <SelectItem value="aws">AWS (Redshift)</SelectItem>
                    <SelectItem value="gcp">GCP (BigQuery)</SelectItem>
                    <SelectItem value="azure">Azure (Synapse)</SelectItem>
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

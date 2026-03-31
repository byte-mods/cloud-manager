"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Radio,
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

type CDNDistribution = Resource & {
  metadata?: {
    domain?: string
    origin?: string
    cacheHitRate?: number
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  deployed: "default",
  active: "default",
  in_progress: "outline",
  disabled: "secondary",
  error: "destructive",
}

const columns: ColumnDef<CDNDistribution>[] = [
  {
    accessorKey: "name",
    header: "Distribution",
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
    id: "domain",
    header: "Domain",
    cell: ({ row }) => (
      <span className="text-sm font-mono truncate max-w-[220px] block">
        {row.original.metadata?.domain ?? "-"}
      </span>
    ),
  },
  {
    id: "origin",
    header: "Origin",
    cell: ({ row }) => (
      <span className="text-sm font-mono truncate max-w-[200px] block">
        {row.original.metadata?.origin ?? "-"}
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
    id: "cacheHitRate",
    header: "Cache Hit Rate",
    cell: ({ row }) => {
      const rate = row.original.metadata?.cacheHitRate
      return (
        <span className="text-sm">
          {rate != null ? `${rate.toFixed(1)}%` : "-"}
        </span>
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
      <Radio className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No CDN distributions found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        No content delivery network distributions have been created yet.
      </p>
    </div>
  )
}

export default function CDNPage() {
  const { data, isLoading } = useResources("networking/cdn")
  const [providerFilter, setProviderFilter] = useState<string>("all")

  const distributions = (data?.resources ?? []) as CDNDistribution[]

  const filtered = useMemo(() => {
    return distributions.filter((d) => {
      if (providerFilter !== "all" && d.provider !== providerFilter) return false
      return true
    })
  }, [distributions, providerFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CDN Distributions</h1>
        <p className="text-muted-foreground mt-1">
          Manage CloudFront, Cloud CDN, and Azure CDN distributions.
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : distributions.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filtered.length} Distribution{filtered.length !== 1 ? "s" : ""}
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

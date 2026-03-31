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

type LoadBalancer = Resource & {
  metadata?: {
    lbType?: string
    dnsName?: string
    targets?: number
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  provisioning: "outline",
  failed: "destructive",
  deleting: "destructive",
}

const typeVariants: Record<string, "default" | "secondary" | "outline"> = {
  ALB: "default",
  NLB: "secondary",
  CLB: "outline",
}

const columns: ColumnDef<LoadBalancer>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
  },
  {
    id: "lbType",
    header: "Type",
    cell: ({ row }) => {
      const lbType = row.original.metadata?.lbType ?? "ALB"
      return (
        <Badge variant={typeVariants[lbType] ?? "outline"}>
          {lbType}
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
    id: "dnsName",
    header: "DNS Name",
    cell: ({ row }) => (
      <span className="text-sm font-mono truncate max-w-[250px] block">
        {row.original.metadata?.dnsName ?? "-"}
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
    id: "targets",
    header: "Targets",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.metadata?.targets ?? 0}
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
      <h3 className="text-lg font-semibold">No load balancers found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        No load balancers have been created yet.
      </p>
    </div>
  )
}

export default function LoadBalancersPage() {
  const { data, isLoading } = useResources("networking/load-balancers")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")

  const lbs = (data?.resources ?? []) as LoadBalancer[]

  const filtered = useMemo(() => {
    return lbs.filter((lb) => {
      if (providerFilter !== "all" && lb.provider !== providerFilter) return false
      if (typeFilter !== "all" && lb.metadata?.lbType !== typeFilter) return false
      return true
    })
  }, [lbs, providerFilter, typeFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Load Balancers</h1>
        <p className="text-muted-foreground mt-1">
          Manage application, network, and classic load balancers.
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : lbs.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filtered.length} Load Balancer{filtered.length !== 1 ? "s" : ""}
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
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="ALB">ALB</SelectItem>
                    <SelectItem value="NLB">NLB</SelectItem>
                    <SelectItem value="CLB">CLB</SelectItem>
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

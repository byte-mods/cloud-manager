"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import {
  Server,
  Plus,
  Play,
  Square,
  Trash2,
  MoreHorizontal,
  Cloud,
  Filter,
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

type Instance = Resource & {
  metadata?: {
    instanceType?: string
    publicIp?: string
    privateIp?: string
    costPerMonth?: number
    az?: string
  }
}

const providerIcons: Record<string, string> = {
  aws: "/icons/aws.svg",
  gcp: "/icons/gcp.svg",
  azure: "/icons/azure.svg",
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  running: "default",
  stopped: "secondary",
  terminated: "destructive",
  pending: "outline",
  stopping: "outline",
}

const columns: ColumnDef<Instance>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllPageRowsSelected()}
        onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
        aria-label="Select all"
        className="h-4 w-4 rounded border-gray-300"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={(e) => row.toggleSelected(e.target.checked)}
        aria-label="Select row"
        className="h-4 w-4 rounded border-gray-300"
      />
    ),
    enableSorting: false,
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <Link
        href={`/dashboard/compute/instances/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => {
      const provider = row.original.provider
      return (
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4" />
          <span className="uppercase text-xs font-medium">{provider}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.metadata?.instanceType ?? row.original.type}
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
    accessorKey: "region",
    header: "Region",
  },
  {
    id: "ip",
    header: "IP",
    cell: ({ row }) => (
      <span className="text-sm font-mono">
        {row.original.metadata?.publicIp ?? row.original.metadata?.privateIp ?? "-"}
      </span>
    ),
  },
  {
    id: "cost",
    header: "Cost/mo",
    cell: ({ row }) => {
      const cost = row.original.metadata?.costPerMonth
      return (
        <span className="text-sm">
          {cost != null ? `$${cost.toFixed(2)}` : "-"}
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
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/compute/instances/${row.original.id}`}>
              View Details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Play className="mr-2 h-4 w-4" /> Start
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Square className="mr-2 h-4 w-4" /> Stop
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Terminate
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
      <Server className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No instances found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Get started by creating your first compute instance.
      </p>
      <Button asChild>
        <Link href="/dashboard/compute/instances/create">
          <Plus className="mr-2 h-4 w-4" />
          Create Instance
        </Link>
      </Button>
    </div>
  )
}

export default function InstancesPage() {
  const { data, isLoading } = useResources("compute/instances")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  const instances = (data?.resources ?? []) as Instance[]

  const filteredInstances = useMemo(() => {
    return instances.filter((instance) => {
      if (providerFilter !== "all" && instance.provider !== providerFilter) return false
      if (statusFilter !== "all" && instance.status !== statusFilter) return false
      if (regionFilter !== "all" && instance.region !== regionFilter) return false
      return true
    })
  }, [instances, providerFilter, statusFilter, regionFilter])

  const regions = useMemo(
    () => [...new Set(instances.map((i) => i.region))],
    [instances]
  )

  const hasSelection = selectedRows.size > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Instances</h1>
          <p className="text-muted-foreground mt-1">
            Manage virtual machine instances across all providers.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/compute/instances/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Instance
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : instances.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filteredInstances.length} Instance{filteredInstances.length !== 1 ? "s" : ""}
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
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="stopped">Stopped</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={regionFilter} onValueChange={setRegionFilter}>
                  <SelectTrigger className="w-[160px] h-8">
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {regions.map((region) => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasSelection && (
              <div className="flex items-center gap-2 mb-4 p-3 rounded-md bg-muted">
                <span className="text-sm font-medium">
                  {selectedRows.size} selected
                </span>
                <Button variant="outline" size="sm">
                  <Play className="mr-1 h-3 w-3" /> Start
                </Button>
                <Button variant="outline" size="sm">
                  <Square className="mr-1 h-3 w-3" /> Stop
                </Button>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-1 h-3 w-3" /> Terminate
                </Button>
              </div>
            )}
            <DataTable
              columns={columns}
              data={filteredInstances}
              searchKey="name"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

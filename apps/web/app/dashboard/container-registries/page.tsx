"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import {
  Container,
  Plus,
  Trash2,
  MoreHorizontal,
  Cloud,
  Filter,
  Eye,
  ScanLine,
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

type Registry = Resource & {
  metadata?: {
    imagesCount?: number
    sizeBytes?: number
    scanStatus?: string
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  inactive: "secondary",
  deleting: "destructive",
  creating: "outline",
}

const scanStatusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  complete: "default",
  in_progress: "outline",
  failed: "destructive",
  not_scanned: "secondary",
}

function formatSize(bytes?: number): string {
  if (bytes == null) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const columns: ColumnDef<Registry>[] = [
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
        href={`/dashboard/container-registries/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.name}
      </Link>
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
    accessorKey: "region",
    header: "Region",
  },
  {
    id: "imagesCount",
    header: "Images Count",
    cell: ({ row }) => (
      <span className="text-sm font-mono">
        {row.original.metadata?.imagesCount?.toLocaleString() ?? "0"}
      </span>
    ),
  },
  {
    id: "size",
    header: "Size",
    cell: ({ row }) => (
      <span className="text-sm">
        {formatSize(row.original.metadata?.sizeBytes)}
      </span>
    ),
  },
  {
    id: "scanStatus",
    header: "Scan Status",
    cell: ({ row }) => {
      const scanStatus = row.original.metadata?.scanStatus ?? "not_scanned"
      return (
        <Badge variant={scanStatusVariants[scanStatus] ?? "outline"}>
          {scanStatus.replace(/_/g, " ")}
        </Badge>
      )
    },
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
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/container-registries/${row.original.id}`}>
              <Eye className="mr-2 h-4 w-4" /> View Details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <ScanLine className="mr-2 h-4 w-4" /> Scan Images
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
      <Container className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No container registries found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Get started by creating your first container registry.
      </p>
      <Button asChild>
        <Link href="/dashboard/container-registries/create">
          <Plus className="mr-2 h-4 w-4" />
          Create Registry
        </Link>
      </Button>
    </div>
  )
}

export default function ContainerRegistriesPage() {
  const { data, isLoading } = useResources("container-registries")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [regionFilter, setRegionFilter] = useState<string>("all")

  const registries = (data?.resources ?? []) as Registry[]

  const filteredRegistries = useMemo(() => {
    return registries.filter((registry) => {
      if (providerFilter !== "all" && registry.provider !== providerFilter) return false
      if (statusFilter !== "all" && registry.status !== statusFilter) return false
      if (regionFilter !== "all" && registry.region !== regionFilter) return false
      return true
    })
  }, [registries, providerFilter, statusFilter, regionFilter])

  const regions = useMemo(
    () => [...new Set(registries.map((r) => r.region))],
    [registries]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Container Registries</h1>
          <p className="text-muted-foreground mt-1">
            Manage container image registries across all providers.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/container-registries/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Registry
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : registries.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filteredRegistries.length} Registr{filteredRegistries.length !== 1 ? "ies" : "y"}
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
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="creating">Creating</SelectItem>
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
            <DataTable
              columns={columns}
              data={filteredRegistries}
              searchKey="name"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

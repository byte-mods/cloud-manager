"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import {
  FolderOpen,
  Plus,
  MoreHorizontal,
  Trash2,
  Cloud,
  Filter,
  Settings,
  Eye,
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

type Bucket = Resource & {
  metadata?: {
    objectsCount?: number
    size?: string
    accessLevel?: string
    storageClass?: string
  }
}

const accessVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  private: "default",
  "public-read": "destructive",
  "authenticated-read": "secondary",
}

const columns: ColumnDef<Bucket>[] = [
  {
    accessorKey: "name",
    header: "Bucket Name",
    cell: ({ row }) => (
      <Link
        href={`/dashboard/storage/object/${row.original.id}`}
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
    id: "objectsCount",
    header: "Objects",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.metadata?.objectsCount?.toLocaleString() ?? "-"}
      </span>
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
    id: "accessLevel",
    header: "Access Level",
    cell: ({ row }) => {
      const access = row.original.metadata?.accessLevel ?? "private"
      return (
        <Badge variant={accessVariants[access] ?? "outline"}>
          {access}
        </Badge>
      )
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.createdAt}</span>
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
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/storage/object/${row.original.id}`}>
              <Eye className="mr-2 h-4 w-4" /> Browse Files
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" /> Settings
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
      <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No buckets found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Get started by creating your first storage bucket.
      </p>
      <Button asChild>
        <Link href="/dashboard/storage/object/create">
          <Plus className="mr-2 h-4 w-4" />
          Create Bucket
        </Link>
      </Button>
    </div>
  )
}

export default function ObjectStoragePage() {
  const { data, isLoading } = useResources("storage/object")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [regionFilter, setRegionFilter] = useState<string>("all")

  const buckets = (data?.resources ?? []) as Bucket[]

  const filteredBuckets = useMemo(() => {
    return buckets.filter((bucket) => {
      if (providerFilter !== "all" && bucket.provider !== providerFilter) return false
      if (regionFilter !== "all" && bucket.region !== regionFilter) return false
      return true
    })
  }, [buckets, providerFilter, regionFilter])

  const regions = useMemo(
    () => [...new Set(buckets.map((b) => b.region))],
    [buckets]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Object Storage</h1>
          <p className="text-muted-foreground mt-1">
            Manage S3 buckets, GCS buckets, and Azure Blob containers.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/storage/object/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Bucket
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : buckets.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filteredBuckets.length} Bucket{filteredBuckets.length !== 1 ? "s" : ""}
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
              data={filteredBuckets}
              searchKey="name"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

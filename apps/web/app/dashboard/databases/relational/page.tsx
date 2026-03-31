"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import {
  Database,
  Plus,
  MoreHorizontal,
  Trash2,
  Cloud,
  Filter,
  Eye,
  Square,
  Play,
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

type RelationalDB = Resource & {
  metadata?: {
    engine?: string
    version?: string
    instanceClass?: string
    endpoint?: string
    storage?: string
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  running: "default",
  stopped: "secondary",
  creating: "outline",
  deleting: "destructive",
  failed: "destructive",
  "modifying": "outline",
}

const engineColors: Record<string, string> = {
  mysql: "bg-blue-500/10 text-blue-700",
  postgresql: "bg-indigo-500/10 text-indigo-700",
  "sql-server": "bg-red-500/10 text-red-700",
  mariadb: "bg-teal-500/10 text-teal-700",
}

const columns: ColumnDef<RelationalDB>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <Link
        href={`/dashboard/databases/relational/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    id: "engine",
    header: "Engine",
    cell: ({ row }) => {
      const engine = row.original.metadata?.engine ?? "postgresql"
      return (
        <span className={`text-xs font-medium px-2 py-1 rounded ${engineColors[engine] ?? ""}`}>
          {engine} {row.original.metadata?.version ?? ""}
        </span>
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
    id: "size",
    header: "Size",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.metadata?.instanceClass ?? "-"}
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
    id: "endpoint",
    header: "Endpoint",
    cell: ({ row }) => (
      <span className="text-sm font-mono truncate max-w-[200px] block">
        {row.original.metadata?.endpoint ?? "-"}
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
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/databases/relational/${row.original.id}`}>
              <Eye className="mr-2 h-4 w-4" /> View Details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Play className="mr-2 h-4 w-4" /> Start
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Square className="mr-2 h-4 w-4" /> Stop
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
      <Database className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No databases found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Get started by creating your first relational database.
      </p>
      <Button asChild>
        <Link href="/dashboard/databases/relational/create">
          <Plus className="mr-2 h-4 w-4" />
          Create Database
        </Link>
      </Button>
    </div>
  )
}

export default function RelationalDBPage() {
  const { data, isLoading } = useResources("databases/relational")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [engineFilter, setEngineFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const databases = (data?.resources ?? []) as RelationalDB[]

  const filtered = useMemo(() => {
    return databases.filter((db) => {
      if (providerFilter !== "all" && db.provider !== providerFilter) return false
      if (engineFilter !== "all" && db.metadata?.engine !== engineFilter) return false
      if (statusFilter !== "all" && db.status !== statusFilter) return false
      return true
    })
  }, [databases, providerFilter, engineFilter, statusFilter])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relational Databases</h1>
          <p className="text-muted-foreground mt-1">
            Manage MySQL, PostgreSQL, and SQL Server instances.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/databases/relational/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Database
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : databases.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filtered.length} Database{filtered.length !== 1 ? "s" : ""}
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
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="postgresql">PostgreSQL</SelectItem>
                    <SelectItem value="sql-server">SQL Server</SelectItem>
                    <SelectItem value="mariadb">MariaDB</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="stopped">Stopped</SelectItem>
                    <SelectItem value="creating">Creating</SelectItem>
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

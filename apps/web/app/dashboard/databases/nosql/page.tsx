"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Layers,
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

type NoSQLDB = Resource & {
  metadata?: {
    dbType?: string
    items?: number
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  available: "default",
  creating: "outline",
  deleting: "destructive",
  error: "destructive",
}

const typeColors: Record<string, string> = {
  Document: "bg-blue-500/10 text-blue-700",
  "Key-Value": "bg-green-500/10 text-green-700",
  Graph: "bg-purple-500/10 text-purple-700",
  "Wide-Column": "bg-orange-500/10 text-orange-700",
}

const columns: ColumnDef<NoSQLDB>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
  },
  {
    id: "dbType",
    header: "Type",
    cell: ({ row }) => {
      const dbType = row.original.metadata?.dbType ?? "Document"
      return (
        <span className={`text-xs font-medium px-2 py-1 rounded ${typeColors[dbType] ?? ""}`}>
          {dbType}
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
    id: "items",
    header: "Items/Documents",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.metadata?.items?.toLocaleString() ?? "-"}
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
      <Layers className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No NoSQL databases found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        No NoSQL databases have been created yet.
      </p>
    </div>
  )
}

export default function NoSQLPage() {
  const { data, isLoading } = useResources("databases/nosql")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")

  const databases = (data?.resources ?? []) as NoSQLDB[]

  const filtered = useMemo(() => {
    return databases.filter((db) => {
      if (providerFilter !== "all" && db.provider !== providerFilter) return false
      if (typeFilter !== "all" && db.metadata?.dbType !== typeFilter) return false
      return true
    })
  }, [databases, providerFilter, typeFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">NoSQL Databases</h1>
        <p className="text-muted-foreground mt-1">
          Manage DynamoDB, Firestore, Cosmos DB, and other NoSQL databases.
        </p>
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
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Document">Document</SelectItem>
                    <SelectItem value="Key-Value">Key-Value</SelectItem>
                    <SelectItem value="Graph">Graph</SelectItem>
                    <SelectItem value="Wide-Column">Wide-Column</SelectItem>
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

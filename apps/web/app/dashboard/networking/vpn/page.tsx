"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Lock,
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

type VPNConnection = Resource & {
  metadata?: {
    vpnType?: string
    remoteIp?: string
    tunnels?: number
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  up: "default",
  down: "destructive",
  pending: "outline",
  deleting: "destructive",
}

const columns: ColumnDef<VPNConnection>[] = [
  {
    accessorKey: "name",
    header: "Connection Name",
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
    id: "vpnType",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant="outline">
        {row.original.metadata?.vpnType ?? "Site-to-Site"}
      </Badge>
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
    id: "remoteIp",
    header: "Remote IP",
    cell: ({ row }) => (
      <span className="text-sm font-mono">
        {row.original.metadata?.remoteIp ?? "-"}
      </span>
    ),
  },
  {
    id: "tunnels",
    header: "Tunnels",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.metadata?.tunnels ?? 0}
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
      <Lock className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No VPN connections found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        No VPN connections have been configured yet.
      </p>
    </div>
  )
}

export default function VPNPage() {
  const { data, isLoading } = useResources("networking/vpn")
  const [providerFilter, setProviderFilter] = useState<string>("all")

  const connections = (data?.resources ?? []) as VPNConnection[]

  const filtered = useMemo(() => {
    return connections.filter((c) => {
      if (providerFilter !== "all" && c.provider !== providerFilter) return false
      return true
    })
  }, [connections, providerFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">VPN Connections</h1>
        <p className="text-muted-foreground mt-1">
          Manage site-to-site and client VPN connections.
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : connections.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filtered.length} Connection{filtered.length !== 1 ? "s" : ""}
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

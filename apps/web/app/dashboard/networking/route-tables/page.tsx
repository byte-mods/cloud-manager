"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Route,
  Plus,
  MoreHorizontal,
  Trash2,
  Cloud,
  Filter,
  Eye,
  Settings,
  ChevronDown,
  ChevronRight,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useResources, type Resource } from "@/hooks/use-resources"

type RouteEntry = {
  destination: string
  target: string
  status: string
}

type RouteTable = Resource & {
  metadata?: {
    vpcId?: string
    routes?: RouteEntry[]
    associations?: number
    isMain?: boolean
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  available: "default",
  creating: "outline",
  deleting: "destructive",
}

function ExpandableRoutesRow({ routes }: { routes: RouteEntry[] }) {
  return (
    <div className="p-4 bg-muted/50 rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Destination</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {routes.map((route, idx) => (
            <TableRow key={idx}>
              <TableCell className="font-mono text-sm">{route.destination}</TableCell>
              <TableCell className="font-mono text-sm">{route.target}</TableCell>
              <TableCell>
                <Badge variant={route.status === "active" ? "default" : "outline"}>
                  {route.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default function RouteTablesPage() {
  const { data, isLoading } = useResources("networking/route-tables")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formVpcId, setFormVpcId] = useState("")
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const routeTables = (data?.resources ?? []) as RouteTable[]

  const filtered = useMemo(() => {
    return routeTables.filter((rt) => {
      if (providerFilter !== "all" && rt.provider !== providerFilter) return false
      if (regionFilter !== "all" && rt.region !== regionFilter) return false
      return true
    })
  }, [routeTables, providerFilter, regionFilter])

  const regions = useMemo(
    () => [...new Set(routeTables.map((r) => r.region))],
    [routeTables]
  )

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const columns: ColumnDef<RouteTable>[] = [
    {
      id: "expand",
      header: "",
      cell: ({ row }) => {
        const routes = row.original.metadata?.routes ?? []
        if (routes.length === 0) return null
        const isExpanded = expandedRows.has(row.original.id)
        return (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => toggleRow(row.original.id)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        )
      },
    },
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
      id: "vpc",
      header: "VPC",
      cell: ({ row }) => (
        <span className="text-sm font-mono">
          {row.original.metadata?.vpcId ?? "-"}
        </span>
      ),
    },
    {
      id: "routesCount",
      header: "Routes Count",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.metadata?.routes?.length ?? 0}
        </span>
      ),
    },
    {
      id: "associations",
      header: "Associations",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.metadata?.associations ?? 0}
        </span>
      ),
    },
    {
      id: "isMain",
      header: "Main",
      cell: ({ row }) => (
        <Badge variant={row.original.metadata?.isMain ? "default" : "outline"}>
          {row.original.metadata?.isMain ? "Yes" : "No"}
        </Badge>
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
              <Eye className="mr-2 h-4 w-4" /> View Details
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" /> Edit Routes
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Route Tables</h1>
          <p className="text-muted-foreground mt-1">
            Manage route tables and routing rules for your VPCs.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Route Table
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Route Table</DialogTitle>
              <DialogDescription>
                Create a new route table for a VPC.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="rt-vpc">VPC ID</Label>
                <Input
                  id="rt-vpc"
                  placeholder="e.g. vpc-0abc123def456"
                  value={formVpcId}
                  onChange={(e) => setFormVpcId(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setDialogOpen(false)}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="flex gap-4">
            <Skeleton className="h-10 w-[180px]" />
            <Skeleton className="h-10 w-[180px]" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : routeTables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Route className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No Route Tables found</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">
            Create a route table to manage traffic routing in your VPC.
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Route Table
          </Button>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filtered.length} Route Table{filtered.length !== 1 ? "s" : ""}
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
          <CardContent className="space-y-2">
            <DataTable columns={columns} data={filtered} searchKey="name" />
            {filtered
              .filter((rt) => expandedRows.has(rt.id) && (rt.metadata?.routes?.length ?? 0) > 0)
              .map((rt) => (
                <div key={rt.id} className="ml-8">
                  <p className="text-sm font-medium mb-2">Routes for {rt.name}:</p>
                  <ExpandableRoutesRow routes={rt.metadata!.routes!} />
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

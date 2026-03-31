"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Network,
  Plus,
  MoreHorizontal,
  Trash2,
  Cloud,
  Filter,
  Eye,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

type NATGateway = Resource & {
  metadata?: {
    subnetId?: string
    elasticIp?: string
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  active: "default",
  creating: "outline",
  deleting: "destructive",
  deleted: "destructive",
  failed: "destructive",
  pending: "outline",
}

const columns: ColumnDef<NATGateway>[] = [
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
    id: "subnet",
    header: "Subnet",
    cell: ({ row }) => (
      <span className="text-sm font-mono">
        {row.original.metadata?.subnetId ?? "-"}
      </span>
    ),
  },
  {
    id: "elasticIp",
    header: "Elastic IP",
    cell: ({ row }) => (
      <span className="text-sm font-mono">
        {row.original.metadata?.elasticIp ?? "-"}
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

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Network className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No NAT Gateways found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Create a NAT Gateway to allow private subnets to access the internet.
      </p>
      <Button onClick={onCreate}>
        <Plus className="mr-2 h-4 w-4" />
        Create NAT Gateway
      </Button>
    </div>
  )
}

export default function NATGatewaysPage() {
  const { data, isLoading } = useResources("networking/nat-gateways")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formSubnetId, setFormSubnetId] = useState("")
  const [formElasticIpAllocationId, setFormElasticIpAllocationId] = useState("")

  const natGateways = (data?.resources ?? []) as NATGateway[]

  const filtered = useMemo(() => {
    return natGateways.filter((ngw) => {
      if (providerFilter !== "all" && ngw.provider !== providerFilter) return false
      if (regionFilter !== "all" && ngw.region !== regionFilter) return false
      return true
    })
  }, [natGateways, providerFilter, regionFilter])

  const regions = useMemo(
    () => [...new Set(natGateways.map((n) => n.region))],
    [natGateways]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NAT Gateways</h1>
          <p className="text-muted-foreground mt-1">
            Manage NAT gateways for private subnet internet access.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create NAT Gateway
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create NAT Gateway</DialogTitle>
              <DialogDescription>
                Create a new NAT gateway in a public subnet.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nat-subnet">Subnet ID</Label>
                <Input
                  id="nat-subnet"
                  placeholder="e.g. subnet-0abc123def456"
                  value={formSubnetId}
                  onChange={(e) => setFormSubnetId(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nat-eip">Elastic IP Allocation ID</Label>
                <Input
                  id="nat-eip"
                  placeholder="e.g. eipalloc-0abc123def456"
                  value={formElasticIpAllocationId}
                  onChange={(e) => setFormElasticIpAllocationId(e.target.value)}
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
        <LoadingSkeleton />
      ) : natGateways.length === 0 ? (
        <EmptyState onCreate={() => setDialogOpen(true)} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filtered.length} NAT Gateway{filtered.length !== 1 ? "s" : ""}
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
            <DataTable columns={columns} data={filtered} searchKey="name" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

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
  CheckCircle,
  XCircle,
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

type VPCPeering = Resource & {
  metadata?: {
    requesterVpc?: string
    accepterVpc?: string
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  "pending-acceptance": "outline",
  provisioning: "outline",
  rejected: "destructive",
  expired: "destructive",
  failed: "destructive",
  deleting: "destructive",
}

const columns: ColumnDef<VPCPeering>[] = [
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
    id: "requesterVpc",
    header: "Requester VPC",
    cell: ({ row }) => (
      <span className="text-sm font-mono">
        {row.original.metadata?.requesterVpc ?? "-"}
      </span>
    ),
  },
  {
    id: "accepterVpc",
    header: "Accepter VPC",
    cell: ({ row }) => (
      <span className="text-sm font-mono">
        {row.original.metadata?.accepterVpc ?? "-"}
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
            <CheckCircle className="mr-2 h-4 w-4" /> Accept
          </DropdownMenuItem>
          <DropdownMenuItem>
            <XCircle className="mr-2 h-4 w-4" /> Reject
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
      <h3 className="text-lg font-semibold">No VPC Peering connections found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Create a peering connection to route traffic between VPCs.
      </p>
      <Button onClick={onCreate}>
        <Plus className="mr-2 h-4 w-4" />
        Create Peering Connection
      </Button>
    </div>
  )
}

export default function VPCPeeringPage() {
  const { data, isLoading } = useResources("networking/vpc-peering")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formVpcId, setFormVpcId] = useState("")
  const [formPeerVpcId, setFormPeerVpcId] = useState("")

  const peerings = (data?.resources ?? []) as VPCPeering[]

  const filtered = useMemo(() => {
    return peerings.filter((p) => {
      if (providerFilter !== "all" && p.provider !== providerFilter) return false
      return true
    })
  }, [peerings, providerFilter])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">VPC Peering</h1>
          <p className="text-muted-foreground mt-1">
            Manage VPC peering connections for cross-VPC communication.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Peering Connection
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create VPC Peering Connection</DialogTitle>
              <DialogDescription>
                Create a peering connection between two VPCs.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="peer-vpc">VPC ID (Requester)</Label>
                <Input
                  id="peer-vpc"
                  placeholder="e.g. vpc-0abc123def456"
                  value={formVpcId}
                  onChange={(e) => setFormVpcId(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="peer-vpc-target">Peer VPC ID (Accepter)</Label>
                <Input
                  id="peer-vpc-target"
                  placeholder="e.g. vpc-0xyz789ghi012"
                  value={formPeerVpcId}
                  onChange={(e) => setFormPeerVpcId(e.target.value)}
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
      ) : peerings.length === 0 ? (
        <EmptyState onCreate={() => setDialogOpen(true)} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filtered.length} Peering Connection{filtered.length !== 1 ? "s" : ""}
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

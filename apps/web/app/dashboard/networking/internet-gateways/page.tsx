"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Globe,
  Plus,
  MoreHorizontal,
  Trash2,
  Cloud,
  Filter,
  Link2,
  Unplug,
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

type InternetGateway = Resource & {
  metadata?: {
    attachedVpc?: string
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  attached: "default",
  available: "secondary",
  detached: "outline",
  deleting: "destructive",
}

const columns: ColumnDef<InternetGateway>[] = [
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
    id: "attachedVpc",
    header: "Attached VPC",
    cell: ({ row }) => (
      <span className="text-sm font-mono">
        {row.original.metadata?.attachedVpc ?? "-"}
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
            <Link2 className="mr-2 h-4 w-4" /> Attach to VPC
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Unplug className="mr-2 h-4 w-4" /> Detach
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
      <Globe className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No Internet Gateways found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Create an internet gateway to enable internet access for your VPCs.
      </p>
      <Button onClick={onCreate}>
        <Plus className="mr-2 h-4 w-4" />
        Create Internet Gateway
      </Button>
    </div>
  )
}

export default function InternetGatewaysPage() {
  const { data, isLoading } = useResources("networking/internet-gateways")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formProvider, setFormProvider] = useState("")
  const [formRegion, setFormRegion] = useState("")

  const internetGateways = (data?.resources ?? []) as InternetGateway[]

  const filtered = useMemo(() => {
    return internetGateways.filter((igw) => {
      if (providerFilter !== "all" && igw.provider !== providerFilter) return false
      if (regionFilter !== "all" && igw.region !== regionFilter) return false
      return true
    })
  }, [internetGateways, providerFilter, regionFilter])

  const regions = useMemo(
    () => [...new Set(internetGateways.map((i) => i.region))],
    [internetGateways]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Internet Gateways</h1>
          <p className="text-muted-foreground mt-1">
            Manage internet gateways for VPC internet connectivity.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Internet Gateway
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Internet Gateway</DialogTitle>
              <DialogDescription>
                Create a new internet gateway for VPC internet access.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="igw-provider">Provider</Label>
                <Select value={formProvider} onValueChange={setFormProvider}>
                  <SelectTrigger id="igw-provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="gcp">GCP</SelectItem>
                    <SelectItem value="azure">Azure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="igw-region">Region</Label>
                <Input
                  id="igw-region"
                  placeholder="e.g. us-east-1"
                  value={formRegion}
                  onChange={(e) => setFormRegion(e.target.value)}
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
      ) : internetGateways.length === 0 ? (
        <EmptyState onCreate={() => setDialogOpen(true)} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filtered.length} Internet Gateway{filtered.length !== 1 ? "s" : ""}
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

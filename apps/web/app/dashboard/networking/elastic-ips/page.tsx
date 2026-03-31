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

type ElasticIP = Resource & {
  metadata?: {
    publicIp?: string
    associatedInstance?: string
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "in-use": "default",
  available: "secondary",
  releasing: "destructive",
}

const columns: ColumnDef<ElasticIP>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
  },
  {
    id: "publicIp",
    header: "Public IP",
    cell: ({ row }) => (
      <span className="text-sm font-mono">
        {row.original.metadata?.publicIp ?? "-"}
      </span>
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
    id: "associatedInstance",
    header: "Associated Instance",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.metadata?.associatedInstance ?? "-"}
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
            <Link2 className="mr-2 h-4 w-4" /> Associate
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Unplug className="mr-2 h-4 w-4" /> Disassociate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Release
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

function EmptyState({ onAllocate }: { onAllocate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Globe className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No Elastic IPs found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Allocate a new Elastic IP address to get started.
      </p>
      <Button onClick={onAllocate}>
        <Plus className="mr-2 h-4 w-4" />
        Allocate Elastic IP
      </Button>
    </div>
  )
}

export default function ElasticIPsPage() {
  const { data, isLoading } = useResources("networking/elastic-ips")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formProvider, setFormProvider] = useState("")
  const [formRegion, setFormRegion] = useState("")

  const elasticIps = (data?.resources ?? []) as ElasticIP[]

  const filtered = useMemo(() => {
    return elasticIps.filter((eip) => {
      if (providerFilter !== "all" && eip.provider !== providerFilter) return false
      if (regionFilter !== "all" && eip.region !== regionFilter) return false
      return true
    })
  }, [elasticIps, providerFilter, regionFilter])

  const regions = useMemo(
    () => [...new Set(elasticIps.map((e) => e.region))],
    [elasticIps]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Elastic IPs</h1>
          <p className="text-muted-foreground mt-1">
            Manage elastic IP addresses across cloud providers.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Allocate Elastic IP
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Allocate Elastic IP</DialogTitle>
              <DialogDescription>
                Allocate a new elastic IP address from a cloud provider.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="eip-provider">Provider</Label>
                <Select value={formProvider} onValueChange={setFormProvider}>
                  <SelectTrigger id="eip-provider">
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
                <Label htmlFor="eip-region">Region</Label>
                <Input
                  id="eip-region"
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
                Allocate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : elasticIps.length === 0 ? (
        <EmptyState onAllocate={() => setDialogOpen(true)} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filtered.length} Elastic IP{filtered.length !== 1 ? "s" : ""}
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

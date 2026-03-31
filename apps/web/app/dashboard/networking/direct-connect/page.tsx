"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Cable,
  Cloud,
  Plus,
  MoreHorizontal,
  Trash2,
  Activity,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useResources } from "@/hooks/use-resources"

type DirectConnection = {
  id: string
  name: string
  provider: string
  region: string
  status: string
  bandwidth: string
  location: string
  vlan: number
  bgpStatus: string
  createdAt: string
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  active: "default",
  provisioning: "outline",
  down: "destructive",
  pending: "outline",
  deleting: "destructive",
}

const bgpVariants: Record<string, "default" | "destructive" | "outline"> = {
  established: "default",
  down: "destructive",
  idle: "outline",
}


const columns: ColumnDef<DirectConnection>[] = [
  {
    accessorKey: "name",
    header: "Connection Name",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Cable className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{row.original.name}</span>
      </div>
    ),
  },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => {
      const labels: Record<string, string> = { aws: "Direct Connect", gcp: "Interconnect", azure: "ExpressRoute" }
      return (
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4" />
          <span className="text-xs font-medium">{labels[row.original.provider] ?? row.original.provider}</span>
        </div>
      )
    },
  },
  { accessorKey: "location", header: "Location" },
  { accessorKey: "bandwidth", header: "Bandwidth" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={statusVariants[row.original.status] ?? "secondary"}>
        {row.original.status}
      </Badge>
    ),
  },
  { accessorKey: "vlan", header: "VLAN" },
  {
    accessorKey: "bgpStatus",
    header: "BGP",
    cell: ({ row }) => (
      <Badge variant={bgpVariants[row.original.bgpStatus] ?? "outline"}>
        {row.original.bgpStatus}
      </Badge>
    ),
  },
  {
    id: "actions",
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem><Activity className="mr-2 h-4 w-4" />View Metrics</DropdownMenuItem>
          <DropdownMenuItem><Settings className="mr-2 h-4 w-4" />Manage VIFs</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export default function DirectConnectPage() {
  const { data, isLoading, error } = useResources("networking/direct-connects")
  const [provider, setProvider] = useState("all")
  const [createOpen, setCreateOpen] = useState(false)

  const allData: DirectConnection[] = useMemo(() =>
    (data?.resources ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      provider: r.provider,
      region: r.region,
      status: r.status,
      bandwidth: (r.metadata?.bandwidth as string) ?? "-",
      location: (r.metadata?.location as string) ?? "-",
      vlan: (r.metadata?.vlan as number) ?? 0,
      bgpStatus: (r.metadata?.bgpStatus as string) ?? "idle",
      createdAt: r.createdAt,
    })),
    [data]
  )

  const filtered = useMemo(
    () => provider === "all" ? allData : allData.filter(c => c.provider === provider),
    [provider, allData],
  )

  if (isLoading) return <div className="space-y-4">{Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Direct Connect</h1>
          <p className="text-muted-foreground mt-1">
            Manage dedicated network connections: AWS Direct Connect, GCP Interconnect, Azure ExpressRoute.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Request Connection</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Direct Connection</DialogTitle>
              <DialogDescription>Request a new dedicated network connection to your cloud provider.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="dc-name">Connection Name</Label>
                <Input id="dc-name" placeholder="my-direct-connect" />
              </div>
              <div className="grid gap-2">
                <Label>Provider</Label>
                <Select defaultValue="aws">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws">AWS Direct Connect</SelectItem>
                    <SelectItem value="gcp">GCP Cloud Interconnect</SelectItem>
                    <SelectItem value="azure">Azure ExpressRoute</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Bandwidth</Label>
                <Select defaultValue="1gbps">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1gbps">1 Gbps</SelectItem>
                    <SelectItem value="10gbps">10 Gbps</SelectItem>
                    <SelectItem value="100gbps">100 Gbps</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dc-location">Location</Label>
                <Input id="dc-location" placeholder="Equinix DC2, Washington" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => setCreateOpen(false)}>Request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total Connections</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{allData.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Active</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-500">{allData.filter(c => ["available", "active"].includes(c.status)).length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total Bandwidth</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">35 Gbps</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>BGP Sessions Up</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-500">{allData.filter(c => c.bgpStatus === "established").length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Connections</CardTitle>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="aws">Direct Connect</SelectItem>
                <SelectItem value="gcp">Interconnect</SelectItem>
                <SelectItem value="azure">ExpressRoute</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={filtered} />
        </CardContent>
      </Card>
    </div>
  )
}

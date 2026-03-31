"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Link2, Cloud, Plus, MoreHorizontal, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useResources } from "@/hooks/use-resources"

type VpcEndpoint = {
  id: string
  name: string
  provider: string
  type: string
  serviceName: string
  vpcId: string
  status: string
  subnets: number
  region: string
}

const statusVariants: Record<string, "default" | "destructive" | "outline"> = {
  available: "default",
  active: "default",
  pending: "outline",
  failed: "destructive",
}


const columns: ColumnDef<VpcEndpoint>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{row.original.name}</span>
      </div>
    ),
  },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => <span className="uppercase text-xs font-medium">{row.original.provider}</span>,
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => <Badge variant="outline">{row.original.type}</Badge>,
  },
  { accessorKey: "serviceName", header: "Service" },
  { accessorKey: "vpcId", header: "VPC / VNet" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge variant={statusVariants[row.original.status] ?? "secondary"}>{row.original.status}</Badge>,
  },
  {
    id: "actions",
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>View Details</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export default function EndpointsPage() {
  const { data, isLoading, error } = useResources("networking/vpc-endpoints")
  const [provider, setProvider] = useState("all")
  const [createOpen, setCreateOpen] = useState(false)

  const allData: VpcEndpoint[] = useMemo(() =>
    (data?.resources ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      provider: r.provider,
      type: r.type,
      serviceName: (r.metadata?.serviceName as string) ?? "-",
      vpcId: (r.metadata?.vpcId as string) ?? "-",
      status: r.status,
      subnets: (r.metadata?.subnets as number) ?? 0,
      region: r.region,
    })),
    [data]
  )

  const filtered = useMemo(() => provider === "all" ? allData : allData.filter(e => e.provider === provider), [provider, allData])

  if (isLoading) return <div className="space-y-4">{Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">VPC Endpoints</h1>
          <p className="text-muted-foreground mt-1">Manage VPC Endpoints, Private Service Connect, and Private Link endpoints.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Create Endpoint</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create VPC Endpoint</DialogTitle>
              <DialogDescription>Create a private endpoint for accessing cloud services without public internet.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2"><Label>Provider</Label>
                <Select defaultValue="aws"><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws">AWS VPC Endpoint</SelectItem>
                    <SelectItem value="gcp">GCP Private Service Connect</SelectItem>
                    <SelectItem value="azure">Azure Private Endpoint</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label htmlFor="ep-service">Service</Label><Input id="ep-service" placeholder="com.amazonaws.us-east-1.s3" /></div>
              <div className="grid gap-2"><Label htmlFor="ep-vpc">VPC ID</Label><Input id="ep-vpc" placeholder="vpc-..." /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => setCreateOpen(false)}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total Endpoints</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold">{allData.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Gateway Type</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold">{allData.filter(e => e.type === "Gateway").length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Interface Type</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold">{allData.filter(e => e.type !== "Gateway").length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Endpoints</CardTitle>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="aws">AWS</SelectItem>
                <SelectItem value="gcp">GCP</SelectItem>
                <SelectItem value="azure">Azure</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent><DataTable columns={columns} data={filtered} /></CardContent>
      </Card>
    </div>
  )
}

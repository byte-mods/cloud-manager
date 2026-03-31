"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Network,
  Cloud,
  Plus,
  MoreHorizontal,
  Trash2,
  Settings,
  ArrowRightLeft,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useResources } from "@/hooks/use-resources"

type TransitGateway = {
  id: string
  name: string
  provider: string
  region: string
  status: string
  asn: number
  attachments: number
  routeTables: number
  createdAt: string
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  active: "default",
  pending: "outline",
  deleting: "destructive",
  failed: "destructive",
}


const columns: ColumnDef<TransitGateway>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{row.original.name}</span>
      </div>
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
  { accessorKey: "region", header: "Region" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={statusVariants[row.original.status] ?? "secondary"}>
        {row.original.status}
      </Badge>
    ),
  },
  { accessorKey: "asn", header: "ASN" },
  { accessorKey: "attachments", header: "Attachments" },
  { accessorKey: "routeTables", header: "Route Tables" },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem><Settings className="mr-2 h-4 w-4" />Manage Routes</DropdownMenuItem>
          <DropdownMenuItem><ArrowRightLeft className="mr-2 h-4 w-4" />View Attachments</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export default function TransitGatewayPage() {
  const { data, isLoading, error } = useResources("networking/transit-gateways")
  const [provider, setProvider] = useState("all")
  const [createOpen, setCreateOpen] = useState(false)

  const allData: TransitGateway[] = useMemo(() =>
    (data?.resources ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      provider: r.provider,
      region: r.region,
      status: r.status,
      asn: (r.metadata?.asn as number) ?? 0,
      attachments: (r.metadata?.attachments as number) ?? 0,
      routeTables: (r.metadata?.routeTables as number) ?? 0,
      createdAt: r.createdAt,
    })),
    [data]
  )

  const filtered = useMemo(
    () => provider === "all" ? allData : allData.filter(g => g.provider === provider),
    [provider, allData],
  )

  if (isLoading) return <div className="space-y-4">{Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transit Gateway</h1>
          <p className="text-muted-foreground mt-1">
            Manage Transit Gateways, Cloud Routers, and Route Servers across providers.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Create Transit Gateway</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Transit Gateway</DialogTitle>
              <DialogDescription>Create a new transit gateway for hub-and-spoke connectivity.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="tgw-name">Name</Label>
                <Input id="tgw-name" placeholder="my-transit-gateway" />
              </div>
              <div className="grid gap-2">
                <Label>Provider</Label>
                <Select defaultValue="aws">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws">AWS Transit Gateway</SelectItem>
                    <SelectItem value="gcp">GCP Cloud Router</SelectItem>
                    <SelectItem value="azure">Azure Route Server</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tgw-asn">ASN</Label>
                <Input id="tgw-asn" type="number" defaultValue={64512} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => setCreateOpen(false)}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total Gateways</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{allData.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total Attachments</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{allData.reduce((s, g) => s + g.attachments, 0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Active</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-500">{allData.filter(g => ["available", "active"].includes(g.status)).length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Providers</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{new Set(allData.map(g => g.provider)).size}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transit Gateways</CardTitle>
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
        <CardContent>
          <DataTable columns={columns} data={filtered} />
        </CardContent>
      </Card>
    </div>
  )
}

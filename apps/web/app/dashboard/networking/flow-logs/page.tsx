"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { FileText, Cloud, Plus, MoreHorizontal, Trash2, Eye, Power } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useResources } from "@/hooks/use-resources"

type FlowLogConfig = {
  id: string
  name: string
  provider: string
  resourceType: string
  resourceId: string
  destination: string
  status: string
  region: string
}

type FlowLogEntry = {
  id: string
  timestamp: string
  srcAddr: string
  dstAddr: string
  srcPort: number
  dstPort: number
  protocol: string
  action: string
  bytes: number
}


const configColumns: ColumnDef<FlowLogConfig>[] = [
  { accessorKey: "name", header: "Name", cell: ({ row }) => (<div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{row.original.name}</span></div>) },
  { accessorKey: "provider", header: "Provider", cell: ({ row }) => <span className="uppercase text-xs font-medium">{row.original.provider}</span> },
  { accessorKey: "resourceType", header: "Resource Type", cell: ({ row }) => <Badge variant="outline">{row.original.resourceType}</Badge> },
  { accessorKey: "resourceId", header: "Resource ID" },
  { accessorKey: "destination", header: "Destination" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge variant={row.original.status === "active" ? "default" : "secondary"}>{row.original.status}</Badge> },
  {
    id: "actions",
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />View Logs</DropdownMenuItem>
          <DropdownMenuItem><Power className="mr-2 h-4 w-4" />Toggle</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

const entryColumns: ColumnDef<FlowLogEntry>[] = [
  { accessorKey: "timestamp", header: "Timestamp", cell: ({ row }) => new Date(row.original.timestamp).toLocaleTimeString() },
  { accessorKey: "srcAddr", header: "Source IP" },
  { accessorKey: "srcPort", header: "Src Port" },
  { accessorKey: "dstAddr", header: "Dest IP" },
  { accessorKey: "dstPort", header: "Dst Port" },
  { accessorKey: "protocol", header: "Protocol", cell: ({ row }) => <Badge variant="outline">{row.original.protocol}</Badge> },
  { accessorKey: "action", header: "Action", cell: ({ row }) => <Badge variant={row.original.action === "ACCEPT" ? "default" : "destructive"}>{row.original.action}</Badge> },
  { accessorKey: "bytes", header: "Bytes", cell: ({ row }) => row.original.bytes.toLocaleString() },
]

export default function FlowLogsPage() {
  const { data, isLoading, error } = useResources("traffic/flow-logs")

  const configs: FlowLogConfig[] = (data?.resources ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    provider: r.provider,
    resourceType: r.type,
    resourceId: r.id,
    destination: (r.metadata?.destination as string) ?? "-",
    status: r.status,
    region: r.region,
  }))

  const entries: FlowLogEntry[] = []

  if (isLoading) return <div className="space-y-4">{Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">VPC Flow Logs</h1>
        <p className="text-muted-foreground mt-1">Monitor and analyze network traffic across VPCs, subnets, and security groups.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Active Configs</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold text-green-500">{configs.filter(c => c.status === "active").length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total Entries (24h)</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold">2.4M</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Rejected</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold text-red-500">12.3K</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Data Volume (24h)</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold">48 GB</div></CardContent></Card>
      </div>

      <Tabs defaultValue="configs">
        <TabsList><TabsTrigger value="configs">Configurations</TabsTrigger><TabsTrigger value="entries">Log Entries</TabsTrigger></TabsList>
        <TabsContent value="configs" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Flow Log Configurations</CardTitle></CardHeader>
            <CardContent><DataTable columns={configColumns} data={configs} /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="entries" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Recent Flow Log Entries</CardTitle><CardDescription>Last 30 seconds of traffic</CardDescription></CardHeader>
            <CardContent><DataTable columns={entryColumns} data={entries} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

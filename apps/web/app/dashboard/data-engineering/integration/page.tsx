"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { ColumnDef } from "@tanstack/react-table"
import {
  Plug,
  Plus,
  Cloud,
  MoreHorizontal,
  Trash2,
  Settings,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Connector = {
  id: string
  name: string
  type: string
  category: "source" | "sink" | "bidirectional"
  provider: string
  status: "connected" | "error" | "syncing" | "paused"
  lastSync: string
  recordsProcessed: number
}

type ConnectorTemplate = {
  name: string
  type: string
  category: "source" | "sink" | "bidirectional"
  icon: string
}

const templates: ConnectorTemplate[] = [
  { name: "Amazon S3", type: "s3", category: "bidirectional", icon: "S3" },
  { name: "Google BigQuery", type: "bigquery", category: "bidirectional", icon: "BQ" },
  { name: "Snowflake", type: "snowflake", category: "bidirectional", icon: "SF" },
  { name: "PostgreSQL", type: "postgres", category: "bidirectional", icon: "PG" },
  { name: "MySQL", type: "mysql", category: "source", icon: "MY" },
  { name: "MongoDB", type: "mongodb", category: "source", icon: "MG" },
  { name: "Salesforce", type: "salesforce", category: "source", icon: "SF" },
  { name: "Stripe", type: "stripe", category: "source", icon: "ST" },
  { name: "HubSpot", type: "hubspot", category: "source", icon: "HS" },
  { name: "Slack", type: "slack", category: "sink", icon: "SL" },
  { name: "Datadog", type: "datadog", category: "sink", icon: "DD" },
  { name: "Elasticsearch", type: "elasticsearch", category: "sink", icon: "ES" },
  { name: "Apache Kafka", type: "kafka", category: "bidirectional", icon: "KF" },
  { name: "REST API", type: "rest_api", category: "bidirectional", icon: "API" },
  { name: "Webhook", type: "webhook", category: "source", icon: "WH" },
  { name: "Google Sheets", type: "google_sheets", category: "source", icon: "GS" },
]


const statusConfig: Record<string, { variant: "default" | "destructive" | "outline" | "secondary"; icon: typeof CheckCircle2 }> = {
  connected: { variant: "default", icon: CheckCircle2 },
  error: { variant: "destructive", icon: XCircle },
  syncing: { variant: "outline", icon: RefreshCw },
  paused: { variant: "secondary", icon: Clock },
}

const columns: ColumnDef<Connector>[] = [
  {
    accessorKey: "name",
    header: "Connector",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded border flex items-center justify-center text-xs font-bold bg-muted">
          {row.original.type.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <span className="font-medium">{row.original.name}</span>
          <p className="text-xs text-muted-foreground">{row.original.type}</p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Direction",
    cell: ({ row }) => <Badge variant="outline">{row.original.category}</Badge>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const cfg = statusConfig[row.original.status]
      return (
        <div className="flex items-center gap-1.5">
          <cfg.icon className={`h-3.5 w-3.5 ${row.original.status === "connected" ? "text-green-500" : row.original.status === "error" ? "text-red-500" : row.original.status === "syncing" ? "text-blue-500" : "text-muted-foreground"}`} />
          <Badge variant={cfg.variant}>{row.original.status}</Badge>
        </div>
      )
    },
  },
  { accessorKey: "lastSync", header: "Last Sync" },
  {
    accessorKey: "recordsProcessed",
    header: "Records",
    cell: ({ row }) => row.original.recordsProcessed.toLocaleString(),
  },
  {
    id: "actions",
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem><RefreshCw className="mr-2 h-4 w-4" />Sync Now</DropdownMenuItem>
          <DropdownMenuItem><Settings className="mr-2 h-4 w-4" />Configure</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export default function IntegrationPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [tab, setTab] = useState("active")

  const { data: connectorsData } = useQuery<{ connectors: Connector[] }>({
    queryKey: ["data-engineering", "connectors"],
    queryFn: () => apiClient.get("/v1/data-engineering/connectors"),
  })

  const connectors = connectorsData?.connectors ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-1">Connect external data sources, APIs, and services to your data pipelines.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Connector</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Connector</DialogTitle>
              <DialogDescription>Select a connector type to configure a new data integration.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-4 gap-3 py-4 max-h-[400px] overflow-auto">
              {templates.map(t => (
                <button key={t.type} onClick={() => setCreateOpen(false)} className="flex flex-col items-center gap-1.5 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="h-10 w-10 rounded-lg border flex items-center justify-center text-xs font-bold bg-muted">{t.icon}</div>
                  <span className="text-xs font-medium text-center">{t.name}</span>
                  <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Active Connectors</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold text-green-500">{connectors.filter(c => c.status === "connected").length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Syncing</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold text-blue-500">{connectors.filter(c => c.status === "syncing").length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Errors</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold text-red-500">{connectors.filter(c => c.status === "error").length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Records (24h)</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold">{(connectors.reduce((s, c) => s + c.recordsProcessed, 0) / 1_000_000).toFixed(1)}M</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Connectors</CardTitle></CardHeader>
        <CardContent>
          {connectors.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No data available</div>
          ) : (
            <DataTable columns={columns} data={connectors} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Database,
  Copy,
  Check,
  Settings,
  HardDrive,
  FileText,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { useResources, type Resource } from "@/hooks/use-resources"

type DBDetail = Resource & {
  metadata?: {
    engine?: string
    version?: string
    instanceClass?: string
    endpoint?: string
    port?: number
    username?: string
    databaseName?: string
    storage?: string
    multiAz?: boolean
    encrypted?: boolean
    parameterGroup?: string
  }
}

function MetricsChart({
  title,
  data,
  unit,
  color,
}: {
  title: string
  data: number[]
  unit: string
  color: string
}) {
  const max = Math.max(...data, 1)
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: 100 - (v / max) * 100,
  }))
  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ")

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <CardDescription>
          Current: {data[data.length - 1]?.toFixed(1)}
          {unit}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <svg viewBox="0 0 100 60" className="w-full h-24" preserveAspectRatio="none">
          <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" />
          <path
            d={`${pathD} L 100 60 L 0 60 Z`}
            fill={color}
            fillOpacity="0.1"
          />
        </svg>
      </CardContent>
    </Card>
  )
}

const sampleMetrics = {
  cpu: Array.from({ length: 24 }, () => Math.random() * 60 + 10),
  memory: Array.from({ length: 24 }, () => Math.random() * 30 + 50),
  connections: Array.from({ length: 24 }, () => Math.floor(Math.random() * 200 + 20)),
  iops: Array.from({ length: 24 }, () => Math.floor(Math.random() * 3000 + 500)),
  storageUsed: Array.from({ length: 24 }, () => Math.random() * 20 + 60),
}


function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopy}>
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Database className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">Database not found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        The requested database could not be found or has been deleted.
      </p>
      <Button asChild>
        <Link href="/dashboard/databases/relational">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Databases
        </Link>
      </Button>
    </div>
  )
}

export default function DatabaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const dbId = params.id as string
  const { data, isLoading } = useResources("databases/relational")

  const db = (data?.resources ?? []).find(
    (r) => r.id === dbId
  ) as DBDetail | undefined

  if (isLoading) return <LoadingSkeleton />
  if (!db) return <EmptyState />

  const meta = db.metadata ?? {}
  const endpoint = meta.endpoint ?? "mydb.cluster-abc123.us-east-1.rds.amazonaws.com"
  const port = meta.port ?? 5432
  const username = meta.username ?? "admin"
  const databaseName = meta.databaseName ?? "myapp_production"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/databases/relational")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{db.name}</h1>
            <Badge variant="default">{db.status}</Badge>
            <Badge variant="outline">{meta.engine ?? "postgresql"} {meta.version ?? ""}</Badge>
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{db.id}</p>
        </div>
      </div>

      {/* Connection Info Card */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base">Connection Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Endpoint</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-mono truncate">{endpoint}</p>
                <CopyButton text={endpoint} />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Port</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-mono">{port}</p>
                <CopyButton text={String(port)} />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Username</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-mono">{username}</p>
                <CopyButton text={username} />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Database Name</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-mono">{databaseName}</p>
                <CopyButton text={databaseName} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="metrics">
        <TabsList>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="replicas">Read Replicas</TabsTrigger>
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <MetricsChart title="CPU Utilization" data={sampleMetrics.cpu} unit="%" color="#3b82f6" />
            <MetricsChart title="Memory Utilization" data={sampleMetrics.memory} unit="%" color="#8b5cf6" />
            <MetricsChart title="Active Connections" data={sampleMetrics.connections} unit="" color="#10b981" />
            <MetricsChart title="Read/Write IOPS" data={sampleMetrics.iops} unit=" IOPS" color="#f59e0b" />
            <MetricsChart title="Storage Used" data={sampleMetrics.storageUsed} unit="%" color="#ef4444" />
          </div>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Instance Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Instance Class</p>
                  <p className="text-sm font-medium">{meta.instanceClass ?? "db.r5.large"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Engine</p>
                  <p className="text-sm font-medium">{meta.engine ?? "postgresql"} {meta.version ?? "15.4"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Storage</p>
                  <p className="text-sm font-medium">{meta.storage ?? "100 GB gp3"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Multi-AZ</p>
                  <Badge variant={meta.multiAz ? "default" : "secondary"}>
                    {meta.multiAz ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Encryption</p>
                  <Badge variant={meta.encrypted !== false ? "default" : "secondary"}>
                    {meta.encrypted !== false ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Parameter Group</p>
                  <p className="text-sm font-medium font-mono">{meta.parameterGroup ?? "default.postgres15"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Parameter Group Settings</CardTitle>
              <CardDescription>Key configuration parameters</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <div className="grid grid-cols-3 gap-4 p-3 bg-muted text-sm font-medium">
                  <span>Parameter</span>
                  <span>Value</span>
                  <span>Source</span>
                </div>
                {[
                  { param: "max_connections", value: "200", source: "user" },
                  { param: "shared_buffers", value: "4096MB", source: "user" },
                  { param: "work_mem", value: "64MB", source: "user" },
                  { param: "effective_cache_size", value: "12288MB", source: "system" },
                  { param: "log_min_duration_statement", value: "1000", source: "user" },
                ].map((p) => (
                  <div key={p.param} className="grid grid-cols-3 gap-4 p-3 text-sm border-t">
                    <span className="font-mono">{p.param}</span>
                    <span className="font-mono">{p.value}</span>
                    <Badge variant="outline" className="w-fit">{p.source}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Backups & Snapshots
              </CardTitle>
              <CardDescription>
                Automated and manual database snapshots
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <div className="grid grid-cols-5 gap-4 p-3 bg-muted text-sm font-medium">
                  <span>Snapshot ID</span>
                  <span>Type</span>
                  <span>Date</span>
                  <span>Size</span>
                  <span>Status</span>
                </div>
                <div className="p-6 text-center text-sm text-muted-foreground">No data available</div>
              </div>
              <Button variant="outline" className="mt-4">
                Create Manual Snapshot
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Database Logs
              </CardTitle>
              <CardDescription>
                Error and slow query logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-sm text-muted-foreground">No data available</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="replicas" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Read Replicas</CardTitle>
                  <CardDescription>Manage read replicas for horizontal read scaling</CardDescription>
                </div>
                <Button size="sm">Create Read Replica</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: "prod-db-replica-1", region: "us-east-1b", status: "available", lag: "0.2s", connections: 45, role: "reader" },
                  { name: "prod-db-replica-2", region: "us-west-2a", status: "available", lag: "1.8s", connections: 32, role: "reader" },
                  { name: "prod-db-replica-3", region: "eu-west-1a", status: "creating", lag: "-", connections: 0, role: "reader" },
                ].map((replica) => (
                  <div key={replica.name} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <Database className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{replica.name}</p>
                        <p className="text-xs text-muted-foreground">{replica.region} — {replica.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center"><p className="text-xs text-muted-foreground">Lag</p><p className="font-medium">{replica.lag}</p></div>
                      <div className="text-center"><p className="text-xs text-muted-foreground">Connections</p><p className="font-medium">{replica.connections}</p></div>
                      <Badge variant={replica.status === "available" ? "default" : "outline"}>{replica.status}</Badge>
                      <Button variant="ghost" size="sm">Promote</Button>
                      <Button variant="ghost" size="sm" className="text-destructive">Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parameters" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Parameter Group</CardTitle>
                  <CardDescription>Database engine configuration parameters — custom-postgres17-prod</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Reset to Default</Button>
                  <Button size="sm">Save Changes</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {[
                  { name: "max_connections", value: "200", default: "100", desc: "Maximum number of concurrent connections", modified: true },
                  { name: "shared_buffers", value: "4GB", default: "128MB", desc: "Memory for shared buffer pool", modified: true },
                  { name: "effective_cache_size", value: "12GB", default: "4GB", desc: "Planner estimate of total cache size", modified: true },
                  { name: "work_mem", value: "64MB", default: "4MB", desc: "Memory per sort/hash operation", modified: true },
                  { name: "maintenance_work_mem", value: "1GB", default: "64MB", desc: "Memory for maintenance operations", modified: true },
                  { name: "wal_buffers", value: "64MB", default: "4MB", desc: "WAL buffer memory", modified: true },
                  { name: "checkpoint_completion_target", value: "0.9", default: "0.5", desc: "Target fraction for checkpoint completion", modified: true },
                  { name: "random_page_cost", value: "1.1", default: "4.0", desc: "Cost estimate for random page fetch", modified: true },
                  { name: "log_min_duration_statement", value: "1000", default: "-1", desc: "Minimum statement duration to log (ms)", modified: true },
                  { name: "autovacuum", value: "on", default: "on", desc: "Enable autovacuum", modified: false },
                  { name: "log_statement", value: "none", default: "none", desc: "Type of statements to log", modified: false },
                  { name: "ssl", value: "on", default: "on", desc: "Enable SSL connections", modified: false },
                ].map((param) => (
                  <div key={param.name} className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/30 px-2 rounded">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">{param.name}</span>
                        {param.modified && <Badge variant="outline" className="text-[10px] h-4">Modified</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{param.desc}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <input className="w-24 rounded border px-2 py-1 text-sm font-mono text-right" defaultValue={param.value} />
                        <p className="text-[10px] text-muted-foreground mt-0.5">default: {param.default}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

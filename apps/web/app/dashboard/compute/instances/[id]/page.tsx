"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Tag,
  Globe,
  HardDrive,
  Plus,
  X,
  Server,
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
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useResources, type Resource } from "@/hooks/use-resources"

type InstanceDetail = Resource & {
  metadata?: {
    instanceType?: string
    publicIp?: string
    privateIp?: string
    costPerMonth?: number
    az?: string
    vpcId?: string
    subnetId?: string
    securityGroups?: { id: string; name: string }[]
    volumes?: {
      id: string
      name: string
      size: number
      type: string
      iops: number
      attached: boolean
    }[]
    cpu?: number[]
    memory?: number[]
    networkIn?: number[]
    networkOut?: number[]
    diskRead?: number[]
    diskWrite?: number[]
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  running: "default",
  stopped: "secondary",
  terminated: "destructive",
  pending: "outline",
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

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Server className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">Instance not found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        The requested instance could not be found or has been deleted.
      </p>
      <Button asChild>
        <Link href="/dashboard/compute/instances">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Instances
        </Link>
      </Button>
    </div>
  )
}

export default function InstanceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const instanceId = params.id as string
  const { data, isLoading } = useResources("compute/instances")
  const [newTagKey, setNewTagKey] = useState("")
  const [newTagValue, setNewTagValue] = useState("")

  const instance = (data?.resources ?? []).find(
    (r) => r.id === instanceId
  ) as InstanceDetail | undefined

  const sampleMetrics = {
    cpu: Array.from({ length: 24 }, () => Math.random() * 80 + 10),
    memory: Array.from({ length: 24 }, () => Math.random() * 40 + 40),
    networkIn: Array.from({ length: 24 }, () => Math.random() * 500),
    networkOut: Array.from({ length: 24 }, () => Math.random() * 300),
    diskRead: Array.from({ length: 24 }, () => Math.random() * 200),
    diskWrite: Array.from({ length: 24 }, () => Math.random() * 150),
  }

  if (isLoading) return <LoadingSkeleton />
  if (!instance) return <EmptyState />

  const tags = instance.tags ?? {}
  const meta = instance.metadata ?? {}

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/compute/instances")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {instance.name}
            </h1>
            <Badge variant={statusVariants[instance.status] ?? "outline"}>
              {instance.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            {instance.id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={instance.status === "running"}
          >
            <Play className="mr-1 h-4 w-4" /> Start
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={instance.status !== "running"}
          >
            <Square className="mr-1 h-4 w-4" /> Stop
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={instance.status !== "running"}
          >
            <RotateCcw className="mr-1 h-4 w-4" /> Reboot
          </Button>
          <Button variant="destructive" size="sm">
            <Trash2 className="mr-1 h-4 w-4" /> Terminate
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="networking">Networking</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Instance Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="text-sm font-medium">{instance.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Instance ID</p>
                  <p className="text-sm font-medium font-mono">{instance.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="text-sm font-medium">
                    {meta.instanceType ?? instance.type}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={statusVariants[instance.status] ?? "outline"}>
                    {instance.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Provider</p>
                  <p className="text-sm font-medium uppercase">
                    {instance.provider}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Region</p>
                  <p className="text-sm font-medium">{instance.region}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Availability Zone
                  </p>
                  <p className="text-sm font-medium">{meta.az ?? "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-sm font-medium">{instance.createdAt}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cost/month</p>
                  <p className="text-sm font-medium">
                    {meta.costPerMonth != null
                      ? `$${meta.costPerMonth.toFixed(2)}`
                      : "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <MetricsChart
              title="CPU Utilization"
              data={meta.cpu ?? sampleMetrics.cpu}
              unit="%"
              color="#3b82f6"
            />
            <MetricsChart
              title="Memory Utilization"
              data={meta.memory ?? sampleMetrics.memory}
              unit="%"
              color="#8b5cf6"
            />
            <MetricsChart
              title="Network In"
              data={meta.networkIn ?? sampleMetrics.networkIn}
              unit=" KB/s"
              color="#10b981"
            />
            <MetricsChart
              title="Network Out"
              data={meta.networkOut ?? sampleMetrics.networkOut}
              unit=" KB/s"
              color="#f59e0b"
            />
            <MetricsChart
              title="Disk Read"
              data={meta.diskRead ?? sampleMetrics.diskRead}
              unit=" KB/s"
              color="#ef4444"
            />
            <MetricsChart
              title="Disk Write"
              data={meta.diskWrite ?? sampleMetrics.diskWrite}
              unit=" KB/s"
              color="#ec4899"
            />
          </div>
        </TabsContent>

        <TabsContent value="networking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Networking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Public IP</p>
                  <p className="text-sm font-medium font-mono">
                    {meta.publicIp ?? "None"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Private IP</p>
                  <p className="text-sm font-medium font-mono">
                    {meta.privateIp ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">VPC</p>
                  <p className="text-sm font-medium font-mono">
                    {meta.vpcId ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subnet</p>
                  <p className="text-sm font-medium font-mono">
                    {meta.subnetId ?? "-"}
                  </p>
                </div>
              </div>
              <Separator className="my-4" />
              <div>
                <p className="text-sm font-medium mb-2">Security Groups</p>
                {meta.securityGroups && meta.securityGroups.length > 0 ? (
                  <div className="space-y-2">
                    {meta.securityGroups.map((sg) => (
                      <div
                        key={sg.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Badge variant="outline">{sg.id}</Badge>
                        <span className="text-muted-foreground">{sg.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No security groups assigned
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Attached Volumes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {meta.volumes && meta.volumes.length > 0 ? (
                <div className="space-y-3">
                  {meta.volumes.map((vol) => (
                    <div
                      key={vol.id}
                      className="flex items-center justify-between border rounded-md p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{vol.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {vol.id}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>{vol.size} GB</span>
                        <Badge variant="outline">{vol.type}</Badge>
                        <span>{vol.iops} IOPS</span>
                        <Badge variant={vol.attached ? "default" : "secondary"}>
                          {vol.attached ? "Attached" : "Detached"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No volumes attached to this instance.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Tags
              </CardTitle>
              <CardDescription>
                Manage tags for this instance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(tags).length > 0 ? (
                <div className="space-y-2 mb-4">
                  {Object.entries(tags).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between border rounded-md p-2"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{key}</Badge>
                        <span className="text-sm">{value}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">
                  No tags assigned to this instance.
                </p>
              )}
              <Separator className="my-4" />
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Key"
                  value={newTagKey}
                  onChange={(e) => setNewTagKey(e.target.value)}
                  className="max-w-[200px]"
                />
                <Input
                  placeholder="Value"
                  value={newTagValue}
                  onChange={(e) => setNewTagValue(e.target.value)}
                  className="max-w-[200px]"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!newTagKey}
                  onClick={() => {
                    setNewTagKey("")
                    setNewTagValue("")
                  }}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add Tag
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

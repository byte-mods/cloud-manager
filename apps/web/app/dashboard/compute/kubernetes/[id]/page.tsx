"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Cloud,
  Server,
  Globe,
  Settings,
  Layers,
  Box,
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

type ClusterDetail = Resource & {
  metadata?: {
    version?: string
    nodes?: number
    service?: string
    endpoint?: string
    podCidr?: string
    serviceCidr?: string
    deployments?: { name: string; namespace: string; replicas: number; available: number; status: string }[]
    statefulSets?: { name: string; namespace: string; replicas: number; ready: number }[]
    daemonSets?: { name: string; namespace: string; desired: number; ready: number }[]
    services?: { name: string; namespace: string; type: string; clusterIp: string; externalIp: string }[]
    ingresses?: { name: string; namespace: string; hosts: string; address: string }[]
    configMaps?: number
    secrets?: number
    nodeList?: { name: string; status: string; role: string; version: string; cpu: string; memory: string; allocatableCpu: string; allocatableMemory: string }[]
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  creating: "outline",
  updating: "outline",
  deleting: "destructive",
  failed: "destructive",
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Cloud className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">Cluster not found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        The requested cluster could not be found or has been deleted.
      </p>
      <Button asChild>
        <Link href="/dashboard/compute/kubernetes">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Clusters
        </Link>
      </Button>
    </div>
  )
}

function TableSection({
  title,
  headers,
  rows,
}: {
  title: string
  headers: string[]
  rows: string[][]
}) {
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No {title.toLowerCase()} found.
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <div
        className="grid gap-4 p-3 bg-muted text-xs font-medium text-muted-foreground"
        style={{ gridTemplateColumns: `repeat(${headers.length}, 1fr)` }}
      >
        {headers.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          className="grid gap-4 p-3 text-sm border-t"
          style={{ gridTemplateColumns: `repeat(${headers.length}, 1fr)` }}
        >
          {row.map((cell, j) => (
            <span key={j} className={j === 0 ? "font-medium" : ""}>
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function KubernetesDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clusterId = params.id as string
  const { data, isLoading } = useResources("compute/kubernetes")

  const cluster = (data?.resources ?? []).find(
    (r) => r.id === clusterId
  ) as ClusterDetail | undefined

  if (isLoading) return <LoadingSkeleton />
  if (!cluster) return <EmptyState />

  const meta = cluster.metadata ?? {}

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/compute/kubernetes")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {cluster.name}
            </h1>
            <Badge variant={statusVariants[cluster.status] ?? "outline"}>
              {cluster.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            {cluster.id}
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workloads">Workloads</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="nodes">Nodes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cluster Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Cluster Name</p>
                  <p className="text-sm font-medium">{cluster.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Provider</p>
                  <p className="text-sm font-medium uppercase">
                    {meta.service ?? cluster.provider}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Version</p>
                  <p className="text-sm font-medium">
                    v{meta.version ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Region</p>
                  <p className="text-sm font-medium">{cluster.region}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nodes</p>
                  <p className="text-sm font-medium">{meta.nodes ?? 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={statusVariants[cluster.status] ?? "outline"}>
                    {cluster.status}
                  </Badge>
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <p className="text-sm text-muted-foreground">
                    API Server Endpoint
                  </p>
                  <p className="text-sm font-medium font-mono break-all">
                    {meta.endpoint ?? "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workloads" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Deployments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TableSection
                title="Deployments"
                headers={["Name", "Namespace", "Replicas", "Available", "Status"]}
                rows={(meta.deployments ?? []).map((d) => [
                  d.name,
                  d.namespace,
                  String(d.replicas),
                  String(d.available),
                  d.status,
                ])}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5" />
                StatefulSets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TableSection
                title="StatefulSets"
                headers={["Name", "Namespace", "Replicas", "Ready"]}
                rows={(meta.statefulSets ?? []).map((s) => [
                  s.name,
                  s.namespace,
                  String(s.replicas),
                  String(s.ready),
                ])}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>DaemonSets</CardTitle>
            </CardHeader>
            <CardContent>
              <TableSection
                title="DaemonSets"
                headers={["Name", "Namespace", "Desired", "Ready"]}
                rows={(meta.daemonSets ?? []).map((d) => [
                  d.name,
                  d.namespace,
                  String(d.desired),
                  String(d.ready),
                ])}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Services
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TableSection
                title="Services"
                headers={["Name", "Namespace", "Type", "Cluster IP", "External IP"]}
                rows={(meta.services ?? []).map((s) => [
                  s.name,
                  s.namespace,
                  s.type,
                  s.clusterIp,
                  s.externalIp || "-",
                ])}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ingresses</CardTitle>
            </CardHeader>
            <CardContent>
              <TableSection
                title="Ingresses"
                headers={["Name", "Namespace", "Hosts", "Address"]}
                rows={(meta.ingresses ?? []).map((i) => [
                  i.name,
                  i.namespace,
                  i.hosts,
                  i.address || "-",
                ])}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  ConfigMaps
                </CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {meta.configMaps ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Configuration maps in the cluster
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Secrets</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{meta.secrets ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Secrets stored in the cluster
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="nodes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Nodes
              </CardTitle>
              <CardDescription>
                Cluster nodes with capacity and allocatable resources
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(meta.nodeList ?? []).length > 0 ? (
                <div className="rounded-md border">
                  <div className="grid grid-cols-8 gap-2 p-3 bg-muted text-xs font-medium text-muted-foreground">
                    <span>Name</span>
                    <span>Status</span>
                    <span>Role</span>
                    <span>Version</span>
                    <span className="text-right">CPU</span>
                    <span className="text-right">Memory</span>
                    <span className="text-right">Alloc CPU</span>
                    <span className="text-right">Alloc Mem</span>
                  </div>
                  {(meta.nodeList ?? []).map((node) => (
                    <div
                      key={node.name}
                      className="grid grid-cols-8 gap-2 p-3 text-sm border-t"
                    >
                      <span className="font-medium truncate">{node.name}</span>
                      <Badge
                        variant={node.status === "Ready" ? "default" : "destructive"}
                        className="w-fit"
                      >
                        {node.status}
                      </Badge>
                      <span>{node.role}</span>
                      <span className="font-mono text-xs">{node.version}</span>
                      <span className="text-right">{node.cpu}</span>
                      <span className="text-right">{node.memory}</span>
                      <span className="text-right">{node.allocatableCpu}</span>
                      <span className="text-right">
                        {node.allocatableMemory}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No node data available.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

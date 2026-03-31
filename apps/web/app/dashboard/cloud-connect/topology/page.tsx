"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import {
  Server,
  Database,
  HardDrive,
  Globe,
  Shield,
  Zap,
  Container,
  Radio,
  Layers,
  Network,
  Cloud,
  Filter,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useCloudConnectStore,
  type DiscoveredService,
  type CloudProvider,
  type ServiceType,
} from "@/stores/cloud-connect-store"
import { useCloudTopology } from "@/hooks/use-cloud-connect"

// ---------------------------------------------------------------------------
// Provider colours
// ---------------------------------------------------------------------------

const providerColors: Record<CloudProvider, { bg: string; border: string; text: string; node: string; edge: string }> = {
  aws: { bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-300 dark:border-orange-700", text: "text-orange-600", node: "#f97316", edge: "#fb923c" },
  gcp: { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-300 dark:border-blue-700", text: "text-blue-600", node: "#3b82f6", edge: "#60a5fa" },
  azure: { bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-300 dark:border-purple-700", text: "text-purple-600", node: "#8b5cf6", edge: "#a78bfa" },
}

const statusDot: Record<string, string> = {
  running: "bg-green-500",
  stopped: "bg-gray-400",
  warning: "bg-yellow-500",
  error: "bg-red-500",
  creating: "bg-blue-400",
  deleting: "bg-red-300",
}

const typeIcons: Record<ServiceType, typeof Server> = {
  compute: Server,
  storage: HardDrive,
  database: Database,
  networking: Network,
  serverless: Zap,
  container: Container,
  cache: Layers,
  queue: Radio,
  cdn: Globe,
  dns: Globe,
  loadbalancer: Network,
  monitoring: Cloud,
  security: Shield,
  ml: Cloud,
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B/s`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB/s`
  return `${(b / (1024 * 1024)).toFixed(1)} MB/s`
}

// ---------------------------------------------------------------------------
// Custom node component
// ---------------------------------------------------------------------------

function ServiceNode({ data }: NodeProps) {
  const svc = data.service as DiscoveredService
  const colors = providerColors[svc.provider]
  const Icon = typeIcons[svc.type] || Cloud

  return (
    <div
      className={`rounded-lg border-2 px-3 py-2 shadow-sm min-w-[160px] ${colors.bg} ${colors.border}`}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2" />

      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${colors.text}`} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate">{svc.resourceName}</div>
          <div className="text-[10px] text-muted-foreground">{svc.serviceName}</div>
        </div>
        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusDot[svc.status]}`} />
      </div>

      {/* Sparkline placeholder -- traffic bar */}
      {(svc.trafficIn > 0 || svc.trafficOut > 0) && (
        <div className="mt-1.5 flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="text-green-600">↓{formatBytes(svc.trafficIn)}</span>
          <span className="text-blue-600">↑{formatBytes(svc.trafficOut)}</span>
        </div>
      )}
    </div>
  )
}

const nodeTypes = { service: ServiceNode }

// ---------------------------------------------------------------------------
// Layout helper
// ---------------------------------------------------------------------------

function buildLayout(
  services: DiscoveredService[],
  providerFilter: string,
  typeFilter: string,
  statusFilter: string,
  regionFilter: string,
) {
  let filtered = services
  if (providerFilter !== "all") filtered = filtered.filter((s) => s.provider === providerFilter)
  if (typeFilter !== "all") filtered = filtered.filter((s) => s.type === typeFilter)
  if (statusFilter !== "all") filtered = filtered.filter((s) => s.status === statusFilter)
  if (regionFilter !== "all") filtered = filtered.filter((s) => s.region === regionFilter)

  const filteredIds = new Set(filtered.map((s) => s.id))

  // Group by provider
  const columns: Record<CloudProvider, DiscoveredService[]> = { aws: [], gcp: [], azure: [] }
  for (const svc of filtered) {
    columns[svc.provider].push(svc)
  }

  const colOrder: CloudProvider[] = ["aws", "gcp", "azure"]
  const colWidth = 260
  const rowHeight = 75
  const colGap = 120
  const topPadding = 60

  const nodes: Node[] = []
  let colIdx = 0

  for (const provider of colOrder) {
    const items = columns[provider]
    if (items.length === 0) {
      colIdx++
      continue
    }
    const x = colIdx * (colWidth + colGap) + 40

    for (let row = 0; row < items.length; row++) {
      const svc = items[row]
      nodes.push({
        id: svc.id,
        type: "service",
        position: { x, y: topPadding + row * rowHeight },
        data: { service: svc },
      })
    }
    colIdx++
  }

  // Edges
  const edges: Edge[] = []
  const seen = new Set<string>()

  for (const svc of filtered) {
    for (const connId of svc.connections) {
      if (!filteredIds.has(connId)) continue
      const key = [svc.id, connId].sort().join("|")
      if (seen.has(key)) continue
      seen.add(key)

      const target = filtered.find((s) => s.id === connId)
      if (!target) continue

      const isCrossCloud = svc.provider !== target.provider
      edges.push({
        id: `e-${svc.id}-${connId}`,
        source: svc.id,
        target: connId,
        animated: true,
        style: {
          stroke: isCrossCloud ? "#f59e0b" : providerColors[svc.provider].edge,
          strokeWidth: isCrossCloud ? 2.5 : 1.5,
          strokeDasharray: isCrossCloud ? "6 3" : undefined,
        },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
      })
    }
  }

  return { nodes, edges }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TopologyPage() {
  const router = useRouter()
  const { services, updateServiceTraffic } = useCloudConnectStore()
  const { data: topology } = useCloudTopology()

  const [providerFilter, setProviderFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [regionFilter, setRegionFilter] = useState("all")

  const regions = useMemo(() => Array.from(new Set(services.map((s) => s.region))).sort(), [services])
  const types = useMemo(() => Array.from(new Set(services.map((s) => s.type))).sort(), [services])

  const { nodes: initNodes, edges: initEdges } = useMemo(
    () => buildLayout(services, providerFilter, typeFilter, statusFilter, regionFilter),
    [services, providerFilter, typeFilter, statusFilter, regionFilter],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)

  // Update nodes/edges when filters or services change
  useEffect(() => {
    const { nodes: n, edges: e } = buildLayout(services, providerFilter, typeFilter, statusFilter, regionFilter)
    setNodes(n)
    setEdges(e)
  }, [services, providerFilter, typeFilter, statusFilter, regionFilter, setNodes, setEdges])

  // Simulated traffic updates
  useEffect(() => {
    const interval = setInterval(() => {
      updateServiceTraffic()
    }, 2000)
    return () => clearInterval(interval)
  }, [updateServiceTraffic])

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      router.push(`/dashboard/cloud-connect/services/${node.id}`)
    },
    [router],
  )

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Topology</h1>
          <p className="text-sm text-muted-foreground">
            Real-time service map across all connected cloud accounts. Double-click a node to view details.
          </p>
        </div>
      </div>

      {/* Flow Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const svc = n.data?.service as DiscoveredService | undefined
              return svc ? providerColors[svc.provider].node : "#888"
            }}
            maskColor="rgba(0,0,0,0.1)"
          />

          {/* Filter Panel */}
          <Panel position="top-left">
            <Card className="shadow-lg">
              <CardContent className="p-3 flex items-center gap-2 flex-wrap">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={providerFilter} onValueChange={setProviderFilter}>
                  <SelectTrigger className="h-8 w-[120px] text-xs">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="gcp">GCP</SelectItem>
                    <SelectItem value="azure">Azure</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-8 w-[120px] text-xs">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {types.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-[110px] text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="stopped">Stopped</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={regionFilter} onValueChange={setRegionFilter}>
                  <SelectTrigger className="h-8 w-[130px] text-xs">
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {regions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </Panel>

          {/* Legend */}
          <Panel position="bottom-left">
            <Card className="shadow-lg">
              <CardContent className="p-3 space-y-2">
                <div className="text-xs font-semibold mb-1">Legend</div>
                <div className="flex items-center gap-3 text-[11px]">
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded border-2 border-orange-400 bg-orange-50" />
                    <span>AWS</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded border-2 border-blue-400 bg-blue-50" />
                    <span>GCP</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded border-2 border-purple-400 bg-purple-50" />
                    <span>Azure</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <div className="flex items-center gap-1">
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                    <span>Running</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                    <span>Warning</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    <span>Error</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                    <span>Stopped</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <div className="flex items-center gap-1">
                    <div className="h-0.5 w-6 bg-amber-500" style={{ borderTop: "2px dashed #f59e0b" }} />
                    <span>Cross-cloud</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  )
}

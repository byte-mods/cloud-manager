"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { Suspense, useCallback, useEffect, useRef, useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import {
  Save,
  Rocket,
  Grid3X3,
  Map,
  Download,
  Undo2,
  Redo2,
  AlertTriangle,
  DollarSign,
  Box,
  Link2,
  Pencil,
  Check,
  Brain,
  FileCode2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import ServicePalette from "@/components/infrastructure/service-palette"
import ConfigPanel from "@/components/infrastructure/config-panel"
import ServiceNodeComponent from "@/components/infrastructure/service-node"
import TrafficEdgeComponent from "@/components/infrastructure/traffic-edge"
import AIReviewPanel from "@/components/infrastructure/ai-review-panel"
import TerraformExportDialog from "@/components/infrastructure/terraform-export-dialog"
import {
  useInfrastructureStore,
  SERVICE_COSTS,
  analyzeSecurityIssues,
  type ServiceDefinition,
  type ServiceNode,
} from "@/stores/infrastructure-store"

const nodeTypes = { service: ServiceNodeComponent }
const edgeTypes = { traffic: TrafficEdgeComponent }

export default function DesignerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-3.5rem)]"><p className="text-sm text-muted-foreground">Loading designer...</p></div>}>
      <DesignerContent />
    </Suspense>
  )
}

function DesignerContent() {
  const { data: savedProjects } = useQuery({ queryKey: ['infra-projects'], queryFn: () => apiClient.get('/v1/cloud/devops/iac'), enabled: false })
  const searchParams = useSearchParams()
  const projectId = searchParams.get("projectId")

  const {
    currentProject,
    loadProject,
    createProject,
    saveProject,
    setNodes: storeSetNodes,
    setEdges: storeSetEdges,
    addNode,
    setSelectedNodeId,
    selectedNodeId,
    getTotalCost,
    getSecuritySummary,
    updateTraffic,
    updateProjectName,
  } = useInfrastructureStore()

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [showMinimap, setShowMinimap] = useState(true)
  const [showAIReview, setShowAIReview] = useState(false)
  const [showTerraformExport, setShowTerraformExport] = useState(false)
  const [showDeployDialog, setShowDeployDialog] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [projectName, setProjectName] = useState("")
  const initialized = useRef(false)

  // Load or create project
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    if (projectId) {
      loadProject(projectId)
    } else {
      createProject("Untitled Project", "", "aws")
    }
  }, [projectId, loadProject, createProject])

  // Sync from store to local state
  useEffect(() => {
    if (currentProject) {
      setNodes(currentProject.nodes as Node[])
      setEdges(currentProject.edges as Edge[])
      setProjectName(currentProject.name)
    }
  }, [currentProject, setNodes, setEdges])

  // Sync local state back to store on changes
  useEffect(() => {
    if (currentProject && nodes.length >= 0) {
      storeSetNodes(nodes)
    }
  }, [nodes])

  useEffect(() => {
    if (currentProject && edges.length >= 0) {
      storeSetEdges(edges)
    }
  }, [edges])

  // Traffic simulation
  useEffect(() => {
    const interval = setInterval(() => {
      updateTraffic()
    }, 2000)
    return () => clearInterval(interval)
  }, [updateTraffic])

  // Handle new connections
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        id: `e-${params.source}-${params.target}-${Date.now()}`,
        type: "traffic",
        data: { protocol: "HTTP", port: 443, encrypted: true, trafficRate: 500 },
      } as Edge
      setEdges(eds => addEdge(newEdge, eds))
    },
    [setEdges]
  )

  // Handle drop from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const raw = event.dataTransfer.getData("application/reactflow")
      if (!raw || !rfInstance) return

      const service: ServiceDefinition = JSON.parse(raw)
      const position = rfInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const id = `${service.serviceName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`
      const cost = SERVICE_COSTS[service.serviceName] ?? 0
      const serviceNode: ServiceNode = {
        id,
        type: service.type,
        provider: service.provider,
        serviceName: service.serviceName,
        label: service.serviceName,
        config: { ...service.defaultConfig },
        estimatedMonthlyCost: cost,
        securityIssues: [],
        trafficIn: 0,
        trafficOut: 0,
      }
      serviceNode.securityIssues = analyzeSecurityIssues(serviceNode)

      const newNode: Node = {
        id,
        type: "service",
        position,
        data: { serviceNode },
      }
      setNodes(nds => [...nds, newNode])
    },
    [rfInstance, setNodes]
  )

  // Node selection
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id)
    },
    [setSelectedNodeId]
  )

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [setSelectedNodeId])

  // Save
  const handleSave = useCallback(() => {
    saveProject()
  }, [saveProject])

  // Export as JSON
  const handleExport = useCallback(() => {
    if (!currentProject) return
    const blob = new Blob([JSON.stringify(currentProject, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${currentProject.name.replace(/\s+/g, "_")}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [currentProject])

  // Name editing
  const handleNameSave = () => {
    updateProjectName(projectName)
    setEditingName(false)
  }

  const totalCost = getTotalCost()
  const secSummary = getSecuritySummary()

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-4 -mt-6 lg:-m-6 lg:-mt-6">
      {/* Top Toolbar */}
      <div className="h-12 border-b bg-card/80 backdrop-blur-sm flex items-center gap-2 px-3 shrink-0 z-10">
        {/* Project name */}
        <div className="flex items-center gap-1.5 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-1">
              <Input
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                className="h-7 text-sm font-semibold w-48"
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleNameSave()}
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNameSave}>
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="flex items-center gap-1.5 hover:bg-accent/50 rounded-md px-2 py-1 transition-colors"
            >
              <span className="text-sm font-semibold text-foreground truncate max-w-[200px]">
                {currentProject?.name ?? "Untitled"}
              </span>
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="h-5 w-px bg-border mx-1" />

        {/* Actions */}
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={handleSave}>
          <Save className="h-3.5 w-3.5" />
          Save
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" />
          Export JSON
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setShowTerraformExport(true)}>
          <FileCode2 className="h-3.5 w-3.5" />
          Export Terraform
        </Button>
        <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => setShowDeployDialog(true)}>
          <Rocket className="h-3.5 w-3.5" />
          Deploy
        </Button>

        <div className="h-5 w-px bg-border mx-1" />

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setShowAIReview(true)}
        >
          <Brain className="h-3.5 w-3.5 text-violet-400" />
          AI Review
        </Button>

        <div className="h-5 w-px bg-border mx-1" />

        {/* Toggles */}
        <Button
          variant={showGrid ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle grid"
        >
          <Grid3X3 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={showMinimap ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => setShowMinimap(!showMinimap)}
          title="Toggle minimap"
        >
          <Map className="h-3.5 w-3.5" />
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Quick stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Box className="h-3.5 w-3.5" />
            <span>{nodes.length} nodes</span>
          </div>
          <div className="flex items-center gap-1">
            <Link2 className="h-3.5 w-3.5" />
            <span>{edges.length} links</span>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex min-h-0">
        {/* Left Palette */}
        <ServicePalette />

        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            snapToGrid={true}
            snapGrid={[20, 20]}
            fitView
            className="bg-background"
            defaultEdgeOptions={{ type: "traffic" }}
          >
            {showGrid && <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="opacity-30" />}
            <Controls className="!bg-card !border-border !shadow-md [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-accent" />
            {showMinimap && (
              <MiniMap
                className="!bg-card !border-border !shadow-md"
                maskColor="rgba(0,0,0,0.3)"
                nodeColor="#6b7280"
              />
            )}
          </ReactFlow>
        </div>

        {/* Right Config Panel */}
        {selectedNodeId && <ConfigPanel />}
      </div>

      {/* Bottom Bar */}
      <div className="h-9 border-t bg-card/80 backdrop-blur-sm flex items-center px-4 gap-6 shrink-0 text-xs">
        <div className="flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-green-500" />
          <span className="text-muted-foreground">Est. Monthly Cost:</span>
          <span className="font-semibold text-foreground">${totalCost.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
          <span className="text-muted-foreground">Security Issues:</span>
          {secSummary.total > 0 ? (
            <div className="flex items-center gap-1">
              {secSummary.critical > 0 && (
                <Badge className="text-[9px] px-1.5 py-0 h-4 bg-red-500/15 text-red-400 border-red-500/30">
                  {secSummary.critical} Critical
                </Badge>
              )}
              {secSummary.high > 0 && (
                <Badge className="text-[9px] px-1.5 py-0 h-4 bg-orange-500/15 text-orange-400 border-orange-500/30">
                  {secSummary.high} High
                </Badge>
              )}
              {secSummary.medium > 0 && (
                <Badge className="text-[9px] px-1.5 py-0 h-4 bg-yellow-500/15 text-yellow-400 border-yellow-500/30">
                  {secSummary.medium} Medium
                </Badge>
              )}
            </div>
          ) : (
            <span className="font-medium text-green-500">None</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Box className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-muted-foreground">Nodes:</span>
          <span className="font-semibold text-foreground">{nodes.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5 text-purple-500" />
          <span className="text-muted-foreground">Connections:</span>
          <span className="font-semibold text-foreground">{edges.length}</span>
        </div>
      </div>

      {/* AI Review Panel */}
      <AIReviewPanel
        open={showAIReview}
        onOpenChange={setShowAIReview}
        nodes={nodes}
        edges={edges}
      />

      {/* Terraform Export Dialog */}
      <TerraformExportDialog
        open={showTerraformExport}
        onOpenChange={setShowTerraformExport}
        nodes={nodes}
        edges={edges}
        provider={currentProject?.provider ?? "aws"}
        projectName={currentProject?.name ?? "Untitled"}
      />

      {/* Deploy Dialog (Terraform export in deploy mode) */}
      <TerraformExportDialog
        open={showDeployDialog}
        onOpenChange={setShowDeployDialog}
        nodes={nodes}
        edges={edges}
        provider={currentProject?.provider ?? "aws"}
        projectName={currentProject?.name ?? "Untitled"}
        deployMode
      />
    </div>
  )
}

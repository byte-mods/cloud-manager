"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  FolderOpen,
  LayoutTemplate,
  Box,
  DollarSign,
  Clock,
  ArrowRight,
  Cloud,
  Server,
  Network,
  Layers,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useInfrastructureStore,
  getTemplates,
  type CloudProvider,
  type Project,
} from "@/stores/infrastructure-store"

const providerBadge: Record<string, string> = {
  aws: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  gcp: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  azure: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  multi: "bg-purple-500/15 text-purple-400 border-purple-500/25",
}

export default function InfrastructurePage() {
  const router = useRouter()
  const { createProject, listProjects, deleteProject, loadProject } = useInfrastructureStore()
  const { data } = useQuery({ queryKey: ['infra-overview'], queryFn: () => apiClient.get('/v1/cloud/aws/compute/instances') })
  const [projects, setProjects] = useState<Project[]>([])
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newProvider, setNewProvider] = useState<CloudProvider>("aws")
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    setProjects(listProjects())
  }, [listProjects])

  const handleCreate = () => {
    if (!newName.trim()) return
    const id = createProject(newName.trim(), newDesc.trim(), newProvider)
    setDialogOpen(false)
    setNewName("")
    setNewDesc("")
    setNewProvider("aws")
    router.push(`/dashboard/infrastructure/designer?projectId=${id}`)
  }

  const handleOpenProject = (id: string) => {
    router.push(`/dashboard/infrastructure/designer?projectId=${id}`)
  }

  const handleDelete = (id: string) => {
    deleteProject(id)
    setProjects(listProjects())
  }

  const handleTemplate = (idx: number) => {
    const templates = getTemplates()
    const t = templates[idx]
    if (!t) return
    const id = createProject(t.name, t.description, t.provider)
    loadProject(id)
    // Save template nodes/edges into this project
    const store = useInfrastructureStore.getState()
    const proj = store.currentProject
    if (proj) {
      const updated = { ...proj, nodes: t.nodes, edges: t.edges, totalEstimatedCost: t.totalEstimatedCost }
      useInfrastructureStore.setState({ currentProject: updated })
      store.saveProject()
    }
    router.push(`/dashboard/infrastructure/designer?projectId=${id}`)
  }

  const totalServices = projects.reduce((sum, p) => sum + p.nodes.length, 0)
  const totalCost = projects.reduce((sum, p) => sum + (p.totalEstimatedCost ?? 0), 0)

  const templates = getTemplates()

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="rounded-lg p-2 bg-primary/10">
            <Network className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Infrastructure Designer</h1>
            <p className="text-sm text-muted-foreground">
              Visually design, plan, and estimate costs for cloud architectures with a drag-and-drop canvas.
            </p>
          </div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* New Project */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:border-primary/50 transition-colors group">
              <CardHeader className="pb-3">
                <div className="rounded-lg p-2.5 bg-green-500/10 w-fit mb-2 group-hover:bg-green-500/20 transition-colors">
                  <Plus className="h-5 w-5 text-green-500" />
                </div>
                <CardTitle className="text-base">New Project</CardTitle>
                <CardDescription className="text-xs">
                  Start with a blank canvas and build your architecture from scratch.
                </CardDescription>
              </CardHeader>
            </Card>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Set up a new infrastructure design project.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Project Name</Label>
                <Input
                  placeholder="My Infrastructure"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Production web application stack"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Primary Provider</Label>
                <Select value={newProvider} onValueChange={v => setNewProvider(v as CloudProvider)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="gcp">Google Cloud</SelectItem>
                    <SelectItem value="azure">Azure</SelectItem>
                    <SelectItem value="multi">Multi-Cloud</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newName.trim()}>Create Project</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Open Project */}
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors group"
          onClick={() => router.push("/dashboard/infrastructure/projects")}
        >
          <CardHeader className="pb-3">
            <div className="rounded-lg p-2.5 bg-blue-500/10 w-fit mb-2 group-hover:bg-blue-500/20 transition-colors">
              <FolderOpen className="h-5 w-5 text-blue-500" />
            </div>
            <CardTitle className="text-base">Open Project</CardTitle>
            <CardDescription className="text-xs">
              Browse and open your saved infrastructure designs.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Templates */}
        <Card className="group">
          <CardHeader className="pb-3">
            <div className="rounded-lg p-2.5 bg-purple-500/10 w-fit mb-2 group-hover:bg-purple-500/20 transition-colors">
              <LayoutTemplate className="h-5 w-5 text-purple-500" />
            </div>
            <CardTitle className="text-base">Templates</CardTitle>
            <CardDescription className="text-xs">
              Start from a pre-built architecture pattern.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {templates.map((t, i) => (
              <button
                key={i}
                onClick={() => handleTemplate(i)}
                className="flex items-center justify-between w-full text-left px-3 py-2 rounded-md border border-border/50 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium truncate">{t.name}</span>
                  <Badge className={`text-[9px] px-1 py-0 h-3.5 border shrink-0 ${providerBadge[t.provider]}`}>
                    {t.provider.toUpperCase()}
                  </Badge>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-blue-500/10">
                <FolderOpen className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{projects.length}</p>
                <p className="text-xs text-muted-foreground">Total Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-green-500/10">
                <Box className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalServices}</p>
                <p className="text-xs text-muted-foreground">Services Designed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-orange-500/10">
                <DollarSign className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">${totalCost.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Est. Monthly Cost</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects */}
      {projects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Projects</h2>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => router.push("/dashboard/infrastructure/projects")}>
              View All
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              .slice(0, 6)
              .map(project => (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => handleOpenProject(project.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm truncate">{project.name}</CardTitle>
                      <Badge className={`text-[9px] px-1.5 py-0 h-4 border shrink-0 ${providerBadge[project.provider]}`}>
                        {project.provider.toUpperCase()}
                      </Badge>
                    </div>
                    {project.description && (
                      <CardDescription className="text-xs line-clamp-2">{project.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardFooter className="text-xs text-muted-foreground gap-4">
                    <span className="flex items-center gap-1">
                      <Box className="h-3 w-3" />
                      {project.nodes.length} nodes
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      ${(project.totalEstimatedCost ?? 0).toFixed(0)}/mo
                    </span>
                    <span className="flex items-center gap-1 ml-auto">
                      <Clock className="h-3 w-3" />
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </CardFooter>
                </Card>
              ))}
          </div>
        </div>
      )}

      {projects.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Cloud className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No projects yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Create your first infrastructure design project or start from a template to get going quickly.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                New Project
              </Button>
              <Button variant="outline" onClick={() => handleTemplate(0)}>
                <LayoutTemplate className="h-4 w-4 mr-1.5" />
                Use Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  FolderOpen,
  Box,
  DollarSign,
  Clock,
  Copy,
  Trash2,
  ArrowLeft,
  Cloud,
  Plus,
  Link2,
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
import {
  useInfrastructureStore,
  type Project,
} from "@/stores/infrastructure-store"

const providerBadge: Record<string, string> = {
  aws: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  gcp: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  azure: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  multi: "bg-purple-500/15 text-purple-400 border-purple-500/25",
}

export default function ProjectsPage() {
  const router = useRouter()
  const { listProjects, deleteProject, duplicateProject } = useInfrastructureStore()
  const { data: savedProjects } = useQuery({ queryKey: ['infra-projects'], queryFn: () => apiClient.get('/v1/cloud/devops/iac'), enabled: false })
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    setProjects(listProjects())
  }, [listProjects])

  const handleOpen = (id: string) => {
    router.push(`/dashboard/infrastructure/designer?projectId=${id}`)
  }

  const handleDuplicate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    duplicateProject(id)
    setProjects(listProjects())
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteProject(id)
    setProjects(listProjects())
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/dashboard/infrastructure")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground">
              {projects.length} infrastructure {projects.length === 1 ? "project" : "projects"}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => router.push("/dashboard/infrastructure")}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Project
        </Button>
      </div>

      {/* Projects Grid */}
      {projects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .map(project => (
              <Card
                key={project.id}
                className="cursor-pointer hover:border-primary/50 transition-colors group"
                onClick={() => handleOpen(project.id)}
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
                <CardContent className="pb-2">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Box className="h-3 w-3" />
                      {project.nodes.length} nodes
                    </span>
                    <span className="flex items-center gap-1">
                      <Link2 className="h-3 w-3" />
                      {project.edges.length} links
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      ${(project.totalEstimatedCost ?? 0).toFixed(0)}/mo
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between pt-2">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(project.updatedAt).toLocaleDateString()} {new Date(project.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={e => handleDuplicate(e, project.id)}
                      title="Duplicate"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={e => handleDelete(e, project.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Cloud className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No projects yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Create your first infrastructure design project to start building cloud architectures visually.
            </p>
            <Button onClick={() => router.push("/dashboard/infrastructure")}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create First Project
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

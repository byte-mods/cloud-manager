"use client"

import { useState } from "react"
import {
  Plus,
  FolderKanban,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useOrganizationStore } from "@/stores/organization-store"
import { useOrganization } from "@/hooks/use-settings"

const statusColor: Record<string, string> = {
  "on-track": "bg-green-500/10 text-green-500",
  "at-risk": "bg-yellow-500/10 text-yellow-500",
  "over-budget": "bg-red-500/10 text-red-500",
}

const statusLabel: Record<string, string> = {
  "on-track": "On Track",
  "at-risk": "At Risk",
  "over-budget": "Over Budget",
}

export default function ProjectsPage() {
  const { projects, teams, addProject, getTeamName } = useOrganizationStore()
  const { data: orgData } = useOrganization()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newTeamId, setNewTeamId] = useState("")
  const [newBudget, setNewBudget] = useState("")
  const [newTags, setNewTags] = useState("")

  const handleCreate = () => {
    if (!newName.trim() || !newTeamId || !newBudget) return
    addProject({
      name: newName.trim(),
      description: newDesc.trim(),
      teamId: newTeamId,
      budgetLimit: parseInt(newBudget, 10),
      currentSpend: 0,
      status: "on-track",
      tags: newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    })
    setNewName("")
    setNewDesc("")
    setNewTeamId("")
    setNewBudget("")
    setNewTags("")
    setIsCreateOpen(false)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage projects, assign teams, and track budget utilization.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
              <DialogDescription>
                Add a new project to your organization.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Project Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Mobile App Backend"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Brief description"
                />
              </div>
              <div className="space-y-2">
                <Label>Team</Label>
                <Select value={newTeamId} onValueChange={setNewTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Budget Limit ($)</Label>
                <Input
                  type="number"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  placeholder="5000"
                />
              </div>
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="production, api"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Spend</TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => {
                const pct = Math.round(
                  (project.currentSpend / project.budgetLimit) * 100
                )
                return (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{project.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {project.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {getTeamName(project.teamId)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      ${project.budgetLimit.toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      ${project.currentSpend.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="w-20 h-2" />
                        <span className="text-xs text-muted-foreground">
                          {pct}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor[project.status]}>
                        {statusLabel[project.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {project.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

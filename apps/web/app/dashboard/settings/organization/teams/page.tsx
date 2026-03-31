"use client"

import { useState } from "react"
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Cloud,
  DollarSign,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useOrganizationStore } from "@/stores/organization-store"
import { useOrgTeams } from "@/hooks/use-settings"

export default function TeamsPage() {
  const { teams, members, addTeam, deleteTeam } = useOrganizationStore()
  const { data: teamsData } = useOrgTeams()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")

  const handleCreate = () => {
    if (!newName.trim()) return
    addTeam({
      name: newName.trim(),
      description: newDesc.trim(),
      memberCount: 0,
      cloudAccountsCount: 0,
      monthlyCost: 0,
    })
    setNewName("")
    setNewDesc("")
    setIsCreateOpen(false)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
          <p className="text-muted-foreground mt-1">
            Manage teams, assign members, and track cloud spend per team.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Team</DialogTitle>
              <DialogDescription>
                Add a new team to your organization.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Team Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Frontend Engineering"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What does this team manage?"
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

      {/* Teams grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {teams.map((team) => {
          const teamMembers = members.filter((m) => m.teamId === team.id)
          return (
            <Card key={team.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{team.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {team.description}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteTeam(team.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Avatar stack */}
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {teamMembers.slice(0, 4).map((m) => (
                      <Avatar
                        key={m.id}
                        className="h-8 w-8 border-2 border-background"
                      >
                        <AvatarFallback className="text-xs">
                          {m.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {teamMembers.length > 4 && (
                      <div className="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
                        +{teamMembers.length - 4}
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {team.memberCount} members
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Cloud className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {team.cloudAccountsCount} cloud accounts
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      ${team.monthlyCost.toLocaleString()}/mo
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

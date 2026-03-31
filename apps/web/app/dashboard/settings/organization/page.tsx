"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Building2,
  Users,
  FolderKanban,
  UserPlus,
  ArrowRight,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useOrganizationStore } from "@/stores/organization-store"
import { useOrganization } from "@/hooks/use-settings"

const subPages = [
  {
    title: "Teams",
    description: "Create and manage teams, assign cloud accounts, and track cost allocation.",
    icon: Users,
    href: "/dashboard/settings/organization/teams",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Projects",
    description: "Organize cloud resources into projects with budgets and team ownership.",
    icon: FolderKanban,
    href: "/dashboard/settings/organization/projects",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    title: "Members",
    description: "Invite members, manage roles, and control access across your organization.",
    icon: UserPlus,
    href: "/dashboard/settings/organization/members",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
]

export default function OrganizationPage() {
  const { teams, projects, members } = useOrganizationStore()
  const { data: org } = useOrganization()
  const [orgName, setOrgName] = useState("Acme Corp")

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organization</h1>
        <p className="text-muted-foreground mt-1">
          Manage your organization, teams, projects, and members.
        </p>
      </div>

      {/* Org name */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Organization Name</Label>
            <div className="flex gap-2">
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="max-w-sm"
              />
              <Button>Save</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teams.length}</p>
                <p className="text-xs text-muted-foreground">Teams</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <FolderKanban className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{projects.length}</p>
                <p className="text-xs text-muted-foreground">Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/10 p-2">
                <UserPlus className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{members.length}</p>
                <p className="text-xs text-muted-foreground">Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sub-page cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {subPages.map((page) => (
          <Card
            key={page.title}
            className="hover:shadow-md transition-shadow"
          >
            <CardHeader>
              <div className={`rounded-lg p-3 w-fit ${page.bgColor}`}>
                <page.icon className={`h-6 w-6 ${page.color}`} />
              </div>
              <CardTitle className="mt-3">{page.title}</CardTitle>
              <CardDescription>{page.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href={page.href}>
                  Manage {page.title}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

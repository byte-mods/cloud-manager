"use client"

import { useState } from "react"
import Link from "next/link"
import {
  BarChart3,
  Plus,
  MoreHorizontal,
  Copy,
  Trash2,
  Pencil,
  LayoutDashboard,
  Clock,
  Grid3X3,
  Star,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMonitoringDashboards } from "@/hooks/use-monitoring"

type Dashboard = {
  id: string
  name: string
  description: string
  widgetCount: number
  lastUpdated: string
  createdBy: string
  starred: boolean
  tags: string[]
}


function CreateDashboardDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Create Dashboard</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Dashboard</DialogTitle>
          <DialogDescription>Create a new custom monitoring dashboard.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="dashboard-name">Name</Label>
            <Input id="dashboard-name" placeholder="My Dashboard" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dashboard-description">Description</Label>
            <Input id="dashboard-description" placeholder="Dashboard description" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dashboard-tags">Tags (comma separated)</Label>
            <Input id="dashboard-tags" placeholder="production, api, performance" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <LayoutDashboard className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No dashboards yet</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Create your first custom monitoring dashboard.
      </p>
    </div>
  )
}

export default function DashboardsPage() {
  const { data, isLoading } = useMonitoringDashboards()

  const apiDashboards = data?.dashboards ?? []
  const dashboards: Dashboard[] = apiDashboards.map((d) => ({
    ...d,
    description: "Custom dashboard",
    widgetCount: d.widgets,
    lastUpdated: d.lastModified,
    createdBy: "admin",
    starred: false,
    tags: [],
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboards</h1>
          <p className="text-muted-foreground mt-1">
            Custom monitoring dashboards for your infrastructure.
          </p>
        </div>
        <CreateDashboardDialog />
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : dashboards.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dashboards.map((dashboard) => (
            <Card key={dashboard.id} className="hover:shadow-md transition-shadow group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{dashboard.name}</CardTitle>
                    {dashboard.starred && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem><Copy className="mr-2 h-4 w-4" /> Duplicate</DropdownMenuItem>
                      <DropdownMenuItem><Star className="mr-2 h-4 w-4" /> {dashboard.starred ? "Unstar" : "Star"}</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardDescription>{dashboard.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Grid3X3 className="h-3.5 w-3.5" />
                    <span>{dashboard.widgetCount} widgets</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{dashboard.lastUpdated}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {dashboard.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

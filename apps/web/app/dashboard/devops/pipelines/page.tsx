"use client"

import { useState } from "react"
import Link from "next/link"
import { usePipelines } from "@/hooks/use-devops"
import { ColumnDef } from "@tanstack/react-table"
import {
  Rocket,
  Plus,
  MoreHorizontal,
  Eye,
  Trash2,
  Play,
  Pencil,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
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
import { DataTable } from "@/components/ui/data-table"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Pipeline = {
  id: string
  name: string
  provider: string
  repo: string
  lastRun: string
  status: "success" | "failed" | "running" | "pending"
  duration: string
  branch: string
}

const statusIcons: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  running: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  failed: "destructive",
  running: "secondary",
  pending: "outline",
}

const columns: ColumnDef<Pipeline>[] = [
  { accessorKey: "name", header: "Pipeline", cell: ({ row }) => (
    <Link href={`/dashboard/devops/pipelines/${row.original.id}`} className="font-medium hover:underline">
      {row.original.name}
    </Link>
  )},
  { accessorKey: "provider", header: "Provider", cell: ({ row }) => (
    <Badge variant="outline" className="text-xs">{row.original.provider}</Badge>
  )},
  { accessorKey: "branch", header: "Branch", cell: ({ row }) => (
    <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{row.original.branch}</code>
  )},
  { accessorKey: "lastRun", header: "Last Run", cell: ({ row }) => (
    <span className="text-sm text-muted-foreground">{row.original.lastRun}</span>
  )},
  { accessorKey: "status", header: "Status", cell: ({ row }) => (
    <div className="flex items-center gap-2">
      {statusIcons[row.original.status]}
      <Badge variant={statusVariants[row.original.status]} className="text-xs capitalize">
        {row.original.status}
      </Badge>
    </div>
  )},
  { accessorKey: "duration", header: "Duration", cell: ({ row }) => (
    <span className="text-sm font-mono text-muted-foreground">{row.original.duration}</span>
  )},
  { id: "actions", header: "", cell: ({ row }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/devops/pipelines/${row.original.id}`}>
            <Eye className="mr-2 h-4 w-4" /> View Details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem><Play className="mr-2 h-4 w-4" /> Trigger Run</DropdownMenuItem>
        <DropdownMenuItem><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )},
]

function CreatePipelineDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Create Pipeline</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Pipeline</DialogTitle>
          <DialogDescription>Set up a new CI/CD pipeline.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="pl-name">Pipeline Name</Label>
            <Input id="pl-name" placeholder="my-service-deploy" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pl-repo">Repository</Label>
            <Input id="pl-repo" placeholder="org/my-service" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pl-provider">Provider</Label>
            <Select>
              <SelectTrigger id="pl-provider"><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="github-actions">GitHub Actions</SelectItem>
                <SelectItem value="gitlab-ci">GitLab CI</SelectItem>
                <SelectItem value="jenkins">Jenkins</SelectItem>
                <SelectItem value="circleci">CircleCI</SelectItem>
                <SelectItem value="aws-codepipeline">AWS CodePipeline</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pl-branch">Default Branch</Label>
            <Input id="pl-branch" placeholder="main" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Create Pipeline</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Rocket className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No pipelines configured</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Create your first CI/CD pipeline to start automating deployments.
      </p>
    </div>
  )
}

export default function PipelinesPage() {
  const { data, isLoading, error } = usePipelines()
  const pipelines = (data?.pipelines ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    provider: p.stages.join(", ") || "CI/CD",
    repo: p.repository,
    lastRun: p.lastRun ?? "Never",
    status: (p.status === "succeeded" ? "success" : p.status === "cancelled" ? "pending" : p.status) as Pipeline["status"],
    duration: p.duration ? `${Math.floor(p.duration / 60)}m ${p.duration % 60}s` : "-",
    branch: p.branch,
  }))

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CI/CD Pipelines</h1>
          <p className="text-muted-foreground mt-1">Manage continuous integration and deployment pipelines.</p>
        </div>
        <div className="text-destructive text-sm">Failed to load pipelines. Please try again later.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CI/CD Pipelines</h1>
          <p className="text-muted-foreground mt-1">
            Manage continuous integration and deployment pipelines.
          </p>
        </div>
        <CreatePipelineDialog />
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : pipelines.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pipelines ({pipelines.length})</CardTitle>
            <CardDescription>All CI/CD pipelines across providers</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={pipelines} searchKey="name" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { usePipeline } from "@/hooks/use-devops"
import { ColumnDef } from "@tanstack/react-table"
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowRight,
  MoreHorizontal,
  RotateCcw,
  Eye,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Stage = {
  name: string
  status: "success" | "failed" | "running" | "pending" | "skipped"
  duration: string
}

type PipelineRun = {
  id: string
  number: number
  trigger: string
  branch: string
  commit: string
  status: "success" | "failed" | "running" | "pending"
  duration: string
  startedAt: string
}

const stageStatusColors: Record<string, string> = {
  success: "border-green-500 bg-green-500/10",
  failed: "border-red-500 bg-red-500/10",
  running: "border-blue-500 bg-blue-500/10",
  pending: "border-muted bg-muted/50",
  skipped: "border-muted bg-muted/30",
}

const stageStatusIcons: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  running: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  skipped: <span className="h-4 w-4 text-muted-foreground text-xs">-</span>,
}

const runStatusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  failed: "destructive",
  running: "secondary",
  pending: "outline",
}

const runColumns: ColumnDef<PipelineRun>[] = [
  { accessorKey: "number", header: "#", cell: ({ row }) => (
    <span className="font-mono text-sm">#{row.original.number}</span>
  )},
  { accessorKey: "trigger", header: "Trigger", cell: ({ row }) => (
    <Badge variant="outline" className="text-xs">{row.original.trigger}</Badge>
  )},
  { accessorKey: "branch", header: "Branch", cell: ({ row }) => (
    <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{row.original.branch}</code>
  )},
  { accessorKey: "commit", header: "Commit", cell: ({ row }) => (
    <code className="text-xs font-mono text-muted-foreground">{row.original.commit}</code>
  )},
  { accessorKey: "status", header: "Status", cell: ({ row }) => (
    <Badge variant={runStatusVariants[row.original.status]} className="text-xs capitalize">
      {row.original.status}
    </Badge>
  )},
  { accessorKey: "duration", header: "Duration", cell: ({ row }) => (
    <span className="text-sm font-mono text-muted-foreground">{row.original.duration}</span>
  )},
  { accessorKey: "startedAt", header: "Started", cell: ({ row }) => (
    <span className="text-sm text-muted-foreground">{row.original.startedAt}</span>
  )},
  { id: "actions", header: "", cell: ({ row }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> View Logs</DropdownMenuItem>
        <DropdownMenuItem><RotateCcw className="mr-2 h-4 w-4" /> Re-run</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )},
]

function StageVisualization({ stages }: { stages: Stage[] }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-2">
      {stages.map((stage, index) => (
        <div key={stage.name} className="flex items-center shrink-0">
          <div className={`border-2 rounded-lg p-3 min-w-[140px] ${stageStatusColors[stage.status]}`}>
            <div className="flex items-center gap-2 mb-1">
              {stageStatusIcons[stage.status]}
              <span className="text-xs font-medium truncate">{stage.name}</span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">{stage.duration}</span>
          </div>
          {index < stages.length - 1 && (
            <ArrowRight className="h-4 w-4 text-muted-foreground mx-1 shrink-0" />
          )}
        </div>
      ))}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export default function PipelineDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { data: pipeline, isLoading, error } = usePipeline(id)

  const pipelineStages: Stage[] = (pipeline?.stages ?? []).map((name, i, arr) => ({
    name,
    status: pipeline?.status === "succeeded" ? "success"
      : pipeline?.status === "failed" && i === arr.length - 1 ? "failed"
      : pipeline?.status === "running" && i === Math.floor(arr.length / 2) ? "running"
      : i < Math.floor(arr.length / 2) ? "success"
      : "pending",
    duration: "-",
  }))

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton />
      </div>
    )
  }

  if (error || !pipeline) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/devops/pipelines">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pipelines
          </Link>
        </Button>
        <div className="text-destructive text-sm">Failed to load pipeline details. Please try again later.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/devops/pipelines">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pipelines
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{pipeline.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline">{pipeline.trigger}</Badge>
              <code className="text-sm text-muted-foreground font-mono">{pipeline.repository}</code>
              <code className="text-sm bg-muted px-2 py-0.5 rounded font-mono">{pipeline.branch}</code>
            </div>
          </div>
        </div>
        <Button>
          <Play className="mr-2 h-4 w-4" /> Trigger Run
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Run - Pipeline Stages</CardTitle>
          <CardDescription>Stage progression for the latest run</CardDescription>
        </CardHeader>
        <CardContent>
          <StageVisualization stages={pipelineStages} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Run History</CardTitle>
          <CardDescription>Previous pipeline executions</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={runColumns} data={[]} searchKey="branch" />
        </CardContent>
      </Card>
    </div>
  )
}

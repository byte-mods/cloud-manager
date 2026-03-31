"use client"

import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import {
  Layers,
  Plus,
  MoreHorizontal,
  Cloud,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useResources, type Resource } from "@/hooks/use-resources"

type BatchJob = Resource & {
  metadata?: {
    queue?: string
    duration?: string
    startedAt?: string
    completedAt?: string
    exitCode?: number
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  succeeded: "default",
  running: "default",
  pending: "outline",
  submitted: "outline",
  failed: "destructive",
  cancelled: "secondary",
}

const columns: ColumnDef<BatchJob>[] = [
  {
    accessorKey: "name",
    header: "Job Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
  },
  {
    id: "queue",
    header: "Queue",
    cell: ({ row }) => (
      <span className="text-sm font-mono">
        {row.original.metadata?.queue ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status
      return (
        <Badge variant={statusVariants[status] ?? "outline"}>
          {status}
        </Badge>
      )
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.createdAt}
      </span>
    ),
  },
  {
    id: "duration",
    header: "Duration",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.metadata?.duration ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Cloud className="h-4 w-4" />
        <span className="uppercase text-xs font-medium">
          {row.original.provider}
        </span>
      </div>
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>View Details</DropdownMenuItem>
          <DropdownMenuItem>View Logs</DropdownMenuItem>
          <DropdownMenuSeparator />
          {row.original.status === "running" && (
            <DropdownMenuItem className="text-destructive">
              Cancel Job
            </DropdownMenuItem>
          )}
          <DropdownMenuItem>Clone Job</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

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
      <Layers className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No batch jobs found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Get started by submitting your first batch computing job.
      </p>
      <Button>
        <Plus className="mr-2 h-4 w-4" />
        Submit Job
      </Button>
    </div>
  )
}

export default function BatchPage() {
  const { data, isLoading } = useResources("compute/batch")
  const jobs = (data?.resources ?? []) as BatchJob[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Batch</h1>
          <p className="text-muted-foreground mt-1">
            Manage batch computing jobs and processing queues.
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Submit Job
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : jobs.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {jobs.length} Job{jobs.length !== 1 ? "s" : ""}
            </CardTitle>
            <CardDescription>
              All batch jobs across providers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={jobs}
              searchKey="name"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

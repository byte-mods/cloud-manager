"use client"

import { Cpu } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import { type ColumnDef } from "@tanstack/react-table"
import { useTrainingJobs } from "@/hooks/use-ai-ml"

type TrainingJob = {
  id: string
  name: string
  algorithm: string
  status: "running" | "completed" | "failed" | "queued"
  duration: string
  accuracy: string
  loss: string
  provider: string
}

const columns: ColumnDef<TrainingJob>[] = [
  { accessorKey: "name", header: "Job Name" },
  { accessorKey: "algorithm", header: "Algorithm" },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => <Badge variant="outline">{row.original.provider}</Badge>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status
      const cfg: Record<string, string> = { running: "bg-blue-500/10 text-blue-500", completed: "bg-green-500/10 text-green-500", failed: "bg-red-500/10 text-red-500", queued: "bg-yellow-500/10 text-yellow-500" }
      return <Badge className={cfg[s]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Badge>
    },
  },
  { accessorKey: "duration", header: "Duration" },
  { accessorKey: "accuracy", header: "Accuracy" },
  { accessorKey: "loss", header: "Loss" },
]

export default function TrainingPage() {
  const { data, isLoading } = useTrainingJobs()

  const jobs: TrainingJob[] = (data?.jobs ?? []).map(j => ({
    id: j.id,
    name: j.name,
    algorithm: "Training Job",
    status: j.status,
    duration: j.startedAt ? "In progress" : "—",
    accuracy: j.status === 'completed' ? "—" : "—",
    loss: j.status === 'completed' ? "—" : "—",
    provider: "Cloud Provider",
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Training Jobs</h1>
        <p className="text-muted-foreground mt-1">Monitor and manage model training jobs.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Running</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-500">{jobs.filter((j) => j.status === "running").length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Completed</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-500">{jobs.filter((j) => j.status === "completed").length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Failed</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-500">{jobs.filter((j) => j.status === "failed").length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Queued</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-500">{jobs.filter((j) => j.status === "queued").length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Training Jobs</CardTitle>
          <CardDescription>Model training across all providers</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <DataTable columns={columns} data={jobs} searchKey="name" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

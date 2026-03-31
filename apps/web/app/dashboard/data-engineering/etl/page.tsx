"use client"

import { useState } from "react"
import { Plus, Database } from "lucide-react"
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
import { DataTable } from "@/components/ui/data-table"
import { type ColumnDef } from "@tanstack/react-table"
import { useETLJobs } from "@/hooks/use-data-engineering"

type ETLPipeline = {
  id: string
  name: string
  provider: string
  source: string
  destination: string
  schedule: string
  lastRun: string
  status: "running" | "succeeded" | "failed" | "paused"
}

const columns: ColumnDef<ETLPipeline>[] = [
  { accessorKey: "name", header: "Name" },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => <Badge variant="outline">{row.original.provider}</Badge>,
  },
  { accessorKey: "source", header: "Source" },
  { accessorKey: "destination", header: "Destination" },
  { accessorKey: "schedule", header: "Schedule" },
  { accessorKey: "lastRun", header: "Last Run" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status
      const config: Record<string, string> = {
        running: "bg-blue-500/10 text-blue-500",
        succeeded: "bg-green-500/10 text-green-500",
        failed: "bg-red-500/10 text-red-500",
        paused: "bg-yellow-500/10 text-yellow-500",
      }
      return <Badge className={config[s]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Badge>
    },
  },
]

export default function ETLPipelinesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { data, isLoading, error } = useETLJobs()

  const pipelines: ETLPipeline[] = (data?.jobs ?? []).map((j) => ({
    id: j.id,
    name: j.name,
    provider: "-",
    source: "-",
    destination: "-",
    schedule: j.schedule,
    lastRun: j.lastRun ?? "-",
    status: j.status === "completed" ? "succeeded" : j.status === "scheduled" ? "paused" : j.status as ETLPipeline["status"],
  }))

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ETL Pipelines</h1>
          <p className="text-muted-foreground mt-1">
            Manage extract, transform, and load pipelines across providers.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Create Pipeline</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create ETL Pipeline</DialogTitle>
              <DialogDescription>Set up a new data pipeline.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Pipeline Name</Label>
                <Input placeholder="e.g., User Events ETL" />
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws-glue">AWS Glue</SelectItem>
                    <SelectItem value="gcp-dataflow">GCP Dataflow</SelectItem>
                    <SelectItem value="azure-data-factory">Azure Data Factory</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Input placeholder="Source system" />
                </div>
                <div className="space-y-2">
                  <Label>Destination</Label>
                  <Input placeholder="Destination system" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Schedule</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select schedule" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">Real-time</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => setIsDialogOpen(false)}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Pipelines</CardTitle>
          <CardDescription>ETL pipelines across all cloud providers</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <DataTable columns={columns} data={pipelines} searchKey="name" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

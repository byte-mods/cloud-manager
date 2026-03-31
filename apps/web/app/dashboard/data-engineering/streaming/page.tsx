"use client"

import { useState } from "react"
import { Radio, Activity } from "lucide-react"
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
import { useStreamingPipelines } from "@/hooks/use-data-engineering"

type Stream = {
  id: string
  name: string
  provider: string
  service: string
  throughput: string
  shards: number
  consumers: number
  status: "active" | "inactive" | "error"
}

const columns: ColumnDef<Stream>[] = [
  { accessorKey: "name", header: "Stream Name" },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => <Badge variant="outline">{row.original.provider}</Badge>,
  },
  { accessorKey: "service", header: "Service" },
  { accessorKey: "throughput", header: "Throughput" },
  { accessorKey: "shards", header: "Shards/Partitions" },
  { accessorKey: "consumers", header: "Consumers" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status
      const cls = s === "active" ? "bg-green-500/10 text-green-500" : s === "inactive" ? "bg-yellow-500/10 text-yellow-500" : "bg-red-500/10 text-red-500"
      return <Badge className={cls}>{s.charAt(0).toUpperCase() + s.slice(1)}</Badge>
    },
  },
]

export default function StreamingPage() {
  const { data, isLoading, error } = useStreamingPipelines()

  const streams: Stream[] = (data?.pipelines ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    provider: "-",
    service: p.source,
    throughput: `${p.throughput} MB/s`,
    shards: 0,
    consumers: 0,
    status: p.status === "running" ? "active" as const : p.status === "stopped" ? "inactive" as const : "error" as const,
  }))

  const totalThroughput = streams.reduce((sum, s) => sum + parseFloat(s.throughput), 0).toFixed(1)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Streaming</h1>
        <p className="text-muted-foreground mt-1">
          Monitor real-time data streams across Kinesis, Pub/Sub, and Event Hubs.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Streams</CardTitle>
            <Radio className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{streams.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Throughput</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalThroughput} MB/s</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-500">{streams.filter((s) => s.status === "active").length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Consumers</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{streams.reduce((sum, s) => sum + s.consumers, 0)}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Streams</CardTitle>
          <CardDescription>Real-time data streams across all providers</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <DataTable columns={columns} data={streams} searchKey="name" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import {
  Cpu,
} from "lucide-react"
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
import { useResources, type Resource } from "@/hooks/use-resources"

type Device = Resource & {
  metadata?: {
    deviceType?: string
    lastActive?: string
    messagesPerDay?: number
    iotProvider?: string
  }
}

const columns: ColumnDef<Device>[] = [
  { accessorKey: "name", header: "Name" },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <span>{row.original.metadata?.deviceType ?? row.original.type}</span>
    ),
  },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => (
      <Badge variant="outline">
        {row.original.metadata?.iotProvider ?? row.original.provider}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status
      const cls =
        s === "running" || s === "connected"
          ? "bg-green-500/10 text-green-500"
          : s === "stopped" || s === "disconnected"
          ? "bg-yellow-500/10 text-yellow-500"
          : "bg-red-500/10 text-red-500"
      return <Badge className={cls}>{s}</Badge>
    },
  },
  {
    id: "lastActive",
    header: "Last Active",
    cell: ({ row }) => (
      <span>{row.original.metadata?.lastActive ?? "-"}</span>
    ),
  },
  {
    id: "messagesPerDay",
    header: "Messages/day",
    cell: ({ row }) =>
      row.original.metadata?.messagesPerDay?.toLocaleString() ?? "-",
  },
]

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

export default function DevicesPage() {
  const { data, isLoading } = useResources("iot/devices")

  const devices = (data?.resources ?? []) as Device[]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">IoT Devices</h1>
        <p className="text-muted-foreground mt-1">
          Manage IoT devices across all providers.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Devices</CardTitle>
          <CardDescription>Registered IoT devices</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSkeleton />
          ) : devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Cpu className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No devices found</h3>
              <p className="text-muted-foreground text-sm mt-1">
                No IoT devices have been registered yet.
              </p>
            </div>
          ) : (
            <DataTable columns={columns} data={devices} searchKey="name" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

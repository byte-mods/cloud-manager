"use client"

import { useIoTEdgeDevices } from "@/hooks/use-iot"
import { useCloudProvider } from "@/hooks/use-cloud-provider"
import { Wifi } from "lucide-react"
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

type EdgeDevice = {
  id: string
  name: string
  provider: string
  service: string
  location: string
  deployments: number
  status: "online" | "offline" | "updating"
  lastHeartbeat: string
}

const columns: ColumnDef<EdgeDevice>[] = [
  { accessorKey: "name", header: "Device Name" },
  { accessorKey: "provider", header: "Provider", cell: ({ row }) => <Badge variant="outline">{row.original.provider}</Badge> },
  { accessorKey: "service", header: "Service" },
  { accessorKey: "location", header: "Location" },
  { accessorKey: "deployments", header: "Deployments" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status
      const cls = s === "online" ? "bg-green-500/10 text-green-500" : s === "updating" ? "bg-blue-500/10 text-blue-500" : "bg-red-500/10 text-red-500"
      return <Badge className={cls}>{s.charAt(0).toUpperCase() + s.slice(1)}</Badge>
    },
  },
  { accessorKey: "lastHeartbeat", header: "Last Heartbeat" },
]

export default function EdgeComputingPage() {
  const { provider } = useCloudProvider()
  const { data, isLoading, error } = useIoTEdgeDevices(provider)

  const edgeDevices: EdgeDevice[] = (data?.devices ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    provider: provider,
    service: d.type,
    location: d.location,
    deployments: 0,
    status: d.status === "online" ? "online" as const : d.status === "error" ? "updating" as const : "offline" as const,
    lastHeartbeat: d.lastSeen,
  }))

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edge Computing</h1>
          <p className="text-muted-foreground mt-1">Manage edge devices and deployments.</p>
        </div>
        <div className="text-destructive text-sm">Failed to load edge devices. Please try again later.</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edge Computing</h1>
        <p className="text-muted-foreground mt-1">Manage edge devices and deployments.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Edge Devices & Deployments</CardTitle>
          <CardDescription>Edge computing nodes across all providers</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <DataTable columns={columns} data={edgeDevices} searchKey="name" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

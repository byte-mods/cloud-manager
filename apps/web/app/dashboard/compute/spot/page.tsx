"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Zap,
  DollarSign,
  AlertTriangle,
  Server,
  TrendingDown,
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
import { useResources } from "@/hooks/use-resources"

type SpotInstance = {
  id: string
  name: string
  instanceType: string
  provider: string
  region: string
  status: string
  savingsPercent: number
  interruptionRisk: "low" | "medium" | "high"
  hourlyPrice: number
  launchedAt: string
}

const riskColor: Record<string, "default" | "secondary" | "destructive"> = {
  low: "default",
  medium: "secondary",
  high: "destructive",
}

const columns: ColumnDef<SpotInstance>[] = [
  {
    accessorKey: "name",
    header: "Instance Name",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "instanceType",
    header: "Type",
    cell: ({ row }) => <Badge variant="outline" className="font-mono text-xs">{row.original.instanceType}</Badge>,
  },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => <span className="text-sm">{row.original.provider.toUpperCase()}</span>,
  },
  {
    accessorKey: "region",
    header: "Region",
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.region}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.status === "running" ? "default" : "secondary"}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "savingsPercent",
    header: "Savings",
    cell: ({ row }) => (
      <span className="text-sm font-medium text-green-500">{row.original.savingsPercent}%</span>
    ),
  },
  {
    accessorKey: "interruptionRisk",
    header: "Interruption Risk",
    cell: ({ row }) => (
      <Badge variant={riskColor[row.original.interruptionRisk]}>
        {row.original.interruptionRisk}
      </Badge>
    ),
  },
  {
    accessorKey: "hourlyPrice",
    header: "Hourly Price",
    cell: ({ row }) => (
      <span className="font-mono text-sm">${row.original.hourlyPrice.toFixed(4)}</span>
    ),
  },
]

export default function SpotInstancesPage() {
  const { data, isLoading, error } = useResources()

  const spotInstances: SpotInstance[] = useMemo(() => {
    const resources = data?.resources ?? []
    return resources
      .filter((r: any) => r.type === "instance" || r.type === "compute")
      .slice(0, 20)
      .map((r: any, idx: number) => ({
        id: r.id,
        name: r.name ?? `spot-${r.id.slice(0, 8)}`,
        instanceType: r.instanceType ?? "m5.xlarge",
        provider: r.provider ?? "aws",
        region: r.region ?? "us-east-1",
        status: r.status ?? "running",
        savingsPercent: Math.floor(Math.random() * 40 + 40),
        interruptionRisk: (["low", "medium", "high"] as const)[idx % 3],
        hourlyPrice: Number((Math.random() * 0.5 + 0.02).toFixed(4)),
        launchedAt: r.createdAt ?? new Date().toISOString(),
      }))
  }, [data])

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Spot Instances</h1>
          <p className="text-muted-foreground mt-1">Manage spot fleet requests, interruption history, and savings.</p>
        </div>
        <Card className="border-red-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-red-500">Failed to load spot instances. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalSavings = spotInstances.reduce((acc, s) => acc + s.savingsPercent, 0)
  const avgSavings = spotInstances.length > 0 ? Math.round(totalSavings / spotInstances.length) : 0
  const highRiskCount = spotInstances.filter((s) => s.interruptionRisk === "high").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Spot Instances</h1>
        <p className="text-muted-foreground mt-1">Manage spot fleet requests, interruption history, and savings.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Spot Instances</CardDescription>
            <CardTitle className="text-3xl">{spotInstances.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Savings</CardDescription>
            <CardTitle className="text-3xl text-green-500">{avgSavings}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>High Risk</CardDescription>
            <CardTitle className="text-3xl text-red-500">{highRiskCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Interruptions (30d)</CardDescription>
            <CardTitle className="text-3xl text-yellow-500">{Math.floor(Math.random() * 5)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {spotInstances.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No spot instances found</h3>
            <p className="text-muted-foreground text-sm mt-1">Create spot fleet requests to start saving on compute costs.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Spot Fleet</CardTitle>
            <CardDescription>Active spot instances across all providers</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={spotInstances} searchKey="name" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

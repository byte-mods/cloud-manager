"use client"

import { useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { useDeployments } from "@/hooks/use-devops"
import {
  Rocket,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowRightLeft,
  Layers,
  RotateCcw,
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

type Deployment = {
  id: string
  service: string
  environment: string
  version: string
  strategy: "blue-green" | "canary" | "rolling"
  status: "success" | "failed" | "in-progress" | "rollback"
  startedAt: string
  duration: string
  deployer: string
}

type StrategyInfo = {
  name: string
  key: string
  icon: React.ElementType
  description: string
  pros: string[]
  bestFor: string
}

const strategies: StrategyInfo[] = [
  {
    name: "Blue/Green",
    key: "blue-green",
    icon: ArrowRightLeft,
    description: "Maintain two identical environments. Route traffic from the current (blue) to the new (green) version instantly. Enables zero-downtime deployments with instant rollback capability.",
    pros: ["Zero downtime", "Instant rollback", "Full environment testing"],
    bestFor: "Production services requiring zero-downtime deploys",
  },
  {
    name: "Canary",
    key: "canary",
    icon: Layers,
    description: "Gradually route a small percentage of traffic to the new version while monitoring for errors. Progressively increase traffic as confidence grows.",
    pros: ["Low risk", "Real traffic testing", "Gradual rollout"],
    bestFor: "Services where you want to validate with real traffic",
  },
  {
    name: "Rolling",
    key: "rolling",
    icon: RotateCcw,
    description: "Replace instances one at a time (or in batches) with the new version. Each batch is health-checked before proceeding to the next.",
    pros: ["Resource efficient", "No extra infrastructure", "Simple to manage"],
    bestFor: "Stateless services with good health checks",
  },
]

const statusIcons: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  "in-progress": <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  rollback: <RotateCcw className="h-4 w-4 text-orange-500" />,
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  failed: "destructive",
  "in-progress": "secondary",
  rollback: "outline",
}

const strategyVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "blue-green": "default",
  canary: "secondary",
  rolling: "outline",
}

const columns: ColumnDef<Deployment>[] = [
  { accessorKey: "service", header: "Service", cell: ({ row }) => (
    <span className="font-medium">{row.original.service}</span>
  )},
  { accessorKey: "environment", header: "Environment", cell: ({ row }) => (
    <Badge variant="outline" className="text-xs capitalize">{row.original.environment}</Badge>
  )},
  { accessorKey: "version", header: "Version", cell: ({ row }) => (
    <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{row.original.version}</code>
  )},
  { accessorKey: "strategy", header: "Strategy", cell: ({ row }) => (
    <Badge variant={strategyVariants[row.original.strategy]} className="text-xs capitalize">
      {row.original.strategy === "blue-green" ? "Blue/Green" : row.original.strategy}
    </Badge>
  )},
  { accessorKey: "status", header: "Status", cell: ({ row }) => (
    <div className="flex items-center gap-2">
      {statusIcons[row.original.status]}
      <Badge variant={statusVariants[row.original.status]} className="text-xs capitalize">
        {row.original.status === "in-progress" ? "In Progress" : row.original.status}
      </Badge>
    </div>
  )},
  { accessorKey: "duration", header: "Duration", cell: ({ row }) => (
    <span className="text-sm font-mono text-muted-foreground">{row.original.duration}</span>
  )},
  { accessorKey: "startedAt", header: "Started", cell: ({ row }) => (
    <span className="text-sm text-muted-foreground">{row.original.startedAt}</span>
  )},
  { accessorKey: "deployer", header: "Deployer", cell: ({ row }) => (
    <span className="text-sm text-muted-foreground">{row.original.deployer}</span>
  )},
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
      <Rocket className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No deployments yet</h3>
      <p className="text-muted-foreground text-sm mt-1">
        Deployments will appear here once pipelines start deploying.
      </p>
    </div>
  )
}

export default function DeploymentPage() {
  const { data, isLoading, error } = useDeployments()
  const deployments: Deployment[] = (data?.deployments ?? []).map((d) => ({
    id: d.id,
    service: d.name,
    environment: d.environment,
    version: d.version,
    strategy: "rolling" as const,
    status: d.status === "active" ? "success" as const : d.status === "rolling" ? "in-progress" as const : d.status === "failed" ? "failed" as const : "in-progress" as const,
    startedAt: d.deployedAt,
    duration: "-",
    deployer: d.deployedBy,
  }))

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deployment Strategies</h1>
          <p className="text-muted-foreground mt-1">Manage deployments and configure deployment strategies.</p>
        </div>
        <div className="text-destructive text-sm">Failed to load deployments. Please try again later.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deployment Strategies</h1>
          <p className="text-muted-foreground mt-1">
            Manage deployments and configure deployment strategies.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {strategies.map((strategy) => {
          const Icon = strategy.icon
          return (
            <Card key={strategy.key} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">{strategy.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{strategy.description}</p>
                <div>
                  <p className="text-xs font-medium mb-1.5">Advantages:</p>
                  <ul className="space-y-1">
                    {strategy.pros.map((pro) => (
                      <li key={pro} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                        {pro}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Best for:</span> {strategy.bestFor}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : deployments.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Active Deployments</CardTitle>
            <CardDescription>Recent and ongoing deployments across environments</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={deployments} searchKey="service" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

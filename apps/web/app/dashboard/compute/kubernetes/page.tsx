"use client"

import { useState } from "react"
import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import {
  Cloud,
  Plus,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Server,
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
import { useResources, type Resource } from "@/hooks/use-resources"

type NodeGroup = {
  name: string
  instanceType: string
  desired: number
  min: number
  max: number
  status: string
}

type Cluster = Resource & {
  metadata?: {
    version?: string
    nodes?: number
    service?: string
    endpoint?: string
    nodeGroups?: NodeGroup[]
  }
}

const serviceLabels: Record<string, string> = {
  eks: "EKS",
  gke: "GKE",
  aks: "AKS",
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  creating: "outline",
  updating: "outline",
  deleting: "destructive",
  failed: "destructive",
}

function ExpandableRow({ cluster }: { cluster: Cluster }) {
  const [expanded, setExpanded] = useState(false)
  const nodeGroups = cluster.metadata?.nodeGroups ?? []

  return (
    <div className="border rounded-md">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <div>
            <Link
              href={`/dashboard/compute/kubernetes/${cluster.id}`}
              className="font-medium text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {cluster.name}
            </Link>
            <p className="text-xs text-muted-foreground font-mono">
              {cluster.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="uppercase text-xs">
            {serviceLabels[cluster.metadata?.service ?? ""] ?? cluster.provider}
          </Badge>
          <span className="text-sm">v{cluster.metadata?.version ?? "-"}</span>
          <span className="text-sm">
            {cluster.metadata?.nodes ?? 0} nodes
          </span>
          <Badge variant={statusVariants[cluster.status] ?? "outline"}>
            {cluster.status}
          </Badge>
          <span className="text-sm text-muted-foreground">{cluster.region}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/compute/kubernetes/${cluster.id}`}>
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>Scale</DropdownMenuItem>
              <DropdownMenuItem>Upgrade</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {expanded && nodeGroups.length > 0 && (
        <div className="border-t bg-muted/30 p-4">
          <h4 className="text-sm font-medium mb-2">Node Groups</h4>
          <div className="rounded-md border bg-background">
            <div className="grid grid-cols-6 gap-4 p-3 text-xs font-medium text-muted-foreground">
              <span>Name</span>
              <span>Instance Type</span>
              <span className="text-right">Desired</span>
              <span className="text-right">Min</span>
              <span className="text-right">Max</span>
              <span>Status</span>
            </div>
            {nodeGroups.map((ng) => (
              <div
                key={ng.name}
                className="grid grid-cols-6 gap-4 p-3 text-sm border-t"
              >
                <span className="font-medium">{ng.name}</span>
                <span className="font-mono text-xs">{ng.instanceType}</span>
                <span className="text-right">{ng.desired}</span>
                <span className="text-right">{ng.min}</span>
                <span className="text-right">{ng.max}</span>
                <Badge
                  variant={ng.status === "active" ? "default" : "outline"}
                  className="w-fit"
                >
                  {ng.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Cloud className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No Kubernetes clusters found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Get started by creating your first Kubernetes cluster.
      </p>
      <Button>
        <Plus className="mr-2 h-4 w-4" />
        Create Cluster
      </Button>
    </div>
  )
}

export default function KubernetesPage() {
  const { data, isLoading } = useResources("compute/kubernetes")
  const clusters = (data?.resources ?? []) as Cluster[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kubernetes</h1>
          <p className="text-muted-foreground mt-1">
            Manage Kubernetes clusters across EKS, GKE, and AKS.
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Cluster
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : clusters.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {clusters.length} Cluster{clusters.length !== 1 ? "s" : ""}
            </CardTitle>
            <CardDescription>
              Click on a cluster row to expand and view node groups
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {clusters.map((cluster) => (
              <ExpandableRow key={cluster.id} cluster={cluster} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

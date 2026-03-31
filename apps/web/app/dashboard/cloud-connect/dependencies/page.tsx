"use client"

import { useState, useCallback, useMemo } from "react"
import {
  Network,
  RefreshCw,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDependencyGraph, type DependencyNode, type DependencyEdge } from "@/hooks/use-dependencies"

const statusColor: Record<string, string> = {
  healthy: "bg-green-500",
  degraded: "bg-yellow-500",
  down: "bg-red-500",
  unknown: "bg-gray-500",
}

const statusBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  healthy: "default",
  degraded: "secondary",
  down: "destructive",
  unknown: "outline",
}

export default function DependenciesPage() {
  const [provider, setProvider] = useState("aws")
  const { data, isLoading, error, refetch } = useDependencyGraph(provider)

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
          <h1 className="text-3xl font-bold tracking-tight">Resource Dependencies</h1>
          <p className="text-muted-foreground mt-1">Visualize resource dependency graph across your cloud infrastructure.</p>
        </div>
        <Card className="border-red-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-red-500">Failed to load dependency graph. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const nodes = data?.nodes ?? []
  const edges = data?.edges ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resource Dependencies</h1>
          <p className="text-muted-foreground mt-1">Visualize resource dependency graph across your cloud infrastructure.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aws">AWS</SelectItem>
              <SelectItem value="azure">Azure</SelectItem>
              <SelectItem value="gcp">GCP</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Resources</CardDescription>
            <CardTitle className="text-3xl">{nodes.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Relationships</CardDescription>
            <CardTitle className="text-3xl">{edges.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Resource Types</CardDescription>
            <CardTitle className="text-3xl">{new Set(nodes.map((n) => n.type)).size}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {nodes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Network className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No dependencies found</h3>
            <p className="text-muted-foreground text-sm mt-1">Select a provider to view its resource dependency graph.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Dependency Graph</CardTitle>
            <CardDescription>Resources and their relationships for {provider.toUpperCase()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {nodes.map((node) => {
                const nodeEdges = edges.filter((e) => e.source === node.id || e.target === node.id)
                return (
                  <div key={node.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${statusColor[node.status] ?? "bg-gray-500"}`} />
                      <div>
                        <p className="font-medium">{node.name}</p>
                        <p className="text-sm text-muted-foreground">{node.type} &middot; {node.region}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusBadgeVariant[node.status] ?? "outline"}>{node.status}</Badge>
                      <Badge variant="outline">{nodeEdges.length} connection{nodeEdges.length !== 1 ? "s" : ""}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

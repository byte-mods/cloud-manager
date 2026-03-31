"use client"

import { useState } from "react"
import {
  GitCompare,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  MinusCircle,
  Server,
  Database,
  Network,
  HardDrive,
  Box,
  Clock,
  ArrowRightLeft,
  Undo2,
  Check,
  X,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts"
import {
  useDriftStore,
  type DriftResource,
  type DriftStatus,
  type CloudProvider,
} from "@/stores/drift-store"
import { useDriftDetection } from "@/hooks/use-drift"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusConfig: Record<DriftStatus, { label: string; className: string; color: string }> = {
  IN_SYNC: { label: "In Sync", className: "bg-green-500/10 text-green-700 border-green-200", color: "#22c55e" },
  DRIFTED: { label: "Drifted", className: "bg-yellow-500/10 text-yellow-700 border-yellow-200", color: "#eab308" },
  ADDED: { label: "Added", className: "bg-blue-500/10 text-blue-700 border-blue-200", color: "#3b82f6" },
  REMOVED: { label: "Removed", className: "bg-red-500/10 text-red-700 border-red-200", color: "#ef4444" },
}

const providerBadge: Record<CloudProvider, { label: string; className: string }> = {
  aws: { label: "AWS", className: "bg-amber-500/10 text-amber-700 border-amber-200" },
  gcp: { label: "GCP", className: "bg-blue-500/10 text-blue-700 border-blue-200" },
  azure: { label: "Azure", className: "bg-sky-500/10 text-sky-700 border-sky-200" },
}

const typeIcons: Record<string, typeof Server> = {
  EC2: Server,
  VM: Server,
  GCE: Server,
  VPC: Network,
  VNet: Network,
  S3: Box,
  RDS: Database,
  "Cloud SQL": Database,
  ElastiCache: HardDrive,
}

function getTypeIcon(resourceType: string) {
  return typeIcons[resourceType] || Server
}

function formatTime(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DriftDetectionPage() {
  const {
    resources,
    lastScanTime,
    isScanning,
    runDetection,
    acceptDrift,
    remediateDrift,
    ignoreDrift,
    getDriftSummary,
  } = useDriftStore()
  const { data: driftData } = useDriftDetection()

  const [selectedResource, setSelectedResource] = useState<DriftResource | null>(null)
  const summary = getDriftSummary()

  const donutData = [
    { name: "In Sync", value: summary.inSync, color: statusConfig.IN_SYNC.color },
    { name: "Drifted", value: summary.drifted, color: statusConfig.DRIFTED.color },
    { name: "Added", value: summary.added, color: statusConfig.ADDED.color },
    { name: "Removed", value: summary.removed, color: statusConfig.REMOVED.color },
  ].filter((d) => d.value > 0)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Drift Detection</h1>
          <p className="text-muted-foreground">
            Compare designed infrastructure against actual cloud state
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last scan: {formatTime(lastScanTime)}
          </span>
          <Button onClick={() => runDetection()} disabled={isScanning}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isScanning ? "animate-spin" : ""}`} />
            {isScanning ? "Scanning..." : "Run Detection"}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Resources</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
            <p className="text-xs text-muted-foreground">Resources checked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Drifted</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary.drifted}</div>
            <p className="text-xs text-muted-foreground">Config changed outside platform</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Added</CardTitle>
            <PlusCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary.added}</div>
            <p className="text-xs text-muted-foreground">Created outside platform</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Removed</CardTitle>
            <MinusCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.removed}</div>
            <p className="text-xs text-muted-foreground">Deleted unexpectedly</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart + table row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Donut chart */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Drift Status</CardTitle>
            <CardDescription>Distribution of resource states</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [`${value} resources`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Drift detail table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Resource Drift Details</CardTitle>
            <CardDescription>{resources.length} resources scanned</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resources.map((resource) => {
                const TypeIcon = getTypeIcon(resource.resourceType)
                const hasDrift =
                  resource.status === "DRIFTED" ||
                  resource.status === "ADDED" ||
                  resource.status === "REMOVED"

                return (
                  <div
                    key={resource.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      hasDrift ? "cursor-pointer hover:bg-muted/50" : ""
                    }`}
                    onClick={() => hasDrift ? setSelectedResource(resource) : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{resource.name}</span>
                            <Badge
                              variant="outline"
                              className={providerBadge[resource.provider].className}
                            >
                              {providerBadge[resource.provider].label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {resource.resourceType}
                            </span>
                          </div>
                          {resource.status !== "IN_SYNC" && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {resource.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={statusConfig[resource.status].className}
                        >
                          {statusConfig[resource.status].label}
                        </Badge>
                        {resource.status === "DRIFTED" && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                acceptDrift(resource.id)
                              }}
                              title="Accept Change"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                remediateDrift(resource.id)
                              }}
                              title="Remediate"
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                ignoreDrift(resource.id)
                              }}
                              title="Ignore"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                        {resource.status === "ADDED" && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                acceptDrift(resource.id)
                              }}
                              title="Import to Design"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                ignoreDrift(resource.id)
                              }}
                              title="Ignore"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                        {resource.status === "REMOVED" && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                remediateDrift(resource.id)
                              }}
                              title="Recreate Resource"
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                acceptDrift(resource.id)
                              }}
                              title="Remove from Design"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Inline diff for drifted resources */}
                    {resource.status === "DRIFTED" && resource.diffs.length > 0 && (
                      <div className="mt-2 rounded border bg-muted/30 p-2">
                        {resource.diffs.map((diff, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs">
                            <span className="font-medium w-28 shrink-0">{diff.field}</span>
                            <span className="flex items-center gap-1">
                              <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700 line-through">
                                {diff.designed}
                              </span>
                              <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                              <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">
                                {diff.actual}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drift comparison dialog */}
      <Dialog
        open={selectedResource !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedResource(null)
        }}
      >
        {selectedResource && (
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle>{selectedResource.name}</DialogTitle>
                <Badge variant="outline" className={providerBadge[selectedResource.provider].className}>
                  {providerBadge[selectedResource.provider].label}
                </Badge>
                <Badge variant="outline" className={statusConfig[selectedResource.status].className}>
                  {statusConfig[selectedResource.status].label}
                </Badge>
                <span className="text-sm text-muted-foreground">{selectedResource.resourceType}</span>
              </div>
              <DialogDescription>{selectedResource.description}</DialogDescription>
            </DialogHeader>

            {/* Side-by-side comparison */}
            <div className="grid grid-cols-2 gap-4">
              {/* Designed State */}
              <div>
                <h3 className="mb-2 text-sm font-semibold">Designed State</h3>
                <div className="rounded-md border">
                  {Object.keys(selectedResource.designedConfig).length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground italic">
                      No design exists for this resource
                    </div>
                  ) : (
                    Object.entries(selectedResource.designedConfig).map(([key, value]) => {
                      const isDrifted = selectedResource.actualConfig[key] !== value
                      return (
                        <div
                          key={key}
                          className={`flex items-center justify-between border-b last:border-b-0 px-3 py-2 text-sm ${
                            isDrifted ? "bg-yellow-50" : ""
                          }`}
                        >
                          <span className="font-medium text-muted-foreground">{key}</span>
                          <span className={isDrifted ? "text-yellow-700 font-medium" : ""}>{value}</span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Actual State */}
              <div>
                <h3 className="mb-2 text-sm font-semibold">Actual State</h3>
                <div className="rounded-md border">
                  {Object.keys(selectedResource.actualConfig).length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground italic">
                      Resource no longer exists in cloud
                    </div>
                  ) : (
                    Object.entries(selectedResource.actualConfig).map(([key, value]) => {
                      const isDrifted = selectedResource.designedConfig[key] !== value
                      return (
                        <div
                          key={key}
                          className={`flex items-center justify-between border-b last:border-b-0 px-3 py-2 text-sm ${
                            isDrifted ? "bg-yellow-50" : ""
                          }`}
                        >
                          <span className="font-medium text-muted-foreground">{key}</span>
                          <span className={isDrifted ? "text-yellow-700 font-medium" : ""}>{value}</span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              {selectedResource.status === "DRIFTED" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      ignoreDrift(selectedResource.id)
                      setSelectedResource(null)
                    }}
                  >
                    Ignore
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      acceptDrift(selectedResource.id)
                      setSelectedResource(null)
                    }}
                  >
                    <Check className="mr-1 h-4 w-4" />
                    Accept Change
                  </Button>
                  <Button
                    onClick={() => {
                      remediateDrift(selectedResource.id)
                      setSelectedResource(null)
                    }}
                  >
                    <Undo2 className="mr-1 h-4 w-4" />
                    Remediate
                  </Button>
                </>
              )}
              {selectedResource.status === "ADDED" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      ignoreDrift(selectedResource.id)
                      setSelectedResource(null)
                    }}
                  >
                    Ignore
                  </Button>
                  <Button
                    onClick={() => {
                      acceptDrift(selectedResource.id)
                      setSelectedResource(null)
                    }}
                  >
                    <Check className="mr-1 h-4 w-4" />
                    Import to Design
                  </Button>
                </>
              )}
              {selectedResource.status === "REMOVED" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      acceptDrift(selectedResource.id)
                      setSelectedResource(null)
                    }}
                  >
                    Remove from Design
                  </Button>
                  <Button
                    onClick={() => {
                      remediateDrift(selectedResource.id)
                      setSelectedResource(null)
                    }}
                  >
                    <Undo2 className="mr-1 h-4 w-4" />
                    Recreate Resource
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

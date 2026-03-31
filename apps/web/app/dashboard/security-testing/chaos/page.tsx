"use client"

import { useState } from "react"
import {
  Flame,
  FlaskConical,
  ShieldCheck,
  Clock,
  TrendingUp,
  Play,
  AlertTriangle,
  Settings,
  ServerCrash,
  Timer,
  Unplug,
  Cpu,
  HardDrive,
  Globe,
  Link2Off,
  CloudOff,
  Power,
  Eye,
  ChevronRight,
  Lightbulb,
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
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  useChaosStore,
  type ExperimentCatalogItem,
  type ExperimentHistory,
  type RiskLevel,
  type ExperimentStatus,
  type ExperimentResult,
} from "@/stores/chaos-store"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import type { LucideIcon } from "lucide-react"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const riskColors: Record<RiskLevel, string> = {
  low: "bg-green-500/10 text-green-700 border-green-200",
  medium: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  high: "bg-orange-500/10 text-orange-700 border-orange-200",
  critical: "bg-red-500/10 text-red-700 border-red-200",
}

const statusColors: Record<ExperimentStatus, string> = {
  pending: "bg-blue-500/10 text-blue-700 border-blue-200",
  running: "bg-amber-500/10 text-amber-700 border-amber-200",
  completed: "bg-green-500/10 text-green-700 border-green-200",
  aborted: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
}

const resultColors: Record<string, string> = {
  success: "bg-green-500/10 text-green-700 border-green-200",
  failed: "bg-red-500/10 text-red-700 border-red-200",
  aborted: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
}

const iconMap: Record<string, LucideIcon> = {
  ServerCrash,
  Timer,
  Unplug,
  Cpu,
  HardDrive,
  Globe,
  Link2Off,
  CloudOff,
}

const targetServices = [
  "web-server-1",
  "web-server-2",
  "api-gateway",
  "auth-service",
  "user-service",
  "order-service",
  "payment-gateway",
  "batch-worker-1",
  "batch-worker-2",
  "gcp-api-1",
  "notification-service",
  "internal-dns",
  "us-east-1a",
  "us-east-1b",
]

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) return "Just now"
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function formatRecovery(seconds: number | null): string {
  if (seconds === null) return "N/A"
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ChaosEngineeringPage() {
  const { data: experiments } = useQuery({ queryKey: ['chaos-experiments'], queryFn: () => apiClient.get('/v1/security/chaos'), enabled: false })
  const store = useChaosStore()
  const [configureItem, setConfigureItem] = useState<ExperimentCatalogItem | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [reportExperiment, setReportExperiment] = useState<ExperimentHistory | null>(null)

  // Form state for create experiment
  const [formTarget, setFormTarget] = useState("")
  const [formDuration, setFormDuration] = useState(60)
  const [formRollback, setFormRollback] = useState<"auto" | "manual">("auto")
  const [formParams, setFormParams] = useState<Record<string, string | number>>({})

  // Computed stats
  const totalExperiments = store.history.length
  const runningNow = store.history.filter((e) => e.status === "running").length
  const completedExperiments = store.history.filter((e) => e.status === "completed")
  const successRate = completedExperiments.length > 0
    ? Math.round(
        (completedExperiments.filter((e) => e.result === "success").length /
          completedExperiments.length) *
          100,
      )
    : 0
  const withRecovery = store.history.filter((e) => e.recoveryTimeSeconds !== null)
  const avgRecoveryTime = withRecovery.length > 0
    ? Math.round(
        withRecovery.reduce((s, e) => s + (e.recoveryTimeSeconds ?? 0), 0) /
          withRecovery.length,
      )
    : 0

  const handleConfigure = (item: ExperimentCatalogItem) => {
    setConfigureItem(item)
    setFormTarget("")
    setFormDuration(60)
    setFormRollback("auto")
    const defaults: Record<string, string | number> = {}
    item.parameters.forEach((p) => {
      if (p.default !== undefined) defaults[p.key] = p.default
    })
    setFormParams(defaults)
  }

  const handleRunExperiment = () => {
    if (!configureItem) return
    store.createExperiment({
      name: `${configureItem.name} on ${formTarget}`,
      type: configureItem.type,
      target: formTarget,
      durationSeconds: formDuration,
      rollbackPlan: formRollback,
      parameters: formParams,
      recoveryTimeSeconds: null,
    })
    setShowConfirm(false)
    setConfigureItem(null)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Chaos Engineering</h1>
        <p className="text-muted-foreground">
          Test system resilience through controlled failure experiments
        </p>
      </div>

      {/* Safety Banner */}
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-4">
        <ShieldCheck className="h-5 w-5 text-green-600 shrink-0" />
        <p className="text-sm text-green-700 dark:text-green-400">
          All experiments run in controlled conditions with auto-rollback. Safety
          controls are enforced before each experiment execution.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Experiments</CardTitle>
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalExperiments}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Running Now</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runningNow}</div>
            <p className="text-xs text-muted-foreground">
              Max {store.safetySettings.maxConcurrentExperiments} concurrent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {completedExperiments.filter((e) => e.result === "success").length} of{" "}
              {completedExperiments.length} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Recovery Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRecovery(avgRecoveryTime)}</div>
            <p className="text-xs text-muted-foreground">Across all experiments</p>
          </CardContent>
        </Card>
      </div>

      {/* Experiment Catalog */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Experiment Catalog</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {store.catalog.map((item) => {
            const IconComponent = iconMap[item.icon] || FlaskConical
            return (
              <Card
                key={item.type}
                className="flex flex-col justify-between hover:border-primary/50 transition-colors"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="rounded-lg bg-muted p-2">
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className={riskColors[item.risk]}>
                      {item.risk}
                    </Badge>
                  </div>
                  <CardTitle className="text-base mt-2">{item.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {item.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleConfigure(item)}
                  >
                    <Settings className="mr-1.5 h-3.5 w-3.5" />
                    Configure
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Experiment History */}
      <Card>
        <CardHeader>
          <CardTitle>Experiment History</CardTitle>
          <CardDescription>
            {store.history.length} experiments recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Experiment</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="text-right">Recovery</TableHead>
                <TableHead className="text-right">When</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store.history.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {exp.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {store.catalog.find((c) => c.type === exp.type)?.name ?? exp.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{exp.target}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[exp.status]}>
                      {exp.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {exp.result ? (
                      <Badge
                        variant="outline"
                        className={resultColors[exp.result] ?? ""}
                      >
                        {exp.result}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatRecovery(exp.recoveryTimeSeconds)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatTimeAgo(exp.startedAt)}
                  </TableCell>
                  <TableCell>
                    {exp.report && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReportExperiment(exp)}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        Report
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Safety Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Safety Controls
          </CardTitle>
          <CardDescription>
            Global safety settings for chaos experiments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <Power className="h-4 w-4 text-red-500" />
                    Global Kill Switch
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Emergency stop all running experiments
                  </p>
                </div>
                <Switch
                  checked={store.safetySettings.globalKillSwitch}
                  onCheckedChange={(checked) =>
                    store.updateSafetySettings({ globalKillSwitch: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <div className="font-medium">Max Concurrent Experiments</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Limit parallel experiment execution
                  </p>
                </div>
                <span className="text-lg font-bold">
                  {store.safetySettings.maxConcurrentExperiments}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <div className="font-medium">Required Authorization</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Experiments require explicit approval
                  </p>
                </div>
                <Switch
                  checked={store.safetySettings.requiredAuthorization}
                  onCheckedChange={(checked) =>
                    store.updateSafetySettings({ requiredAuthorization: checked })
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <div className="font-medium">Auto-Rollback Timeout</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Automatically roll back after timeout
                  </p>
                </div>
                <span className="text-lg font-bold">
                  {store.safetySettings.autoRollbackTimeoutSeconds}s
                </span>
              </div>

              <div className="rounded-lg border p-4">
                <div className="font-medium mb-2">Excluded Resources</div>
                <p className="text-xs text-muted-foreground mb-3">
                  These resources cannot be targeted by experiments
                </p>
                <div className="flex flex-wrap gap-2">
                  {store.safetySettings.excludedResources.map((resource) => (
                    <Badge key={resource} variant="secondary">
                      {resource}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Experiment Dialog */}
      <Dialog
        open={configureItem !== null && !showConfirm}
        onOpenChange={(open) => {
          if (!open) setConfigureItem(null)
        }}
      >
        {configureItem && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Configure: {configureItem.name}</DialogTitle>
              <DialogDescription>{configureItem.description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Risk Level:</span>
                <Badge variant="outline" className={riskColors[configureItem.risk]}>
                  {configureItem.risk}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>Target Resource</Label>
                <Select value={formTarget} onValueChange={setFormTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target service" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetServices.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {configureItem.parameters.map((param) => (
                <div key={param.key} className="space-y-2">
                  <Label>{param.label}</Label>
                  {param.type === "number" ? (
                    <Input
                      type="number"
                      min={param.min}
                      max={param.max}
                      value={formParams[param.key] ?? param.default ?? ""}
                      onChange={(e) =>
                        setFormParams((prev) => ({
                          ...prev,
                          [param.key]: Number(e.target.value),
                        }))
                      }
                    />
                  ) : param.type === "select" ? (
                    <Select
                      value={String(formParams[param.key] ?? param.default ?? "")}
                      onValueChange={(v) =>
                        setFormParams((prev) => ({ ...prev, [param.key]: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {param.options?.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={String(formParams[param.key] ?? "")}
                      onChange={(e) =>
                        setFormParams((prev) => ({
                          ...prev,
                          [param.key]: e.target.value,
                        }))
                      }
                    />
                  )}
                  {param.min !== undefined && param.max !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      Range: {param.min} - {param.max}
                    </p>
                  )}
                </div>
              ))}

              <div className="space-y-2">
                <Label>Duration (seconds)</Label>
                <Input
                  type="number"
                  min={10}
                  max={600}
                  value={formDuration}
                  onChange={(e) => setFormDuration(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label>Rollback Plan</Label>
                <Select
                  value={formRollback}
                  onValueChange={(v) => setFormRollback(v as "auto" | "manual")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automatic Rollback</SelectItem>
                    <SelectItem value="manual">Manual Rollback</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setConfigureItem(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => setShowConfirm(true)}
                disabled={!formTarget}
              >
                <Play className="mr-1.5 h-4 w-4" />
                Run Experiment
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Experiment
            </DialogTitle>
            <DialogDescription>
              You are about to run a chaos experiment. Please confirm the details
              below.
            </DialogDescription>
          </DialogHeader>

          {configureItem && (
            <div className="space-y-3 rounded-lg border p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{configureItem.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target</span>
                <span className="font-medium">{formTarget}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{formDuration}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rollback</span>
                <span className="font-medium capitalize">{formRollback}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Risk</span>
                <Badge variant="outline" className={riskColors[configureItem.risk]}>
                  {configureItem.risk}
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRunExperiment}>
              <Flame className="mr-1.5 h-4 w-4" />
              Confirm &amp; Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Experiment Report Dialog */}
      <Dialog
        open={reportExperiment !== null}
        onOpenChange={(open) => {
          if (!open) setReportExperiment(null)
        }}
      >
        {reportExperiment?.report && (
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle>{reportExperiment.name}</DialogTitle>
                {reportExperiment.result && (
                  <Badge
                    variant="outline"
                    className={resultColors[reportExperiment.result] ?? ""}
                  >
                    {reportExperiment.result}
                  </Badge>
                )}
              </div>
              <DialogDescription>
                Duration: {reportExperiment.durationSeconds}s | Recovery:{" "}
                {formatRecovery(reportExperiment.recoveryTimeSeconds)} | Rollback:{" "}
                {reportExperiment.rollbackPlan}
              </DialogDescription>
            </DialogHeader>

            {/* Timeline */}
            <div>
              <h3 className="mb-3 text-sm font-semibold">Timeline</h3>
              <div className="space-y-2">
                {reportExperiment.report.timeline.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <Badge variant="secondary" className="shrink-0 font-mono text-xs">
                      {entry.time}
                    </Badge>
                    <span>{entry.event}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Metrics */}
            <div>
              <h3 className="mb-3 text-sm font-semibold">Metrics Comparison</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Before
                  </div>
                  {reportExperiment.report.metricsBefore.map((m, i) => (
                    <div key={i} className="flex justify-between text-sm py-1">
                      <span className="text-muted-foreground">{m.metric}</span>
                      <span className="font-medium">{m.value}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                  <div className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">
                    During
                  </div>
                  {reportExperiment.report.metricsDuring.map((m, i) => (
                    <div key={i} className="flex justify-between text-sm py-1">
                      <span className="text-muted-foreground">{m.metric}</span>
                      <span className="font-medium">{m.value}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/20 p-3">
                  <div className="text-xs font-medium text-green-700 dark:text-green-400 mb-2">
                    After
                  </div>
                  {reportExperiment.report.metricsAfter.map((m, i) => (
                    <div key={i} className="flex justify-between text-sm py-1">
                      <span className="text-muted-foreground">{m.metric}</span>
                      <span className="font-medium">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Affected Services */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Affected Services</h3>
              <div className="flex flex-wrap gap-2">
                {reportExperiment.report.affectedServices.map((service) => (
                  <Badge key={service} variant="secondary">
                    {service}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Recovery Sequence */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Recovery Sequence</h3>
              <ol className="space-y-1.5">
                {reportExperiment.report.recoverySequence.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* Lessons Learned */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Lessons Learned</h3>
              <div className="rounded-md border bg-muted/30 p-3">
                <ul className="space-y-1.5">
                  {reportExperiment.report.lessonsLearned.map((lesson, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      {lesson}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setReportExperiment(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

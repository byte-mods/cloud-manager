"use client"

import { useEffect, useState } from "react"
import type { Node, Edge } from "@xyflow/react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Shield,
  Activity,
  Zap,
  DollarSign,
  Settings,
  Download,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
} from "lucide-react"
import {
  useArchitectureReview,
  type ReviewFinding,
  type PillarScore,
  type ReviewSeverity,
} from "@/hooks/use-architecture-review"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PILLAR_ICONS: Record<string, React.ElementType> = {
  Security: Shield,
  Reliability: Activity,
  "Performance Efficiency": Zap,
  "Cost Optimization": DollarSign,
  "Operational Excellence": Settings,
}

const PILLAR_COLORS: Record<string, string> = {
  Security: "text-red-400",
  Reliability: "text-blue-400",
  "Performance Efficiency": "text-yellow-400",
  "Cost Optimization": "text-green-400",
  "Operational Excellence": "text-purple-400",
}

const PILLAR_BAR_COLORS: Record<string, string> = {
  Security: "bg-red-500",
  Reliability: "bg-blue-500",
  "Performance Efficiency": "bg-yellow-500",
  "Cost Optimization": "bg-green-500",
  "Operational Excellence": "bg-purple-500",
}

const SEVERITY_CONFIG: Record<
  ReviewSeverity,
  { label: string; className: string; icon: React.ElementType }
> = {
  critical: {
    label: "Critical",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: XCircle,
  },
  high: {
    label: "High",
    className: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    icon: AlertTriangle,
  },
  medium: {
    label: "Medium",
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    icon: Info,
  },
  low: {
    label: "Low",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    icon: Info,
  },
}

function scoreColor(score: number): string {
  if (score >= 90) return "text-green-400"
  if (score >= 70) return "text-yellow-400"
  if (score >= 50) return "text-orange-400"
  return "text-red-400"
}

function gradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "from-green-500 to-emerald-600"
    case "B":
      return "from-blue-500 to-cyan-600"
    case "C":
      return "from-yellow-500 to-amber-600"
    case "D":
      return "from-orange-500 to-red-500"
    default:
      return "from-red-600 to-rose-700"
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PillarSection({
  pillar,
  onApplySuggestion,
}: {
  pillar: PillarScore
  onApplySuggestion: (finding: ReviewFinding) => void
}) {
  const [expanded, setExpanded] = useState(pillar.findings.length > 0)
  const Icon = PILLAR_ICONS[pillar.pillar] ?? Settings
  const color = PILLAR_COLORS[pillar.pillar] ?? "text-muted-foreground"
  const barColor = PILLAR_BAR_COLORS[pillar.pillar] ?? "bg-primary"

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <Icon className={`h-4 w-4 shrink-0 ${color}`} />
        <span className="text-sm font-medium flex-1">{pillar.pillar}</span>
        <span className={`text-sm font-bold tabular-nums ${scoreColor(pillar.score)}`}>
          {pillar.score}
        </span>
      </button>

      {/* Score bar */}
      <div className="px-3 pb-2">
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${pillar.score}%` }}
          />
        </div>
      </div>

      {/* Findings */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {pillar.findings.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-green-400 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>No issues found. Great job!</span>
            </div>
          ) : (
            pillar.findings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                onApply={() => onApplySuggestion(finding)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function FindingCard({
  finding,
  onApply,
}: {
  finding: ReviewFinding
  onApply: () => void
}) {
  const [showDetails, setShowDetails] = useState(false)
  const sev = SEVERITY_CONFIG[finding.severity]
  const SevIcon = sev.icon

  return (
    <div className="rounded-md border border-border/40 bg-card/50 p-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <SevIcon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium">{finding.title}</span>
            <Badge className={`text-[9px] px-1.5 py-0 h-4 ${sev.className}`}>
              {sev.label}
            </Badge>
          </div>
          {showDetails && (
            <div className="mt-1.5 space-y-1.5">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {finding.description}
              </p>
              <div className="rounded bg-accent/50 p-2">
                <p className="text-[11px] text-foreground leading-relaxed">
                  <span className="font-medium text-primary">Recommendation:</span>{" "}
                  {finding.recommendation}
                </p>
              </div>
              {finding.affectedNodes.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Affected nodes: {finding.affectedNodes.join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 pl-5">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {showDetails ? "Hide details" : "Show details"}
        </button>
        <Button
          variant="outline"
          size="sm"
          className="h-5 text-[10px] px-2 gap-1"
          onClick={onApply}
        >
          <Sparkles className="h-2.5 w-2.5" />
          Apply Suggestion
        </Button>
      </div>
    </div>
  )
}

function AnalyzingState() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
      <div className="relative">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center">
          <Brain className="h-8 w-8 text-violet-400 animate-pulse" />
        </div>
        <Loader2 className="h-5 w-5 text-violet-400 absolute -top-1 -right-1 animate-spin" />
      </div>
      <div className="text-center space-y-2">
        <p className="text-sm font-medium">Analyzing your architecture...</p>
        <p className="text-xs text-muted-foreground max-w-[240px]">
          Evaluating against the AWS Well-Architected Framework across all five pillars.
        </p>
      </div>
      <div className="w-48">
        <Progress value={66} className="h-1" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

type AIReviewPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodes: Node[]
  edges: Edge[]
}

export default function AIReviewPanel({
  open,
  onOpenChange,
  nodes,
  edges,
}: AIReviewPanelProps) {
  const { review, isAnalyzing, runReview } = useArchitectureReview()

  // Trigger analysis when opened
  useEffect(() => {
    if (open && !review && !isAnalyzing) {
      runReview(nodes, edges)
    }
  }, [open, review, isAnalyzing, nodes, edges, runReview])

  const handleRerun = () => {
    runReview(nodes, edges)
  }

  const handleApplySuggestion = (finding: ReviewFinding) => {
    // In a full implementation this would add missing nodes/edges to the canvas.
    // For now we show a console message. The infra store's addNode could be called here.
    console.log("[AI Review] Apply suggestion:", finding.title, finding.recommendation)
  }

  const handleExport = () => {
    if (!review) return
    const report = {
      title: "AWS Well-Architected Review Report",
      generatedAt: review.timestamp,
      overallScore: review.overallScore,
      grade: review.grade,
      pillars: review.pillars.map((p) => ({
        pillar: p.pillar,
        score: p.score,
        findings: p.findings.map((f) => ({
          severity: f.severity,
          title: f.title,
          description: f.description,
          recommendation: f.recommendation,
          affectedNodes: f.affectedNodes,
        })),
      })),
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `well-architected-review-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalFindings = review
    ? review.pillars.reduce((sum, p) => sum + p.findings.length, 0)
    : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] p-0 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center">
              <Brain className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <SheetTitle className="text-base">AI Architecture Review</SheetTitle>
              <SheetDescription className="text-xs">
                AWS Well-Architected Framework Analysis
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isAnalyzing ? (
            <AnalyzingState />
          ) : review ? (
            <div className="p-5 space-y-5">
              {/* Overall score */}
              <div className="flex items-center gap-4">
                <div
                  className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${gradeColor(review.grade)} flex items-center justify-center shrink-0`}
                >
                  <span className="text-2xl font-bold text-white">
                    {review.grade}
                  </span>
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums">
                      {review.overallScore}
                    </span>
                    <span className="text-xs text-muted-foreground">/ 100</span>
                  </div>
                  <Progress value={review.overallScore} className="h-2" />
                  <p className="text-[11px] text-muted-foreground">
                    {totalFindings} finding{totalFindings !== 1 ? "s" : ""} across{" "}
                    {review.pillars.filter((p) => p.findings.length > 0).length} pillars
                  </p>
                </div>
              </div>

              {/* Pillar scores overview */}
              <div className="grid grid-cols-5 gap-2">
                {review.pillars.map((p) => {
                  const Icon = PILLAR_ICONS[p.pillar] ?? Settings
                  const color = PILLAR_COLORS[p.pillar] ?? "text-muted-foreground"
                  return (
                    <div
                      key={p.pillar}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg bg-accent/30"
                    >
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                      <span
                        className={`text-xs font-bold tabular-nums ${scoreColor(p.score)}`}
                      >
                        {p.score}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Pillar details */}
              <div className="space-y-2">
                {review.pillars.map((p) => (
                  <PillarSection
                    key={p.pillar}
                    pillar={p}
                    onApplySuggestion={handleApplySuggestion}
                  />
                ))}
              </div>

              {/* Timestamp */}
              <p className="text-[10px] text-muted-foreground text-center">
                Analyzed at{" "}
                {new Date(review.timestamp).toLocaleString()}
              </p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {review && !isAnalyzing && (
          <div className="border-t p-3 flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 flex-1"
              onClick={handleRerun}
            >
              <Brain className="h-3.5 w-3.5" />
              Re-analyze
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 flex-1"
              onClick={handleExport}
            >
              <Download className="h-3.5 w-3.5" />
              Export Report
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import {
  ArrowLeft,
  Download,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Bug,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useVAPTScan } from "@/hooks/use-security-testing"

type Finding = {
  id: string
  title: string
  severity: "critical" | "high" | "medium" | "low"
  cvssScore: number
  category: string
  status: "open" | "in-progress" | "resolved" | "accepted"
  description: string
  evidence: string
  remediation: string
  affectedUrl: string
  cweId: string
}


const severityColors: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
}

const severityBadgeVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "destructive",
  "in-progress": "secondary",
  resolved: "default",
  accepted: "outline",
}

function FindingDetail({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border rounded-lg">
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <div className={`w-2 h-2 rounded-full shrink-0 ${severityColors[finding.severity]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{finding.title}</span>
            <Badge variant={severityBadgeVariants[finding.severity]} className="text-xs">
              {finding.severity}
            </Badge>
            <Badge variant="outline" className="text-xs font-mono">{finding.cweId}</Badge>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground">{finding.category}</span>
            <span className="text-xs font-medium">CVSS: {finding.cvssScore}</span>
            <Badge variant={statusVariants[finding.status]} className="text-xs">{finding.status}</Badge>
          </div>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t pt-4 space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-1">Description</h4>
            <p className="text-sm text-muted-foreground">{finding.description}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-1">Evidence</h4>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">{finding.evidence}</pre>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-1">Affected URL</h4>
            <code className="text-xs bg-muted px-2 py-1 rounded">{finding.affectedUrl}</code>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-1">Remediation</h4>
            <p className="text-sm text-muted-foreground">{finding.remediation}</p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline">
              <Sparkles className="mr-2 h-4 w-4" />
              AI Remediation
            </Button>
            <Button size="sm" variant="outline">
              <ExternalLink className="mr-2 h-4 w-4" />
              View {finding.cweId}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  )
}

export default function VAPTScanResultPage() {
  const params = useParams()
  const scanId = params.id as string
  const { data, isLoading, error } = useVAPTScan(scanId)
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const scanResult = data ? {
    id: data.id,
    name: data.name,
    target: data.target,
    type: data.type,
    status: data.status,
    startedAt: data.startedAt,
    completedAt: data.completedAt ?? "",
    duration: "-",
    summary: {
      critical: data.criticalCount,
      high: data.highCount,
      medium: Math.max(0, data.findingsCount - data.criticalCount - data.highCount),
      low: 0,
      total: data.findingsCount,
    },
  } : { id: scanId, name: "", target: "", type: "", status: "", startedAt: "", completedAt: "", duration: "-", summary: { critical: 0, high: 0, medium: 0, low: 0, total: 0 } }

  const findings: Finding[] = (data?.findings ?? []).map((f) => ({
    id: f.id,
    title: f.title,
    severity: f.severity as Finding["severity"],
    cvssScore: 0,
    category: f.affectedAsset,
    status: f.status as Finding["status"],
    description: f.description,
    evidence: "",
    remediation: f.remediation,
    affectedUrl: f.affectedAsset,
    cweId: f.cveId ?? "",
  }))

  const filteredFindings = findings.filter((f) => {
    if (severityFilter !== "all" && f.severity !== severityFilter) return false
    if (statusFilter !== "all" && f.status !== statusFilter) return false
    return true
  })

  const handleExportReport = () => {
    const report = {
      scan: scanResult,
      findings,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `vapt-report-${params.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="border-red-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-red-500">Failed to load scan results. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/security-testing/vapt">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Scans
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{scanResult.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-muted-foreground font-mono text-sm">{scanResult.target}</span>
              <Badge variant="outline">{scanResult.type}</Badge>
              <Badge variant="default">
                <CheckCircle2 className="mr-1 h-3 w-3" /> {scanResult.status}
              </Badge>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={handleExportReport}>
          <Download className="mr-2 h-4 w-4" /> Export Report
        </Button>
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Started: {scanResult.startedAt}</span>
        <span>|</span>
        <span>Completed: {scanResult.completedAt}</span>
        <span>|</span>
        <span>Duration: {scanResult.duration}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-red-500/30">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-red-500">{scanResult.summary.critical}</div>
            <p className="text-sm font-medium text-red-500">Critical</p>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-orange-500">{scanResult.summary.high}</div>
            <p className="text-sm font-medium text-orange-500">High</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-yellow-500">{scanResult.summary.medium}</div>
            <p className="text-sm font-medium text-yellow-500">Medium</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-blue-500">{scanResult.summary.low}</div>
            <p className="text-sm font-medium text-blue-500">Low</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{scanResult.summary.total}</div>
            <p className="text-sm font-medium text-muted-foreground">Total</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Findings ({filteredFindings.length})</CardTitle>
              <CardDescription>Detailed vulnerability findings from this scan</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredFindings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No findings match filters</h3>
              <p className="text-muted-foreground text-sm mt-1">Try adjusting your filter criteria.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFindings.map((finding) => (
                <FindingDetail key={finding.id} finding={finding} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

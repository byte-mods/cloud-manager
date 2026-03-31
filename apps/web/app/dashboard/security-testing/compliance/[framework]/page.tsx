"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  FileText,
  ExternalLink,
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
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useComplianceAssessment } from "@/hooks/use-security-testing"

type Control = {
  id: string
  controlId: string
  name: string
  description: string
  status: "pass" | "fail" | "partial" | "not-assessed"
  evidence: string
  lastChecked: string
  category: string
  remediation: string
}

const frameworkMeta: Record<string, { name: string; description: string }> = {
  soc2: { name: "SOC 2", description: "Service Organization Control 2 - Trust Service Criteria" },
  iso27001: { name: "ISO 27001", description: "International Information Security Management Standard" },
  hipaa: { name: "HIPAA", description: "Health Insurance Portability and Accountability Act" },
  "pci-dss": { name: "PCI-DSS 4.0", description: "Payment Card Industry Data Security Standard" },
  gdpr: { name: "GDPR", description: "General Data Protection Regulation" },
  "nist-csf": { name: "NIST CSF", description: "NIST Cybersecurity Framework" },
  cis: { name: "CIS Benchmarks", description: "Center for Internet Security Benchmarks" },
}

const statusIcons: Record<string, React.ReactNode> = {
  pass: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  fail: <XCircle className="h-4 w-4 text-red-500" />,
  partial: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  "not-assessed": <Clock className="h-4 w-4 text-gray-400" />,
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pass: "default",
  fail: "destructive",
  partial: "secondary",
  "not-assessed": "outline",
}

const statusLabels: Record<string, string> = {
  pass: "Pass",
  fail: "Fail",
  partial: "Partial",
  "not-assessed": "Not Assessed",
}

function ControlRow({ control }: { control: Control }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border rounded-lg">
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        {statusIcons[control.status]}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">{control.controlId}</Badge>
            <span className="font-medium text-sm">{control.name}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <Badge variant={statusVariants[control.status]} className="text-xs">
              {statusLabels[control.status]}
            </Badge>
            <span className="text-xs text-muted-foreground">{control.category}</span>
            <span className="text-xs text-muted-foreground">Last checked: {control.lastChecked}</span>
          </div>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t pt-4 space-y-3 ml-7">
          <div>
            <h4 className="text-sm font-semibold mb-1">Description</h4>
            <p className="text-sm text-muted-foreground">{control.description}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-1">Evidence</h4>
            <p className="text-sm text-muted-foreground">{control.evidence}</p>
          </div>
          {control.remediation && (
            <div>
              <h4 className="text-sm font-semibold mb-1 text-red-500">Remediation Required</h4>
              <p className="text-sm text-muted-foreground">{control.remediation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-24 w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  )
}

export default function FrameworkDetailPage() {
  const params = useParams()
  const framework = params.framework as string
  const { data, isLoading, error } = useComplianceAssessment(framework)
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const meta = frameworkMeta[framework] || { name: framework, description: "" }

  const controls: Control[] = (data?.controls ?? []).map((c) => ({
    id: c.id,
    controlId: c.id,
    name: c.name,
    description: c.description,
    status: c.status === "passed" ? "pass" : c.status === "failed" ? "fail" : "not-assessed",
    evidence: c.evidence ?? "",
    lastChecked: c.lastChecked,
    category: c.severity,
    remediation: "",
  }))

  const filteredControls = useMemo(() =>
    controls.filter((c) => statusFilter === "all" || c.status === statusFilter),
    [controls, statusFilter]
  )

  const stats = {
    pass: controls.filter((c) => c.status === "pass").length,
    fail: controls.filter((c) => c.status === "fail").length,
    partial: controls.filter((c) => c.status === "partial").length,
    notAssessed: controls.filter((c) => c.status === "not-assessed").length,
    total: controls.length,
  }

  const compliancePercent = stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0

  const handleGenerateReport = () => {
    const report = {
      framework: meta.name,
      generatedAt: new Date().toISOString(),
      compliancePercent,
      stats,
      controls,
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `compliance-report-${framework}.json`
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
            <p className="text-sm text-red-500">Failed to load compliance assessment. Please try again later.</p>
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
            <Link href="/dashboard/security-testing/compliance">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Frameworks
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{meta.name}</h1>
            <p className="text-muted-foreground mt-1">{meta.description}</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleGenerateReport}>
          <Download className="mr-2 h-4 w-4" /> Generate Report
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className={`text-3xl font-bold ${compliancePercent >= 90 ? "text-green-500" : compliancePercent >= 70 ? "text-yellow-500" : "text-red-500"}`}>
              {compliancePercent}%
            </div>
            <p className="text-xs text-muted-foreground">Compliance</p>
            <Progress value={compliancePercent} className="h-2 mt-2" />
          </CardContent>
        </Card>
        <Card className="border-green-500/30">
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-green-500">{stats.pass}</div>
            <p className="text-xs text-muted-foreground">Passed</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-red-500">{stats.fail}</div>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30">
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-yellow-500">{stats.partial}</div>
            <p className="text-xs text-muted-foreground">Partial</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-gray-400">{stats.notAssessed}</div>
            <p className="text-xs text-muted-foreground">Not Assessed</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Controls ({filteredControls.length})</CardTitle>
              <CardDescription>Compliance controls and their assessment status</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pass">Pass</SelectItem>
                  <SelectItem value="fail">Fail</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="not-assessed">Not Assessed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredControls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No controls match filter</h3>
              <p className="text-muted-foreground text-sm mt-1">Try adjusting your filter criteria.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredControls.map((control) => (
                <ControlRow key={control.id} control={control} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

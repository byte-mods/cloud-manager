"use client"

import { useState, useMemo } from "react"
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code,
  Copy,
  Check,
  ChevronRight,
  ShieldAlert,
  TrendingDown,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useRemediationItems } from "@/hooks/use-security-testing"

type Finding = {
  id: string
  title: string
  severity: "critical" | "high" | "medium" | "low"
  provider: string
  resource: string
  status: "open" | "remediated" | "in_progress"
  remediation?: string
}

const severityColors: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
}


export default function RemediationPage() {
  const { data, isLoading, error } = useRemediationItems()
  const [selectedFinding, setSelectedFinding] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const findings: Finding[] = useMemo(() =>
    (data?.items ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      severity: item.severity as Finding["severity"],
      provider: item.source,
      resource: item.description,
      status: item.status === "resolved" ? "remediated" : item.status === "in-progress" ? "in_progress" : "open",
    })),
    [data]
  )

  if (isLoading) return <div className="space-y-4">{Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Remediation</h1>
          <p className="text-muted-foreground mt-1">AI-powered remediation code for security findings.</p>
        </div>
        <Card className="border-red-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-red-500">Failed to load remediation items. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const selected = findings.find(f => f.id === selectedFinding)

  const stats = {
    total: findings.length,
    open: findings.filter(f => f.status === "open").length,
    remediated: findings.filter(f => f.status === "remediated").length,
    inProgress: findings.filter(f => f.status === "in_progress").length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security Remediation</h1>
        <p className="text-muted-foreground mt-1">AI-powered remediation code for security findings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total Findings</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Open</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold text-red-500">{stats.open}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>In Progress</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-500">{stats.inProgress}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Remediated</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold text-green-500">{stats.remediated}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Findings</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {findings.map(finding => (
              <button
                key={finding.id}
                onClick={() => setSelectedFinding(finding.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/50 ${selectedFinding === finding.id ? "border-primary bg-muted/50" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={severityColors[finding.severity]}>{finding.severity}</Badge>
                    <span className="text-sm font-medium">{finding.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{finding.provider.toUpperCase()}</Badge>
                    {finding.status === "remediated" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {finding.status === "in_progress" && <Clock className="h-4 w-4 text-yellow-500" />}
                    {finding.status === "open" && <ShieldAlert className="h-4 w-4 text-red-500" />}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-mono truncate">{finding.resource}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Code className="h-4 w-4" />Remediation Code</CardTitle>
            <CardDescription>
              {selected ? `Fix for: ${selected.title}` : "Select a finding to view remediation code"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selected?.remediation ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Auto-generated</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText(selected.remediation!)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                  >
                    {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <pre className="rounded-lg border bg-muted/50 p-4 text-xs font-mono overflow-auto max-h-[400px] leading-relaxed">
                  {selected.remediation}
                </pre>
                <div className="flex gap-2">
                  <Button size="sm"><Wrench className="mr-2 h-4 w-4" />Apply Fix</Button>
                  <Button size="sm" variant="outline">Generate PR</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Wrench className="h-8 w-8 mb-2" />
                <p className="text-sm">Select a finding to generate remediation code</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

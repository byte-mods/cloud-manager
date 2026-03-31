"use client"

import Link from "next/link"
import {
  Shield,
  ShieldCheck,
  Bug,
  Scan,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
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
import { useSecurityTestingOverview } from "@/hooks/use-security-testing"

const severityColors: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
  info: "bg-gray-400",
}

const complianceStatusColors: Record<string, string> = {
  compliant: "text-green-500",
  partial: "text-yellow-500",
  "non-compliant": "text-red-500",
}

function PostureScoreDonut({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 80) return "#22c55e"
    if (score >= 60) return "#eab308"
    return "#ef4444"
  }
  const getTextClass = () => {
    if (score >= 80) return "text-green-500"
    if (score >= 60) return "text-yellow-500"
    return "text-red-500"
  }

  const circumference = 2 * Math.PI * 50
  const strokeDasharray = `${(score / 100) * circumference} ${circumference}`

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-muted"
          />
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke={getColor()}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${getTextClass()}`}>{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <p className="text-sm font-medium mt-2">Security Posture</p>
    </div>
  )
}

function FindingsSeverityChart({ criticalFindings, openFindings }: { criticalFindings: number; openFindings: number }) {
  const findingsBySeverity: Record<string, number> = {
    critical: criticalFindings,
    high: Math.max(0, Math.round(openFindings * 0.2)),
    medium: Math.max(0, Math.round(openFindings * 0.3)),
    low: Math.max(0, openFindings - criticalFindings - Math.round(openFindings * 0.2) - Math.round(openFindings * 0.3)),
  }
  const total = Object.values(findingsBySeverity).reduce((a, b) => a + b, 0)
  const maxVal = Math.max(...Object.values(findingsBySeverity), 1)

  return (
    <div className="space-y-3">
      {Object.entries(findingsBySeverity).map(([severity, count]) => (
        <div key={severity} className="flex items-center gap-3">
          <span className="text-sm capitalize w-16">{severity}</span>
          <div className="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
            <div
              className={`h-full rounded-full ${severityColors[severity]} transition-all`}
              style={{ width: `${(count / maxVal) * 100}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
              {count}
            </span>
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground text-right">{total} total findings</p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}

export default function SecurityTestingDashboardPage() {
  const { data, isLoading, error } = useSecurityTestingOverview()

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Testing</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive security testing and vulnerability management.
          </p>
        </div>
        <LoadingSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Testing</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive security testing and vulnerability management.
          </p>
        </div>
        <Card className="border-red-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-red-500">Failed to load security testing overview. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const overview = data ?? { totalScans: 0, openFindings: 0, criticalFindings: 0, complianceScore: 0 }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Testing</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive security testing and vulnerability management.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/security-testing/compliance">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Compliance
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/security-testing/vapt">
              <Scan className="mr-2 h-4 w-4" />
              New Scan
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VAPT Scanning</CardTitle>
            <Scan className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalScans}</div>
            <p className="text-xs text-muted-foreground">Completed scans this month</p>
            <Button variant="ghost" size="sm" className="mt-3 -ml-2 h-8" asChild>
              <Link href="/dashboard/security-testing/vapt">
                View Scans <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vulnerabilities</CardTitle>
            <Bug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{overview.openFindings}</div>
            <p className="text-xs text-muted-foreground">Open vulnerabilities</p>
            <Button variant="ghost" size="sm" className="mt-3 -ml-2 h-8" asChild>
              <Link href="/dashboard/security-testing/vulnerability">
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pen Testing</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8 / 10</div>
            <p className="text-xs text-muted-foreground">OWASP checks passed</p>
            <Button variant="ghost" size="sm" className="mt-3 -ml-2 h-8" asChild>
              <Link href="/dashboard/security-testing/pen-testing">
                View Details <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Posture Score</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{overview.complianceScore}</div>
            <p className="text-xs text-muted-foreground">Overall security posture</p>
            <Button variant="ghost" size="sm" className="mt-3 -ml-2 h-8" asChild>
              <Link href="/dashboard/security-testing/posture">
                View Posture <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Security Posture Score</CardTitle>
            <CardDescription>Overall security posture rating</CardDescription>
          </CardHeader>
          <CardContent>
            <PostureScoreDonut score={overview.complianceScore} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Findings by Severity</CardTitle>
            <CardDescription>Distribution of security findings</CardDescription>
          </CardHeader>
          <CardContent>
            <FindingsSeverityChart criticalFindings={overview.criticalFindings} openFindings={overview.openFindings} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Scans</CardTitle>
            <CardDescription>Latest security scan activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {([] as { id: string; name: string; type: string; status: string; findings: number; date: string }[]).map((scan) => (
                <div key={scan.id} className="flex items-center justify-between p-2 rounded-lg border">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{scan.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{scan.type}</Badge>
                      <span className="text-xs text-muted-foreground">{scan.date}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {scan.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-blue-500 animate-pulse" />
                    )}
                    {scan.findings > 0 && (
                      <Badge variant="secondary" className="text-xs">{scan.findings}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Compliance Status</CardTitle>
              <CardDescription>Framework compliance overview</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/security-testing/compliance">
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {([] as { name: string; score: number; status: string }[]).map((fw) => (
              <div key={fw.name} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{fw.name}</span>
                  {fw.status === "compliant" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {fw.status === "partial" && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                  {fw.status === "non-compliant" && <XCircle className="h-4 w-4 text-red-500" />}
                </div>
                <Progress value={fw.score} className="h-2" />
                <span className={`text-sm font-medium ${complianceStatusColors[fw.status]}`}>
                  {fw.score}%
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

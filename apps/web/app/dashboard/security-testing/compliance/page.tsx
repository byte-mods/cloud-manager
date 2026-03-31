"use client"

import Link from "next/link"
import {
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
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
import { useComplianceFrameworks } from "@/hooks/use-security-testing"

const statusColors: Record<string, string> = {
  compliant: "text-green-500 border-green-500/30",
  partial: "text-yellow-500 border-yellow-500/30",
  "non-compliant": "text-red-500 border-red-500/30",
}

const statusIcons: Record<string, React.ReactNode> = {
  compliant: <CheckCircle2 className="h-5 w-5 text-green-500" />,
  partial: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  "non-compliant": <XCircle className="h-5 w-5 text-red-500" />,
}

const statusLabels: Record<string, string> = {
  compliant: "Compliant",
  partial: "Partially Compliant",
  "non-compliant": "Non-Compliant",
}

function getProgressColor(percent: number): string {
  if (percent >= 90) return "text-green-500"
  if (percent >= 70) return "text-yellow-500"
  return "text-red-500"
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} className="h-64 w-full" />
      ))}
    </div>
  )
}

export default function CompliancePage() {
  const { data, isLoading, error } = useComplianceFrameworks()

  const frameworks = (data?.frameworks ?? []).map((fw) => ({
    ...fw,
    slug: fw.name.toLowerCase().replace(/[\s.]+/g, "-"),
    icon: fw.name.split(" ")[0].toUpperCase(),
    compliancePercent: fw.controlsTotal > 0 ? Math.round((fw.controlsPassed / fw.controlsTotal) * 100) : 0,
    passCount: fw.controlsPassed,
    failCount: fw.controlsFailed,
    totalControls: fw.controlsTotal,
  }))

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compliance Frameworks</h1>
          <p className="text-muted-foreground mt-1">Track compliance across industry standard security frameworks.</p>
        </div>
        <Card className="border-red-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-red-500">Failed to load compliance frameworks. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const overallStats = {
    totalControls: frameworks.reduce((a, f) => a + f.totalControls, 0),
    passedControls: frameworks.reduce((a, f) => a + f.passCount, 0),
    failedControls: frameworks.reduce((a, f) => a + f.failCount, 0),
    compliant: frameworks.filter((f) => f.status === "compliant").length,
    partial: frameworks.filter((f) => f.status === "partial").length,
    nonCompliant: frameworks.filter((f) => f.status === "non-compliant").length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compliance Frameworks</h1>
        <p className="text-muted-foreground mt-1">
          Track compliance across industry standard security frameworks.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-green-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <div className="text-2xl font-bold text-green-500">{overallStats.compliant}</div>
                <p className="text-sm text-muted-foreground">Fully Compliant</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold text-yellow-500">{overallStats.partial}</div>
                <p className="text-sm text-muted-foreground">Partially Compliant</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <div className="text-2xl font-bold text-red-500">{overallStats.nonCompliant}</div>
                <p className="text-sm text-muted-foreground">Non-Compliant</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {frameworks.map((fw) => (
            <Card key={fw.id} className={`hover:shadow-md transition-shadow ${statusColors[fw.status]}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <span className="text-xs font-bold">{fw.icon}</span>
                    </div>
                    <div>
                      <CardTitle className="text-lg">{fw.name}</CardTitle>
                      <Badge variant="outline" className="mt-1 gap-1">
                        {statusIcons[fw.status]}
                        <span className="text-xs">{statusLabels[fw.status]}</span>
                      </Badge>
                    </div>
                  </div>
                </div>
                <CardDescription className="mt-2 text-xs line-clamp-2">{fw.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Compliance</span>
                    <span className={`text-lg font-bold ${getProgressColor(fw.compliancePercent)}`}>
                      {fw.compliancePercent}%
                    </span>
                  </div>
                  <Progress value={fw.compliancePercent} className="h-2" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    <span>{fw.passCount} passed</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-500" />
                    <span>{fw.failCount} failed</span>
                  </div>
                  <span className="text-muted-foreground">{fw.totalControls} total</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Last assessed: {fw.lastAssessed}
                </div>
                <Button variant="ghost" size="sm" className="w-full" asChild>
                  <Link href={`/dashboard/security-testing/compliance/${fw.slug}`}>
                    View Details <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

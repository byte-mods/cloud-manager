"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Key,
  FileText,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
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
import { useSecurityScore } from "@/hooks/use-security-score"
import { useSecrets, useCertificates, useVulnerabilities } from "@/hooks/use-security"


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

const complianceStatusColors: Record<string, string> = {
  compliant: "text-green-500",
  partial: "text-yellow-500",
  "non-compliant": "text-red-500",
}

function SecurityScoreGauge({ score, maxScore }: { score: number; maxScore: number }) {
  const percentage = Math.round((score / maxScore) * 100)
  const getColor = () => {
    if (percentage >= 80) return "text-green-500"
    if (percentage >= 60) return "text-yellow-500"
    return "text-red-500"
  }

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
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${percentage * 3.14} ${314 - percentage * 3.14}`}
            className={getColor()}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${getColor()}`}>{percentage}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <p className="text-sm font-medium mt-2">Security Score</p>
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

export default function SecurityOverviewPage() {
  const { score, maxScore, categories, isLoading } = useSecurityScore()
  const { data: secretsData } = useSecrets()
  const { data: certificatesData } = useCertificates()
  const { data: vulnerabilitiesData } = useVulnerabilities()
  const [threatFilter, setThreatFilter] = useState<string>("all")

  const displayScore = score || 76
  const displayMaxScore = maxScore || 100

  const secrets = secretsData?.secrets ?? []
  const certificates = certificatesData?.certificates ?? []
  const vulnerabilities = vulnerabilitiesData?.vulnerabilities ?? []

  const needRotation = secrets.filter(s => !s.expiresAt || new Date(s.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length
  const expiringCerts = certificates.filter(c => c.status === 'expiring' || c.status === 'expired').length

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security</h1>
          <p className="text-muted-foreground mt-1">
            Security overview and threat monitoring across all providers.
          </p>
        </div>
        <LoadingSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security</h1>
          <p className="text-muted-foreground mt-1">
            Security overview and threat monitoring across all providers.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/security/audit">
              <FileText className="mr-2 h-4 w-4" />
              Audit Logs
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/security/iam">
              <Users className="mr-2 h-4 w-4" />
              Manage IAM
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <SecurityScoreGauge score={displayScore} maxScore={displayMaxScore} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IAM Summary</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Active Users</span>
              <span className="font-medium">0/0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Service Accounts</span>
              <span className="font-medium">0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Roles / Policies</span>
              <span className="font-medium">0 / 0</span>
            </div>
            <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
              <Link href="/dashboard/security/iam">
                Manage IAM <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Secrets</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Secrets</span>
              <span className="font-medium">{secrets.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Need Rotation</span>
              {needRotation > 0 ? <Badge variant="destructive" className="h-5 text-xs">{needRotation}</Badge> : <span className="font-medium">0</span>}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last Rotated</span>
              <span className="font-medium">2 days ago</span>
            </div>
            <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
              <Link href="/dashboard/security/secrets">
                Manage Secrets <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certificates</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Active Certificates</span>
              <span className="font-medium">{certificates.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Expiring Soon</span>
              {expiringCerts > 0 ? <Badge variant="destructive" className="h-5 text-xs">{expiringCerts}</Badge> : <span className="font-medium">0</span>}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Auto-Renewal</span>
              <span className="font-medium">18 enabled</span>
            </div>
            <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
              <Link href="/dashboard/security/certificates">
                Manage Certificates <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Threats</CardTitle>
            <CardDescription>Security threats detected across your infrastructure</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-sm text-muted-foreground">No data available</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compliance Status</CardTitle>
            <CardDescription>Framework compliance overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-sm text-muted-foreground">No data available</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

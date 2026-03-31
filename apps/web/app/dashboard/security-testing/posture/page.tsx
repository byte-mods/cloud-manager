"use client"

import { useState, useMemo } from "react"
import {
  Shield,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Cloud,
  Network,
  Database,
  Server,
  FileText,
  Bell,
  CheckCircle2,
  XCircle,
  ArrowRight,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSecurityScore } from "@/hooks/use-security-score"

type PostureCategory = {
  name: string
  score: number
  icon: React.ReactNode
  findings: { pass: number; fail: number; warn: number }
}

type BenchmarkResult = {
  provider: string
  benchmark: string
  score: number
  pass: number
  fail: number
  warn: number
  lastRun: string
}

type DriftAlert = {
  id: string
  resource: string
  provider: string
  change: string
  severity: "critical" | "high" | "medium" | "low"
  detectedAt: string
  status: "new" | "acknowledged" | "resolved"
}

const categoryIcons: Record<string, React.ReactNode> = {
  IAM: <Shield className="h-4 w-4" />,
  Network: <Network className="h-4 w-4" />,
  Data: <Database className="h-4 w-4" />,
  Compute: <Server className="h-4 w-4" />,
  Logging: <FileText className="h-4 w-4" />,
}

const driftSeverityVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
}

const driftStatusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "destructive",
  acknowledged: "secondary",
  resolved: "default",
}

function PostureScoreGauge({ score }: { score: number }) {
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
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-48 h-48">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted" />
          <circle
            cx="60" cy="60" r="50" fill="none" stroke={getColor()} strokeWidth="10"
            strokeLinecap="round" strokeDasharray={strokeDasharray}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-bold ${getTextClass()}`}>{score}</span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
      </div>
    </div>
  )
}

function TrendChart() {
  const maxScore = 100
  const minScore = Math.min(...trendData.map((d) => d.score)) - 5
  const chartHeight = 120
  const chartWidth = 300

  const points = trendData.map((d, i) => {
    const x = (i / (trendData.length - 1)) * chartWidth
    const y = chartHeight - ((d.score - minScore) / (maxScore - minScore)) * chartHeight
    return `${x},${y}`
  }).join(" ")

  return (
    <div className="space-y-2">
      <svg viewBox={`-10 -10 ${chartWidth + 20} ${chartHeight + 30}`} className="w-full h-40">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-primary"
        />
        {trendData.map((d, i) => {
          const x = (i / (trendData.length - 1)) * chartWidth
          const y = chartHeight - ((d.score - minScore) / (maxScore - minScore)) * chartHeight
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="4" fill="currentColor" className="text-primary" />
              <text x={x} y={chartHeight + 18} textAnchor="middle" className="fill-current text-muted-foreground" fontSize="10">
                {d.month}
              </text>
              <text x={x} y={y - 10} textAnchor="middle" className="fill-current text-muted-foreground" fontSize="9">
                {d.score}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full col-span-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  )
}

export default function PosturePage() {
  const { score: postureScore, categories: hookCategories, trend: hookTrend, isLoading, error } = useSecurityScore()
  const [activeTab, setActiveTab] = useState("overview")

  const trendData = useMemo(() =>
    hookTrend.map((t) => ({ month: new Date(t.date).toLocaleString("default", { month: "short" }), score: t.score })),
    [hookTrend]
  )

  const posCategories: PostureCategory[] = useMemo(() =>
    hookCategories.map((c) => ({
      name: c.name,
      score: c.maxScore > 0 ? Math.round((c.score / c.maxScore) * 100) : 0,
      icon: categoryIcons[c.name] ?? <Shield className="h-4 w-4" />,
      findings: { pass: c.score, fail: c.criticalFindings, warn: c.findings - c.criticalFindings },
    })),
    [hookCategories]
  )

  const lastScore = trendData[trendData.length - 2]?.score || 0
  const scoreDelta = postureScore - lastScore

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Posture</h1>
          <p className="text-muted-foreground mt-1">Overall security posture assessment and monitoring.</p>
        </div>
        <LoadingSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Posture</h1>
          <p className="text-muted-foreground mt-1">Overall security posture assessment and monitoring.</p>
        </div>
        <Card className="border-red-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-red-500">Failed to load security posture data. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security Posture</h1>
        <p className="text-muted-foreground mt-1">
          Overall security posture assessment and monitoring across all providers.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Posture Score</CardTitle>
            <CardDescription>
              Overall security rating
              {scoreDelta !== 0 && (
                <span className={`ml-2 inline-flex items-center gap-1 ${scoreDelta > 0 ? "text-green-500" : "text-red-500"}`}>
                  {scoreDelta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {scoreDelta > 0 ? "+" : ""}{scoreDelta} from last month
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PostureScoreGauge score={postureScore} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Score Trend</CardTitle>
            <CardDescription>Security posture score over time</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
          <CardDescription>Security posture by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            {posCategories.map((cat) => (
              <div key={cat.name} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {cat.icon}
                    <span className="text-sm font-medium">{cat.name}</span>
                  </div>
                  <span className={`text-lg font-bold ${cat.score >= 80 ? "text-green-500" : cat.score >= 60 ? "text-yellow-500" : "text-red-500"}`}>
                    {cat.score}
                  </span>
                </div>
                <Progress value={cat.score} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="text-green-500">{cat.findings.pass} pass</span>
                  <span className="text-red-500">{cat.findings.fail} fail</span>
                  <span className="text-yellow-500">{cat.findings.warn} warn</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CIS Benchmark Results</CardTitle>
          <CardDescription>Security benchmarks by cloud provider</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="aws">
            <TabsList>
              <TabsTrigger value="aws" className="gap-2">
                <Cloud className="h-4 w-4" /> AWS
              </TabsTrigger>
              <TabsTrigger value="gcp" className="gap-2">
                <Cloud className="h-4 w-4" /> GCP
              </TabsTrigger>
              <TabsTrigger value="azure" className="gap-2">
                <Cloud className="h-4 w-4" /> Azure
              </TabsTrigger>
            </TabsList>
            {["aws", "gcp", "azure"].map((provider) => (
              <TabsContent key={provider} value={provider}>
                <div className="space-y-4 mt-4">
                  {([] as BenchmarkResult[])
                    .filter((b) => b.provider.toLowerCase() === provider)
                    .map((benchmark) => (
                      <div key={benchmark.benchmark} className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{benchmark.benchmark}</p>
                            <p className="text-xs text-muted-foreground">Last run: {benchmark.lastRun}</p>
                          </div>
                          <span className={`text-2xl font-bold ${benchmark.score >= 80 ? "text-green-500" : benchmark.score >= 60 ? "text-yellow-500" : "text-red-500"}`}>
                            {benchmark.score}%
                          </span>
                        </div>
                        <Progress value={benchmark.score} className="h-2" />
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1 text-green-500">
                            <CheckCircle2 className="h-3 w-3" /> {benchmark.pass} passed
                          </span>
                          <span className="flex items-center gap-1 text-red-500">
                            <XCircle className="h-3 w-3" /> {benchmark.fail} failed
                          </span>
                          <span className="flex items-center gap-1 text-yellow-500">
                            <AlertTriangle className="h-3 w-3" /> {benchmark.warn} warnings
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Drift Alerts
              </CardTitle>
              <CardDescription>Configuration drift detected across your infrastructure</CardDescription>
            </div>
            <Badge variant="destructive" className="gap-1">
              {([] as DriftAlert[]).filter((a) => a.status === "new").length} new
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {([] as DriftAlert[]).map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg border">
                <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${alert.severity === "critical" ? "text-red-500" : alert.severity === "high" ? "text-orange-500" : "text-yellow-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-medium">{alert.resource}</span>
                    <Badge variant="outline" className="text-xs">{alert.provider}</Badge>
                    <Badge variant={driftSeverityVariants[alert.severity]} className="text-xs capitalize">{alert.severity}</Badge>
                    <Badge variant={driftStatusVariants[alert.status]} className="text-xs capitalize">{alert.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{alert.change}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Detected: {alert.detectedAt}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import Link from "next/link"
import { useDevOpsOverview, useDeployments, useIaCWorkspaces } from "@/hooks/use-devops"
import {
  Rocket,
  GitBranch,
  Code2,
  Settings,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Container,
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

const deploymentStatusIcons: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  "in-progress": <Clock className="h-4 w-4 text-blue-500 animate-pulse" />,
}

const deploymentStatusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  failed: "destructive",
  "in-progress": "secondary",
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

export default function DevOpsOverviewPage() {
  const { data, isLoading, error } = useDevOpsOverview()
  const { data: deploymentsData } = useDeployments()
  const { data: iacData } = useIaCWorkspaces()

  const pipelineSuccessRate = data?.successRate ?? 0
  const totalDeployments = data?.activeDeployments ?? 0
  const totalPipelines = data?.totalPipelines ?? 0
  const recentDeployments = deploymentsData?.deployments ?? []
  const iacWorkspaces = iacData?.workspaces ?? []

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DevOps</h1>
          <p className="text-muted-foreground mt-1">CI/CD pipelines, infrastructure as code, and deployment management.</p>
        </div>
        <LoadingSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DevOps</h1>
          <p className="text-muted-foreground mt-1">CI/CD pipelines, infrastructure as code, and deployment management.</p>
        </div>
        <div className="text-destructive text-sm">Failed to load DevOps overview. Please try again later.</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DevOps</h1>
          <p className="text-muted-foreground mt-1">
            CI/CD pipelines, infrastructure as code, and deployment management.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/devops/gitops">
              <GitBranch className="mr-2 h-4 w-4" />
              GitOps
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/devops/pipelines">
              <Rocket className="mr-2 h-4 w-4" />
              Pipelines
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{pipelineSuccessRate}%</div>
            <Progress value={pipelineSuccessRate} className="h-2 mt-2" />
            <Button variant="ghost" size="sm" className="mt-3 -ml-2 h-8" asChild>
              <Link href="/dashboard/devops/pipelines">
                View Pipelines <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pipelines</CardTitle>
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPipelines}</div>
            <p className="text-xs text-muted-foreground">Across all providers</p>
            <Button variant="ghost" size="sm" className="mt-3 -ml-2 h-8" asChild>
              <Link href="/dashboard/devops/pipelines">
                Manage <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deployments (30d)</CardTitle>
            <Container className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeployments}</div>
            <p className="text-xs text-muted-foreground">+12 from last month</p>
            <Button variant="ghost" size="sm" className="mt-3 -ml-2 h-8" asChild>
              <Link href="/dashboard/devops/deployment">
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IaC Resources</CardTitle>
            <Code2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{iacWorkspaces.reduce((a, b) => a + b.resourceCount, 0)}</div>
            <p className="text-xs text-muted-foreground">{iacWorkspaces.length} workspaces</p>
            <Button variant="ghost" size="sm" className="mt-3 -ml-2 h-8" asChild>
              <Link href="/dashboard/devops/iac">
                Manage IaC <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Deployments</CardTitle>
                <CardDescription>Latest deployment activity</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/devops/deployment">
                  View All <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentDeployments.slice(0, 5).map((dep) => (
                <div key={dep.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3 min-w-0">
                    {deploymentStatusIcons[dep.status] ?? <Clock className="h-4 w-4 text-muted-foreground" />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{dep.name}</span>
                        <Badge variant="outline" className="text-xs">{dep.version}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant={deploymentStatusVariants[dep.status] ?? "outline"} className="text-xs capitalize">
                          {dep.environment}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{dep.deployedAt}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{dep.region}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Infrastructure as Code</CardTitle>
                <CardDescription>IaC provider status overview</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/devops/iac">
                  Manage <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {iacWorkspaces.map((iac) => (
                <div key={iac.id} className="p-3 rounded-lg border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{iac.name}</span>
                    </div>
                    {iac.status === "drifted" && (
                      <Badge variant="destructive" className="text-xs">Drift Detected</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{iac.provider}</span>
                    <span>{iac.resourceCount} resources</span>
                    <span>Last applied: {iac.lastAppliedAt ?? "Never"}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/dashboard/devops/gitops">
            <CardHeader>
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">GitOps</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Manage applications with Git-based workflows and automated sync.</p>
            </CardContent>
          </Link>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/dashboard/devops/deployment">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Deployment Strategies</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Configure Blue/Green, Canary, and Rolling deployment strategies.</p>
            </CardContent>
          </Link>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/dashboard/devops/config">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Configuration</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Centralized configuration management across all environments.</p>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  )
}

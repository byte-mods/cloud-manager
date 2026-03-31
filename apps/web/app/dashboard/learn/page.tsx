"use client"

import Link from "next/link"
import {
  Building2,
  Wrench,
  Database,
  Monitor,
  Network,
  BookOpen,
  Trophy,
  Clock,
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
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

type LearningPath = {
  role: string
  slug: string
  title: string
  description: string
  icon: typeof Building2
  color: string
  bgColor: string
  tutorialsCount: number
  completedCount: number
}

const learningPaths: LearningPath[] = [
  {
    role: "cloud-architect",
    slug: "cloud-architect",
    title: "Cloud Architect",
    description: "Design scalable, resilient multi-cloud architectures. Learn best practices for high availability, disaster recovery, and cost optimization.",
    icon: Building2,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    tutorialsCount: 18,
    completedCount: 7,
  },
  {
    role: "devops-engineer",
    slug: "devops-engineer",
    title: "DevOps Engineer",
    description: "Master CI/CD pipelines, infrastructure as code, containerization, and automated deployments across cloud platforms.",
    icon: Wrench,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    tutorialsCount: 22,
    completedCount: 12,
  },
  {
    role: "data-engineer",
    slug: "data-engineer",
    title: "Data Engineer",
    description: "Build and manage data pipelines, data lakes, ETL processes, and real-time streaming architectures on the cloud.",
    icon: Database,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    tutorialsCount: 16,
    completedCount: 3,
  },
  {
    role: "system-admin",
    slug: "system-admin",
    title: "System Admin",
    description: "Manage cloud infrastructure, configure monitoring, handle incident response, and maintain system reliability.",
    icon: Monitor,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    tutorialsCount: 20,
    completedCount: 8,
  },
  {
    role: "network-admin",
    slug: "network-admin",
    title: "Network Admin",
    description: "Configure VPCs, load balancers, DNS, VPNs, and network security across AWS, GCP, and Azure.",
    icon: Network,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    tutorialsCount: 14,
    completedCount: 2,
  },
]

export default function LearnOverviewPage() {
  const { data: stats } = useQuery({ queryKey: ['learn-stats'], queryFn: () => apiClient.get('/v1/learn/progress') })
  const totalTutorials = learningPaths.reduce((sum, p) => sum + p.tutorialsCount, 0)
  const totalCompleted = learningPaths.reduce((sum, p) => sum + p.completedCount, 0)
  const overallProgress = totalTutorials > 0 ? Math.round((totalCompleted / totalTutorials) * 100) : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Learning Center</h1>
        <p className="text-muted-foreground mt-1">
          Role-based learning paths to master cloud infrastructure management.
        </p>
      </div>

      {/* Overall stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallProgress}%</div>
            <Progress value={overallProgress} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompleted}/{totalTutorials}</div>
            <p className="text-xs text-muted-foreground mt-1">tutorials completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Learning Paths</CardTitle>
            <Network className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{learningPaths.length}</div>
            <p className="text-xs text-muted-foreground mt-1">role-based paths</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Study Time</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24h</div>
            <p className="text-xs text-muted-foreground mt-1">total learning time</p>
          </CardContent>
        </Card>
      </div>

      {/* Learning paths grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Learning Paths</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {learningPaths.map((path) => {
            const progress = path.tutorialsCount > 0
              ? Math.round((path.completedCount / path.tutorialsCount) * 100)
              : 0

            return (
              <Card key={path.role} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className={`rounded-lg p-3 w-fit ${path.bgColor}`}>
                    <path.icon className={`h-6 w-6 ${path.color}`} />
                  </div>
                  <CardTitle className="mt-3">{path.title}</CardTitle>
                  <CardDescription className="min-h-[48px]">
                    {path.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {path.completedCount}/{path.tutorialsCount} tutorials
                    </span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} />
                  <Button asChild className="w-full mt-2">
                    <Link href={`/dashboard/learn/paths/${path.slug}`}>
                      {path.completedCount > 0 ? "Continue" : "Start"} Learning
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Button variant="outline" className="h-auto p-4 justify-start" asChild>
          <Link href="/dashboard/learn/sandbox">
            <Monitor className="h-4 w-4 mr-2 text-primary" />
            Open Sandbox Environment
          </Link>
        </Button>
        <Button variant="outline" className="h-auto p-4 justify-start" asChild>
          <Link href="/dashboard/learn/progress">
            <Trophy className="h-4 w-4 mr-2 text-primary" />
            View Progress Dashboard
          </Link>
        </Button>
        <Button variant="outline" className="h-auto p-4 justify-start" asChild>
          <Link href="/dashboard/learn/tutorials/1">
            <BookOpen className="h-4 w-4 mr-2 text-primary" />
            Resume Last Tutorial
          </Link>
        </Button>
      </div>
    </div>
  )
}

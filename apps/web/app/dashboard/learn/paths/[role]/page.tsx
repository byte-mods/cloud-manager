"use client"

import { use } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle,
  Circle,
  Clock,
  BookOpen,
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
import { Progress } from "@/components/ui/progress"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

type Tutorial = {
  id: string
  title: string
  difficulty: "Beginner" | "Intermediate" | "Advanced"
  duration: string
  completed: boolean
}

const pathData: Record<string, { title: string; description: string; tutorials: Tutorial[] }> = {
  "cloud-architect": {
    title: "Cloud Architect",
    description: "Design scalable, resilient multi-cloud architectures with best practices for high availability, disaster recovery, and cost optimization.",
    tutorials: [
      { id: "ca-1", title: "Introduction to Multi-Cloud Architecture", difficulty: "Beginner", duration: "30 min", completed: true },
      { id: "ca-2", title: "Designing for High Availability", difficulty: "Beginner", duration: "45 min", completed: true },
      { id: "ca-3", title: "VPC and Network Design Patterns", difficulty: "Intermediate", duration: "60 min", completed: true },
      { id: "ca-4", title: "Cost-Optimized Architecture", difficulty: "Intermediate", duration: "45 min", completed: false },
      { id: "ca-5", title: "Disaster Recovery Strategies", difficulty: "Intermediate", duration: "50 min", completed: false },
      { id: "ca-6", title: "Microservices Architecture on Cloud", difficulty: "Advanced", duration: "90 min", completed: false },
      { id: "ca-7", title: "Serverless Architecture Patterns", difficulty: "Advanced", duration: "75 min", completed: false },
      { id: "ca-8", title: "Multi-Region Deployment", difficulty: "Advanced", duration: "60 min", completed: false },
    ],
  },
  "devops-engineer": {
    title: "DevOps Engineer",
    description: "Master CI/CD pipelines, infrastructure as code, containerization, and automated deployments across cloud platforms.",
    tutorials: [
      { id: "de-1", title: "Introduction to DevOps on Cloud", difficulty: "Beginner", duration: "30 min", completed: true },
      { id: "de-2", title: "Infrastructure as Code with Terraform", difficulty: "Beginner", duration: "60 min", completed: true },
      { id: "de-3", title: "CI/CD Pipelines with GitHub Actions", difficulty: "Intermediate", duration: "45 min", completed: true },
      { id: "de-4", title: "Container Orchestration with Kubernetes", difficulty: "Intermediate", duration: "90 min", completed: false },
      { id: "de-5", title: "GitOps with ArgoCD", difficulty: "Advanced", duration: "60 min", completed: false },
    ],
  },
  "data-engineer": {
    title: "Data Engineer",
    description: "Build and manage data pipelines, data lakes, ETL processes, and real-time streaming architectures on the cloud.",
    tutorials: [
      { id: "dat-1", title: "Cloud Data Fundamentals", difficulty: "Beginner", duration: "30 min", completed: true },
      { id: "dat-2", title: "Building ETL Pipelines", difficulty: "Intermediate", duration: "60 min", completed: false },
      { id: "dat-3", title: "Real-Time Streaming with Kafka", difficulty: "Advanced", duration: "75 min", completed: false },
    ],
  },
  "system-admin": {
    title: "System Admin",
    description: "Manage cloud infrastructure, configure monitoring, handle incident response, and maintain system reliability.",
    tutorials: [
      { id: "sa-1", title: "Cloud Administration Basics", difficulty: "Beginner", duration: "30 min", completed: true },
      { id: "sa-2", title: "Monitoring and Alerting", difficulty: "Intermediate", duration: "45 min", completed: false },
      { id: "sa-3", title: "Incident Response Procedures", difficulty: "Advanced", duration: "60 min", completed: false },
    ],
  },
  "network-admin": {
    title: "Network Admin",
    description: "Configure VPCs, load balancers, DNS, VPNs, and network security across AWS, GCP, and Azure.",
    tutorials: [
      { id: "na-1", title: "Cloud Networking Fundamentals", difficulty: "Beginner", duration: "30 min", completed: true },
      { id: "na-2", title: "Advanced VPC Configuration", difficulty: "Intermediate", duration: "50 min", completed: false },
      { id: "na-3", title: "Load Balancer Strategies", difficulty: "Advanced", duration: "45 min", completed: false },
    ],
  },
}

function getDifficultyBadge(difficulty: Tutorial["difficulty"]) {
  switch (difficulty) {
    case "Beginner":
      return <Badge className="bg-green-500/10 text-green-500">Beginner</Badge>
    case "Intermediate":
      return <Badge className="bg-yellow-500/10 text-yellow-500">Intermediate</Badge>
    case "Advanced":
      return <Badge className="bg-red-500/10 text-red-500">Advanced</Badge>
  }
}

export default function LearningPathPage({ params }: { params: Promise<{ role: string }> }) {
  const { data: learnPathData } = useQuery({ queryKey: ['learn-path'], queryFn: () => apiClient.get('/v1/learn/paths'), enabled: false })
  const { role } = use(params)
  const path = pathData[role]

  if (!path) {
    return (
      <div className="space-y-8">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/learn">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Learning Center
          </Link>
        </Button>
        <div className="text-center py-16">
          <h2 className="text-xl font-medium">Learning path not found</h2>
          <p className="text-muted-foreground mt-2">The requested learning path does not exist.</p>
        </div>
      </div>
    )
  }

  const completedCount = path.tutorials.filter((t) => t.completed).length
  const progress = path.tutorials.length > 0 ? Math.round((completedCount / path.tutorials.length) * 100) : 0

  return (
    <div className="space-y-8">
      <Button variant="ghost" asChild>
        <Link href="/dashboard/learn">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Learning Center
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{path.title}</h1>
        <p className="text-muted-foreground mt-1">{path.description}</p>
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {completedCount} of {path.tutorials.length} tutorials completed
            </span>
            <span className="text-sm font-bold">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </CardContent>
      </Card>

      {/* Tutorial list */}
      <div className="space-y-3">
        {path.tutorials.map((tutorial, index) => (
          <Card key={tutorial.id} className={tutorial.completed ? "opacity-75" : ""}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex-shrink-0">
                {tutorial.completed ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${tutorial.completed ? "line-through text-muted-foreground" : ""}`}>
                  {tutorial.title}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  {getDifficultyBadge(tutorial.difficulty)}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {tutorial.duration}
                  </span>
                </div>
              </div>
              <Button size="sm" variant={tutorial.completed ? "outline" : "default"} asChild>
                <Link href={`/dashboard/learn/tutorials/${tutorial.id}`}>
                  {tutorial.completed ? "Review" : "Start"}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

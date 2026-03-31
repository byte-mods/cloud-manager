"use client"

import Link from "next/link"
import {
  Brain,
  Cpu,
  FlaskConical,
  Boxes,
  Eye,
  Sparkles,
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
import {
  useAIModels,
  useTrainingJobs,
  useMLOps,
} from "@/hooks/use-ai-ml"

const sections = [
  { title: "Foundation Models", href: "/dashboard/ai-ml/models", icon: Brain, color: "text-purple-500", bgColor: "bg-purple-500/10", desc: "Manage and deploy foundation models" },
  { title: "Training Jobs", href: "/dashboard/ai-ml/training", icon: Cpu, color: "text-blue-500", bgColor: "bg-blue-500/10", desc: "Monitor model training pipelines" },
  { title: "MLOps", href: "/dashboard/ai-ml/mlops", icon: FlaskConical, color: "text-green-500", bgColor: "bg-green-500/10", desc: "Experiments, registry, and feature store" },
  { title: "AI Services", href: "/dashboard/ai-ml/services", icon: Eye, color: "text-orange-500", bgColor: "bg-orange-500/10", desc: "Vision, Language, Speech, Translation" },
  { title: "Generative AI", href: "/dashboard/ai-ml/genai", icon: Sparkles, color: "text-pink-500", bgColor: "bg-pink-500/10", desc: "LLM playground and prompt engineering" },
]

export default function AIMLOverviewPage() {
  const { data: modelsData } = useAIModels()
  const { data: trainingData } = useTrainingJobs()
  const { data: mlopsData } = useMLOps()

  const models = modelsData?.models ?? []
  const jobs = trainingData?.jobs ?? []
  const experiments = mlopsData?.experiments ?? []

  const runningJobs = jobs.filter(j => j.status === 'running').length
  const completedJobs = jobs.filter(j => j.status === 'completed').length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI / ML</h1>
        <p className="text-muted-foreground mt-1">
          Manage AI and machine learning resources across cloud providers.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Models</CardTitle>
            <Brain className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{models.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Deployed models</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Training Jobs</CardTitle>
            <Cpu className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobs.length}</div>
            <div className="flex gap-1 mt-1">
              <Badge className="bg-blue-500/10 text-blue-500 text-xs">{runningJobs} running</Badge>
              <Badge className="bg-green-500/10 text-green-500 text-xs">{completedJobs} completed</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Endpoints</CardTitle>
            <Boxes className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{models.filter(m => m.status === 'available').length}</div>
            <p className="text-xs text-muted-foreground mt-1">Active inference endpoints</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Experiments</CardTitle>
            <FlaskConical className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{experiments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Tracked experiments</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Card key={section.title} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className={`rounded-lg p-3 w-fit ${section.bgColor}`}>
                <section.icon className={`h-6 w-6 ${section.color}`} />
              </div>
              <CardTitle className="mt-3">{section.title}</CardTitle>
              <CardDescription>{section.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href={section.href}>Open<ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

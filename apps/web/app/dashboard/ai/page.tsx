"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import Link from "next/link"
import {
  Terminal,
  MessageSquare,
  Lightbulb,
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

const features = [
  {
    title: "Claude Terminal",
    description: "AI-powered CLI terminal for managing cloud infrastructure using natural language commands. Execute operations, run diagnostics, and automate tasks.",
    icon: Terminal,
    href: "/dashboard/ai/terminal",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    title: "AI Chat",
    description: "Have a conversation with Claude about your infrastructure. Get answers, generate configurations, troubleshoot issues, and receive architecture advice.",
    icon: MessageSquare,
    href: "/dashboard/ai/chat",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Smart Suggestions",
    description: "Context-aware recommendations based on your current infrastructure state. Get proactive suggestions for cost optimization, security, and performance.",
    icon: Lightbulb,
    href: "/dashboard/ai/suggestions",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
]

export default function AIOverviewPage() {
  const { data: aiStats } = useQuery({ queryKey: ['ai-stats'], queryFn: () => apiClient.get('/v1/ai-ml/models') })
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-purple-500" />
          <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Powered by Claude. Manage, analyze, and optimize your cloud infrastructure with AI.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className={`rounded-lg p-3 w-fit ${feature.bgColor}`}>
                <feature.icon className={`h-6 w-6 ${feature.color}`} />
              </div>
              <CardTitle className="mt-4">{feature.title}</CardTitle>
              <CardDescription className="min-h-[60px]">
                {feature.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href={feature.href}>
                  Open {feature.title}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>Quick tips for using the AI assistant</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              "Ask Claude to explain your current cloud costs and suggest optimizations.",
              "Use the terminal to run natural language commands against your infrastructure.",
              "Review AI-generated suggestions for security and performance improvements.",
              "Chat with Claude to generate Terraform, CloudFormation, or Pulumi configurations.",
            ].map((tip, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="rounded-full bg-primary/10 text-primary w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-muted-foreground">{tip}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

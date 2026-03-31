"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import {
  DollarSign,
  Shield,
  Zap,
  Layers,
  Sparkles,
  ArrowRight,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type SuggestionCategory = "cost" | "security" | "performance" | "architecture"

type Suggestion = {
  id: string
  title: string
  description: string
  category: SuggestionCategory
  impact: "high" | "medium" | "low"
  module: string
}

const categoryConfig: Record<SuggestionCategory, { label: string; icon: typeof DollarSign; color: string; bgColor: string }> = {
  cost: { label: "Cost", icon: DollarSign, color: "text-green-500", bgColor: "bg-green-500/10" },
  security: { label: "Security", icon: Shield, color: "text-red-500", bgColor: "bg-red-500/10" },
  performance: { label: "Performance", icon: Zap, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  architecture: { label: "Architecture", icon: Layers, color: "text-blue-500", bgColor: "bg-blue-500/10" },
}


function getImpactBadge(impact: Suggestion["impact"]) {
  switch (impact) {
    case "high":
      return <Badge className="bg-red-500/10 text-red-500">High Impact</Badge>
    case "medium":
      return <Badge className="bg-yellow-500/10 text-yellow-500">Medium Impact</Badge>
    case "low":
      return <Badge className="bg-blue-500/10 text-blue-500">Low Impact</Badge>
  }
}

export default function AISuggestionsPage() {
  const [activeTab, setActiveTab] = useState("all")

  const { data, isLoading } = useQuery<{ suggestions: Suggestion[] }>({
    queryKey: ["ai", "suggestions"],
    queryFn: () => apiClient.get("/v1/ai-ml/suggestions"),
  })

  const suggestions = data?.suggestions ?? []

  const filtered = activeTab === "all"
    ? suggestions
    : suggestions.filter((s) => s.category === activeTab)

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-purple-500" />
          <h1 className="text-3xl font-bold tracking-tight">AI Suggestions</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Contextual recommendations powered by Claude based on your infrastructure state.
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(categoryConfig).map(([key, config]) => {
          const count = suggestions.filter((s) => s.category === key).length
          return (
            <Card key={key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
                <div className={`p-1.5 rounded-md ${config.bgColor}`}>
                  <config.icon className={`h-4 w-4 ${config.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
                <p className="text-xs text-muted-foreground mt-1">suggestions</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({suggestions.length})</TabsTrigger>
          {Object.entries(categoryConfig).map(([key, config]) => (
            <TabsTrigger key={key} value={key}>
              {config.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No suggestions in this category.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map((suggestion) => {
                const config = categoryConfig[suggestion.category]
                return (
                  <Card key={suggestion.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded ${config.bgColor}`}>
                            <config.icon className={`h-3.5 w-3.5 ${config.color}`} />
                          </div>
                          <CardTitle className="text-base">{suggestion.title}</CardTitle>
                        </div>
                        {getImpactBadge(suggestion.impact)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {suggestion.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">{suggestion.module}</Badge>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <BookOpen className="h-3 w-3 mr-1" />
                            Learn More
                          </Button>
                          <Button size="sm">
                            Apply
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

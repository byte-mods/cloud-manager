"use client"

import { useState } from "react"
import { useCostRecommendations } from "@/hooks/use-cost-data"
import {
  Lightbulb,
  DollarSign,
  Server,
  Calendar,
  Trash2,
  Layers,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type EffortLevel = "low" | "medium" | "high"
type Category = "rightsizing" | "reserved-instances" | "unused-resources" | "architecture"

type Recommendation = {
  id: string
  title: string
  description: string
  aiExplanation: string
  estimatedSavings: number
  effort: EffortLevel
  category: Category
  provider: string
  resource: string
}

const categoryConfig: Record<Category, { label: string; icon: typeof Lightbulb; color: string }> = {
  rightsizing: { label: "Rightsizing", icon: Server, color: "text-blue-500" },
  "reserved-instances": { label: "Reserved Instances", icon: Calendar, color: "text-purple-500" },
  "unused-resources": { label: "Unused Resources", icon: Trash2, color: "text-orange-500" },
  architecture: { label: "Architecture", icon: Layers, color: "text-green-500" },
}

function getEffortBadge(effort: EffortLevel) {
  switch (effort) {
    case "low":
      return <Badge className="bg-green-500/10 text-green-500">Low Effort</Badge>
    case "medium":
      return <Badge className="bg-yellow-500/10 text-yellow-500">Medium Effort</Badge>
    case "high":
      return <Badge className="bg-red-500/10 text-red-500">High Effort</Badge>
  }
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const [showAI, setShowAI] = useState(false)
  const config = categoryConfig[rec.category]

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <config.icon className={`h-4 w-4 ${config.color}`} />
            <CardTitle className="text-base">{rec.title}</CardTitle>
          </div>
          {getEffortBadge(rec.effort)}
        </div>
        <CardDescription>{rec.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Est. Monthly Savings</p>
              <p className="text-lg font-bold text-green-500">
                ${rec.estimatedSavings.toLocaleString()}
              </p>
            </div>
            <Badge variant="secondary">{rec.provider}</Badge>
            <Badge variant="outline">{rec.resource}</Badge>
          </div>
        </div>

        {showAI && (
          <div className="bg-muted/50 rounded-lg p-3 border">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">AI Analysis</span>
            </div>
            <p className="text-sm text-muted-foreground">{rec.aiExplanation}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button size="sm">
            Apply
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAI(!showAI)}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            {showAI ? "Hide" : "AI"} Explanation
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CostRecommendationsPage() {
  const [activeTab, setActiveTab] = useState("all")
  const { data, isLoading, error } = useCostRecommendations()

  const recommendations: Recommendation[] = (data?.recommendations ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    aiExplanation: r.description,
    estimatedSavings: r.estimatedSavings,
    effort: r.priority === "high" ? "high" as const : r.priority === "medium" ? "medium" as const : "low" as const,
    category: r.type === "rightsizing" ? "rightsizing" as const
      : r.type === "reserved-instance" ? "reserved-instances" as const
      : r.type === "unused-resource" ? "unused-resources" as const
      : "architecture" as const,
    provider: r.provider,
    resource: r.resource,
  }))

  const totalSavings = recommendations.reduce((sum, r) => sum + r.estimatedSavings, 0)

  const filteredRecs = activeTab === "all"
    ? recommendations
    : recommendations.filter((r) => r.category === activeTab)

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cost Recommendations</h1>
          <p className="text-muted-foreground mt-1">AI-powered recommendations to optimize your cloud spending.</p>
        </div>
        <div className="text-destructive text-sm">Failed to load recommendations. Please try again later.</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cost Recommendations</h1>
        <p className="text-muted-foreground mt-1">
          AI-powered recommendations to optimize your cloud spending.
        </p>
      </div>

      {/* Total savings card */}
      <Card className="border-green-500/20 bg-green-500/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Potential Monthly Savings</CardTitle>
          <Lightbulb className="h-5 w-5 text-green-500" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-32" />
          ) : (
            <>
              <div className="text-3xl font-bold text-green-500">
                ${totalSavings.toLocaleString()}/mo
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Across {recommendations.length} recommendations
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Category tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({recommendations.length})</TabsTrigger>
          {Object.entries(categoryConfig).map(([key, config]) => {
            const count = recommendations.filter((r) => r.category === key).length
            return (
              <TabsTrigger key={key} value={key}>
                {config.label} ({count})
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : filteredRecs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No recommendations in this category.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredRecs.map((rec) => (
                <RecommendationCard key={rec.id} rec={rec} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

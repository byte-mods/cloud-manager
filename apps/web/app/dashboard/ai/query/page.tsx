"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import {
  Brain,
  Send,
  Loader2,
  Table,
  LayoutGrid,
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
import { Input } from "@/components/ui/input"

type QueryResult = {
  id: string
  name: string
  type: string
  provider: string
  region: string
  status: string
}

const exampleQueries = [
  "Show all running EC2 instances in us-east-1",
  "Which resources have the highest cost this month?",
  "List all security groups with open ports",
  "Find idle resources across all providers",
  "Show unhealthy load balancers",
]

export default function AIQueryPage() {
  const { data: queryConfig } = useQuery({ queryKey: ['ai-query-config'], queryFn: () => apiClient.get('/v1/ai-ml/models'), enabled: false })
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<QueryResult[]>([])
  const [hasQueried, setHasQueried] = useState(false)
  const [viewMode, setViewMode] = useState<"table" | "cards">("table")

  function handleQuery() {
    if (!query.trim()) return
    setIsLoading(true)
    setHasQueried(true)

    // Simulate AI query response
    setTimeout(() => {
      setResults([
        { id: "r-1", name: "api-gateway-prod", type: "EC2 Instance", provider: "AWS", region: "us-east-1", status: "running" },
        { id: "r-2", name: "auth-service-01", type: "EC2 Instance", provider: "AWS", region: "us-east-1", status: "running" },
        { id: "r-3", name: "worker-pool-az1", type: "VM Instance", provider: "GCP", region: "us-central1", status: "running" },
        { id: "r-4", name: "cache-cluster", type: "ElastiCache", provider: "AWS", region: "us-east-1", status: "available" },
        { id: "r-5", name: "prod-db-primary", type: "RDS Instance", provider: "AWS", region: "us-east-1", status: "available" },
      ])
      setIsLoading(false)
    }, 1500)
  }

  const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    running: "default",
    available: "default",
    stopped: "secondary",
    error: "destructive",
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Query</h1>
        <p className="text-muted-foreground mt-1">Ask questions about your cloud infrastructure in natural language.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Brain className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                placeholder="Ask about your infrastructure..."
                className="pl-10"
              />
            </div>
            <Button onClick={handleQuery} disabled={!query.trim() || isLoading}>
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Thinking...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" /> Ask Claude</>
              )}
            </Button>
          </div>
          {!hasQueried && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {exampleQueries.map((eq) => (
                  <button
                    key={eq}
                    onClick={() => { setQuery(eq); }}
                    className="text-xs px-3 py-1.5 rounded-full border bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {eq}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {hasQueried && !isLoading && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{results.length} results found</p>
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setViewMode("table")}
              >
                <Table className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "cards" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setViewMode("cards")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {viewMode === "table" ? (
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left font-medium py-2 pr-4">Name</th>
                        <th className="text-left font-medium py-2 pr-4">Type</th>
                        <th className="text-left font-medium py-2 pr-4">Provider</th>
                        <th className="text-left font-medium py-2 pr-4">Region</th>
                        <th className="text-left font-medium py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{r.name}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{r.type}</td>
                          <td className="py-2 pr-4"><Badge variant="outline">{r.provider}</Badge></td>
                          <td className="py-2 pr-4 text-muted-foreground">{r.region}</td>
                          <td className="py-2"><Badge variant={statusVariant[r.status] ?? "outline"}>{r.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {results.map((r) => (
                <Card key={r.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{r.name}</CardTitle>
                      <Badge variant={statusVariant[r.status] ?? "outline"}>{r.status}</Badge>
                    </div>
                    <CardDescription>{r.type}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline">{r.provider}</Badge>
                      <span>{r.region}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {hasQueried && !isLoading && results.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Brain className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No results found</h3>
            <p className="text-muted-foreground text-sm mt-1">Try rephrasing your query or ask about different resources.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

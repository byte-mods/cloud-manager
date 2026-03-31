"use client"

import Link from "next/link"
import {
  BarChart3,
  Search,
  FileText,
  Database,
  LineChart,
  ArrowRight,
  CheckCircle,
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
import { useVisualizations, useReports } from "@/hooks/use-analytics"

const sections = [
  { title: "Query Engines", href: "/dashboard/analytics/query", icon: Database, color: "text-blue-500", bgColor: "bg-blue-500/10", desc: "Run SQL queries across data warehouses" },
  { title: "Visualization", href: "/dashboard/analytics/visualization", icon: LineChart, color: "text-purple-500", bgColor: "bg-purple-500/10", desc: "BI dashboards and chart builder" },
  { title: "Search", href: "/dashboard/analytics/search", icon: Search, color: "text-green-500", bgColor: "bg-green-500/10", desc: "Full-text search and index management" },
  { title: "Reports", href: "/dashboard/analytics/reports", icon: FileText, color: "text-orange-500", bgColor: "bg-orange-500/10", desc: "Scheduled and ad-hoc reports" },
]

const queryEngines = [
  { name: "Amazon Redshift", status: "healthy", queries: "1.2K/day" },
  { name: "Google BigQuery", status: "healthy", queries: "3.4K/day" },
  { name: "Azure Synapse", status: "healthy", queries: "890/day" },
  { name: "Amazon Athena", status: "healthy", queries: "450/day" },
]

export default function AnalyticsOverviewPage() {
  const { data: visualizationsData } = useVisualizations()
  const { data: reportsData } = useReports()

  const visualizations = visualizationsData?.visualizations ?? []
  const reports = reportsData?.reports ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Query engines, visualization, search, and reporting across cloud providers.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Query Engines</CardTitle>
            <Database className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queryEngines.length}</div>
            <p className="text-xs text-muted-foreground mt-1">All healthy</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">BI Connections</CardTitle>
            <LineChart className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{visualizations.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Visualizations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Queries</CardTitle>
            <BarChart3 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5.9K</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reports</CardTitle>
            <FileText className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Scheduled</p>
          </CardContent>
        </Card>
      </div>

      {/* Query engine status */}
      <Card>
        <CardHeader>
          <CardTitle>Query Engine Status</CardTitle>
          <CardDescription>Health of connected analytics engines</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {queryEngines.map((engine) => (
              <div key={engine.name} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">{engine.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{engine.queries}</Badge>
                  <Badge className="bg-green-500/10 text-green-500 text-xs">Healthy</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
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

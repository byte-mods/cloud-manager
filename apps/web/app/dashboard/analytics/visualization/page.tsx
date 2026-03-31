"use client"

import { useState, useMemo } from "react"
import { BarChart3, LineChart, PieChart, Table2 } from "lucide-react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useVisualizations } from "@/hooks/use-analytics"

const chartTypes = [
  { value: "bar", label: "Bar Chart", icon: BarChart3 },
  { value: "line", label: "Line Chart", icon: LineChart },
  { value: "pie", label: "Pie Chart", icon: PieChart },
  { value: "table", label: "Table", icon: Table2 },
]


function SampleBarChart() {
  const data = [
    { label: "AWS", value: 65 },
    { label: "GCP", value: 45 },
    { label: "Azure", value: 35 },
  ]
  const maxValue = Math.max(...data.map((d) => d.value))

  return (
    <svg viewBox="0 0 300 200" className="w-full h-48">
      {data.map((d, i) => {
        const barWidth = 60
        const gap = 30
        const x = 40 + i * (barWidth + gap)
        const barHeight = (d.value / maxValue) * 140
        return (
          <g key={d.label}>
            <rect x={x} y={180 - barHeight} width={barWidth} height={barHeight} rx={4} fill={["#3b82f6", "#10b981", "#f59e0b"][i]} />
            <text x={x + barWidth / 2} y={195} textAnchor="middle" fontSize="11" className="fill-current">{d.label}</text>
            <text x={x + barWidth / 2} y={175 - barHeight} textAnchor="middle" fontSize="10" className="fill-muted-foreground">{d.value}%</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function VisualizationPage() {
  const { data, isLoading, error } = useVisualizations()
  const [chartType, setChartType] = useState("bar")
  const [activeTab, setActiveTab] = useState("dashboards")

  const dashboards = useMemo(() =>
    (data?.visualizations ?? []).map((v) => ({
      name: v.name,
      charts: 1,
      lastUpdated: v.lastModified,
    })),
    [data]
  )

  if (isLoading) return <div className="space-y-4">{Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Visualization</h1>
        <p className="text-muted-foreground mt-1">
          BI dashboards, embedded visualizations, and chart builder.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
          <TabsTrigger value="builder">Chart Builder</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboards" className="space-y-4">
          {/* Embedded dashboard placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Embedded Dashboards</CardTitle>
              <CardDescription>Connected BI dashboards</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {dashboards.map((dashboard) => (
                  <div key={dashboard.name} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-sm">{dashboard.name}</h3>
                      <Badge variant="secondary" className="text-xs">{dashboard.charts} charts</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Last updated: {dashboard.lastUpdated}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Dashboard embed area</p>
                <p className="text-xs mt-1">Select a dashboard above to embed it here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="builder" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Chart Builder</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Chart Type:</span>
                  <Select value={chartType} onValueChange={setChartType}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {chartTypes.map((ct) => (
                        <SelectItem key={ct.value} value={ct.value}>
                          <div className="flex items-center gap-2">
                            <ct.icon className="h-4 w-4" />
                            {ct.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-6 bg-muted/20">
                <SampleBarChart />
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Sample visualization - connect a data source to build custom charts
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

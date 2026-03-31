"use client"

import Link from "next/link"
import {
  ArrowRight,
  Database,
  Radio,
  HardDrive,
  Activity,
  CheckCircle,
  AlertTriangle,
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
  useETLJobs,
  useStreamingPipelines,
  useDataLakeDatasets,
} from "@/hooks/use-data-engineering"

const sections = [
  {
    title: "ETL Pipelines",
    description: "Manage extract, transform, and load workflows",
    icon: Database,
    href: "/dashboard/data-engineering/etl",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Streaming",
    description: "Real-time data streams and event processing",
    icon: Radio,
    href: "/dashboard/data-engineering/streaming",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    title: "Data Lake",
    description: "Centralized storage, catalogs, and governance",
    icon: HardDrive,
    href: "/dashboard/data-engineering/data-lake",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
]

export default function DataEngineeringPage() {
  const { data: etlData } = useETLJobs()
  const { data: streamingData } = useStreamingPipelines()
  const { data: dataLakeData } = useDataLakeDatasets()

  const etlJobs = etlData?.jobs ?? []
  const streamingPipelines = streamingData?.pipelines ?? []
  const dataLakeDatasets = dataLakeData?.datasets ?? []

  const totalPipelines = etlJobs.length + streamingPipelines.length + dataLakeDatasets.length
  const activeStreaming = streamingPipelines.filter(p => p.status === 'running').length
  const totalStreaming = streamingPipelines.length
  const failedJobs = etlJobs.filter(j => j.status === 'failed').length

  // Calculate total data lake size (mock parsing since API returns string)
  const dataLakeSize = "4.2 TB" // Would need proper parsing in production

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Engineering</h1>
        <p className="text-muted-foreground mt-1">
          Manage data pipelines, streaming, and data lake infrastructure.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pipelines</CardTitle>
            <Database className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPipelines}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all providers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Streaming Status</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {activeStreaming}/{totalStreaming}
              {activeStreaming === totalStreaming && totalStreaming > 0 && (
                <Badge className="bg-green-500/10 text-green-500 text-xs">Healthy</Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Lake Size</CardTitle>
            <HardDrive className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dataLakeSize}</div>
            <p className="text-xs text-muted-foreground mt-1">Across {dataLakeDatasets.length} datasets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Jobs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{failedJobs}</div>
            <p className="text-xs text-muted-foreground mt-1">Require attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Section cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {sections.map((section) => {
          let stats = { total: 0, active: 0, failed: 0 }
          if (section.href.includes('etl')) {
            stats = { total: etlJobs.length, active: etlJobs.filter(j => j.status === 'running' || j.status === 'completed').length, failed: etlJobs.filter(j => j.status === 'failed').length }
          } else if (section.href.includes('streaming')) {
            stats = { total: streamingPipelines.length, active: streamingPipelines.filter(p => p.status === 'running').length, failed: streamingPipelines.filter(p => p.status === 'error').length }
          } else if (section.href.includes('data-lake')) {
            stats = { total: dataLakeDatasets.length, active: dataLakeDatasets.length, failed: 0 }
          }
          return (
            <Card key={section.title} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className={`rounded-lg p-3 w-fit ${section.bgColor}`}>
                  <section.icon className={`h-6 w-6 ${section.color}`} />
                </div>
                <CardTitle className="mt-3">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Badge variant="secondary">{stats.total} total</Badge>
                  <Badge className="bg-green-500/10 text-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {stats.active} active
                  </Badge>
                  {stats.failed > 0 && (
                    <Badge className="bg-red-500/10 text-red-500">
                      {stats.failed} failed
                    </Badge>
                  )}
                </div>
                <Button asChild className="w-full">
                  <Link href={section.href}>
                    Manage
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

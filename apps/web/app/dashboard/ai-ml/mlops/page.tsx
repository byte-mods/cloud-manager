"use client"

import { useState } from "react"
import { FlaskConical, Box, Database } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/ui/data-table"
import { type ColumnDef } from "@tanstack/react-table"
import { useMLOps } from "@/hooks/use-ai-ml"

type Experiment = { id: string; name: string; runs: number; bestMetric: string; lastRun: string; status: "active" | "archived" }
type RegisteredModel = { id: string; name: string; version: string; stage: string; framework: string; updatedAt: string }
type Feature = { id: string; name: string; type: string; source: string; freshness: string; usage: number }

const expColumns: ColumnDef<Experiment>[] = [
  { accessorKey: "name", header: "Experiment" },
  { accessorKey: "runs", header: "Runs" },
  { accessorKey: "bestMetric", header: "Best Metric" },
  { accessorKey: "lastRun", header: "Last Run" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge className={row.original.status === "active" ? "bg-green-500/10 text-green-500" : "bg-gray-500/10 text-gray-500"}>{row.original.status === "active" ? "Active" : "Archived"}</Badge> },
]

const modelColumns: ColumnDef<RegisteredModel>[] = [
  { accessorKey: "name", header: "Model" },
  { accessorKey: "version", header: "Version" },
  { accessorKey: "stage", header: "Stage", cell: ({ row }) => { const s = row.original.stage; return <Badge className={s === "Production" ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"}>{s}</Badge> }},
  { accessorKey: "framework", header: "Framework" },
  { accessorKey: "updatedAt", header: "Updated" },
]

const featureColumns: ColumnDef<Feature>[] = [
  { accessorKey: "name", header: "Feature" },
  { accessorKey: "type", header: "Type", cell: ({ row }) => <Badge variant="outline">{row.original.type}</Badge> },
  { accessorKey: "source", header: "Source" },
  { accessorKey: "freshness", header: "Freshness" },
  { accessorKey: "usage", header: "Used By (models)" },
]


export default function MLOpsPage() {
  const [activeTab, setActiveTab] = useState("experiments")
  const { data, isLoading } = useMLOps()

  // Transform API data to UI format
  const experiments: Experiment[] = (data?.experiments ?? []).map(e => ({
    id: e.id,
    name: e.name,
    runs: 1,
    bestMetric: `Accuracy: ${(e.accuracy * 100).toFixed(1)}%`,
    lastRun: e.createdAt,
    status: "active" as const,
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">MLOps</h1>
        <p className="text-muted-foreground mt-1">Experiment tracking, model registry, and feature store.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="experiments"><FlaskConical className="h-4 w-4 mr-1" />Experiments</TabsTrigger>
          <TabsTrigger value="registry"><Box className="h-4 w-4 mr-1" />Model Registry</TabsTrigger>
          <TabsTrigger value="features"><Database className="h-4 w-4 mr-1" />Feature Store</TabsTrigger>
        </TabsList>

        <TabsContent value="experiments">
          <Card>
            <CardHeader><CardTitle>Experiments</CardTitle><CardDescription>Track and compare ML experiments</CardDescription></CardHeader>
            <CardContent>{isLoading ? <Skeleton className="h-40 w-full" /> : <DataTable columns={expColumns} data={experiments} searchKey="name" />}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="registry">
          <Card>
            <CardHeader><CardTitle>Model Registry</CardTitle><CardDescription>Registered models and deployment stages</CardDescription></CardHeader>
            <CardContent>{isLoading ? <Skeleton className="h-40 w-full" /> : <DataTable columns={modelColumns} data={[]} searchKey="name" />}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features">
          <Card>
            <CardHeader><CardTitle>Feature Store</CardTitle><CardDescription>Reusable features for ML models</CardDescription></CardHeader>
            <CardContent>{isLoading ? <Skeleton className="h-40 w-full" /> : <DataTable columns={featureColumns} data={[]} searchKey="name" />}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

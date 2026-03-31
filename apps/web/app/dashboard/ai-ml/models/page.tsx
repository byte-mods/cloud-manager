"use client"

import { Brain, Play } from "lucide-react"
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
import { DataTable } from "@/components/ui/data-table"
import { type ColumnDef } from "@tanstack/react-table"
import { useAIModels } from "@/hooks/use-ai-ml"

type Model = {
  id: string
  name: string
  provider: string
  type: string
  status: "deployed" | "available" | "deprecated"
  version: string
}

const columns: ColumnDef<Model>[] = [
  { accessorKey: "name", header: "Model Name" },
  { accessorKey: "provider", header: "Provider", cell: ({ row }) => <Badge variant="outline">{row.original.provider}</Badge> },
  { accessorKey: "type", header: "Type", cell: ({ row }) => <Badge variant="secondary">{row.original.type}</Badge> },
  { accessorKey: "version", header: "Version" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status
      const cls = s === "deployed" ? "bg-green-500/10 text-green-500" : s === "available" ? "bg-blue-500/10 text-blue-500" : "bg-yellow-500/10 text-yellow-500"
      return <Badge className={cls}>{s.charAt(0).toUpperCase() + s.slice(1)}</Badge>
    },
  },
  {
    id: "actions",
    header: "",
    cell: () => (
      <Button size="sm" variant="outline">
        <Play className="h-3 w-3 mr-1" />
        Playground
      </Button>
    ),
  },
]

export default function ModelsPage() {
  const { data, isLoading } = useAIModels()

  const models: Model[] = (data?.models ?? []).map(m => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    type: m.type,
    status: m.status === 'available' ? 'available' : m.status === 'training' ? 'available' : 'deprecated',
    version: m.version,
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Foundation Models</h1>
        <p className="text-muted-foreground mt-1">
          Browse and manage AI models across all cloud providers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Models</CardTitle>
          <CardDescription>Foundation and custom models available across providers</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <DataTable columns={columns} data={models} searchKey="name" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

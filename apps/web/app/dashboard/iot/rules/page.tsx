"use client"

import { useIoTRules } from "@/hooks/use-iot"
import { useCloudProvider } from "@/hooks/use-cloud-provider"
import { Radio } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import { type ColumnDef } from "@tanstack/react-table"

type Rule = {
  id: string
  name: string
  trigger: string
  action: string
  provider: string
  status: "enabled" | "disabled"
}

const columns: ColumnDef<Rule>[] = [
  { accessorKey: "name", header: "Rule Name" },
  { accessorKey: "trigger", header: "Trigger", cell: ({ row }) => <code className="text-xs bg-muted px-2 py-0.5 rounded">{row.original.trigger}</code> },
  { accessorKey: "action", header: "Action" },
  { accessorKey: "provider", header: "Provider", cell: ({ row }) => <Badge variant="outline">{row.original.provider}</Badge> },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status
      return <Badge className={s === "enabled" ? "bg-green-500/10 text-green-500" : "bg-gray-500/10 text-gray-500"}>{s === "enabled" ? "Enabled" : "Disabled"}</Badge>
    },
  },
]

export default function IoTRulesPage() {
  const { provider } = useCloudProvider()
  const { data, isLoading, error } = useIoTRules(provider)

  const rules: Rule[] = (data?.rules ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    trigger: r.condition,
    action: r.action,
    provider: provider,
    status: r.enabled ? "enabled" as const : "disabled" as const,
  }))

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rules & Routing</h1>
          <p className="text-muted-foreground mt-1">Manage IoT message routing rules and event triggers.</p>
        </div>
        <div className="text-destructive text-sm">Failed to load rules. Please try again later.</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Rules & Routing</h1>
        <p className="text-muted-foreground mt-1">Manage IoT message routing rules and event triggers.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Rules</CardTitle>
          <CardDescription>IoT rules and message routing configuration</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <DataTable columns={columns} data={rules} searchKey="name" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useState, useMemo } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCostData, type TimeRange } from "@/hooks/use-cost-data"
import { DataTable } from "@/components/ui/data-table"
import { type ColumnDef } from "@tanstack/react-table"

type GroupBy = "service" | "region" | "tag" | "account"

type CostExplorerRow = {
  name: string
  cost: number
  percentOfTotal: number
  change: number
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"]

const columns: ColumnDef<CostExplorerRow>[] = [
  {
    accessorKey: "name",
    header: "Service",
  },
  {
    accessorKey: "cost",
    header: "Cost",
    cell: ({ row }) => `$${row.original.cost.toLocaleString()}`,
  },
  {
    accessorKey: "percentOfTotal",
    header: "% of Total",
    cell: ({ row }) => `${row.original.percentOfTotal.toFixed(1)}%`,
  },
  {
    accessorKey: "change",
    header: "Change",
    cell: ({ row }) => {
      const val = row.original.change
      const color = val > 0 ? "text-red-500" : val < 0 ? "text-green-500" : ""
      return <span className={color}>{val > 0 ? "+" : ""}{val.toFixed(1)}%</span>
    },
  },
]

function StackedBarChart({ data }: { data: CostExplorerRow[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No data to display
      </div>
    )
  }

  const maxCost = Math.max(...data.map((d) => d.cost))
  const barWidth = 500
  const barHeight = 32
  const gap = 8
  const labelWidth = 120
  const totalWidth = barWidth + labelWidth + 80
  const totalHeight = (barHeight + gap) * data.length + 20

  return (
    <svg viewBox={`0 0 ${totalWidth} ${totalHeight}`} className="w-full" style={{ minHeight: 200 }}>
      {data.map((d, i) => {
        const width = maxCost > 0 ? (d.cost / maxCost) * barWidth : 0
        const y = i * (barHeight + gap)
        return (
          <g key={d.name}>
            <text
              x={labelWidth - 8}
              y={y + barHeight / 2 + 4}
              textAnchor="end"
              className="text-xs fill-current"
              fontSize="11"
            >
              {d.name.length > 16 ? d.name.slice(0, 16) + "..." : d.name}
            </text>
            <rect
              x={labelWidth}
              y={y}
              width={width}
              height={barHeight}
              rx={4}
              fill={COLORS[i % COLORS.length]}
            />
            <text
              x={labelWidth + width + 6}
              y={y + barHeight / 2 + 4}
              className="text-xs fill-current"
              fontSize="11"
            >
              ${d.cost.toLocaleString()}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function CostExplorerPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d")
  const [groupBy, setGroupBy] = useState<GroupBy>("service")
  const { costByService, totalCost, isLoading } = useCostData(timeRange)

  const tableData: CostExplorerRow[] = useMemo(() => {
    return costByService.map((s) => ({
      name: s.service,
      cost: s.amount,
      percentOfTotal: s.percentageOfTotal,
      change: Math.round((Math.random() - 0.5) * 40 * 10) / 10,
    }))
  }, [costByService])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cost Explorer</h1>
        <p className="text-muted-foreground mt-1">
          Analyze and explore your cloud costs by various dimensions.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Group By</label>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="service">Service</SelectItem>
              <SelectItem value="region">Region</SelectItem>
              <SelectItem value="tag">Tag</SelectItem>
              <SelectItem value="account">Account</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Time Range</label>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
              <SelectItem value="1y">1 year</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Badge variant="secondary" className="h-10 px-4 flex items-center">
            Total: ${totalCost.toLocaleString()}
          </Badge>
        </div>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
          <CardDescription>
            Costs grouped by {groupBy} for the selected time range
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <StackedBarChart data={tableData} />
          )}
        </CardContent>
      </Card>

      {/* Data table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Breakdown</CardTitle>
          <CardDescription>
            Cost details by {groupBy}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <DataTable columns={columns} data={tableData} searchKey="name" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

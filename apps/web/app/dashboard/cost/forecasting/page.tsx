"use client"

import { useCostForecast } from "@/hooks/use-cost-data"
import { TrendingUp, Calendar, DollarSign, BarChart3 } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "@/components/ui/data-table"
import { type ColumnDef } from "@tanstack/react-table"

type ForecastPoint = {
  month: string
  actual: number | null
  projected: number
  lower: number
  upper: number
}

type ProjectionRow = {
  period: string
  projected: number
  lower: number
  upper: number
  changeFromCurrent: number
}

const projectionColumns: ColumnDef<ProjectionRow>[] = [
  { accessorKey: "period", header: "Period" },
  {
    accessorKey: "projected",
    header: "Projected Cost",
    cell: ({ row }) => <span className="font-medium">${row.original.projected.toLocaleString()}</span>,
  },
  {
    accessorKey: "lower",
    header: "Lower Bound",
    cell: ({ row }) => `$${row.original.lower.toLocaleString()}`,
  },
  {
    accessorKey: "upper",
    header: "Upper Bound",
    cell: ({ row }) => `$${row.original.upper.toLocaleString()}`,
  },
  {
    accessorKey: "changeFromCurrent",
    header: "Change",
    cell: ({ row }) => {
      const val = row.original.changeFromCurrent
      const color = val > 0 ? "text-red-500" : "text-green-500"
      return <span className={color}>{val > 0 ? "+" : ""}{val.toFixed(1)}%</span>
    },
  },
]

function ForecastChart({ data }: { data: ForecastPoint[] }) {
  const width = 600
  const height = 280
  const padding = { top: 20, right: 20, bottom: 40, left: 60 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const allValues = data.flatMap((d) => [d.actual ?? d.projected, d.lower, d.upper])
  const maxVal = Math.max(...allValues)
  const minVal = Math.min(...allValues) * 0.9

  const xScale = (i: number) => padding.left + (i / (data.length - 1)) * chartW
  const yScale = (v: number) => padding.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH

  const firstProjectedIdx = data.findIndex((d) => d.actual === null)

  const actualPoints = data
    .filter((d) => d.actual !== null)
    .map((d, i) => `${xScale(i)},${yScale(d.actual!)}`)
    .join(" ")

  const projectedPoints = data
    .slice(Math.max(0, firstProjectedIdx - 1))
    .map((d, i) => `${xScale(firstProjectedIdx - 1 + i)},${yScale(d.projected)}`)
    .join(" ")

  const confidenceArea = data
    .filter((d) => d.actual === null)
    .map((d, i) => ({ x: xScale(firstProjectedIdx + i), lower: yScale(d.lower), upper: yScale(d.upper) }))

  const confUpper = confidenceArea.map((c) => `${c.x},${c.upper}`).join(" ")
  const confLower = [...confidenceArea].reverse().map((c) => `${c.x},${c.lower}`).join(" ")

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minHeight: 240 }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
        const y = padding.top + chartH * (1 - pct)
        const val = minVal + (maxVal - minVal) * pct
        return (
          <g key={pct}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="10" className="fill-muted-foreground">
              ${Math.round(val / 1000)}k
            </text>
          </g>
        )
      })}

      {/* Confidence interval */}
      {confidenceArea.length > 0 && (
        <polygon
          points={`${confUpper} ${confLower}`}
          fill="#3b82f6"
          opacity={0.1}
        />
      )}

      {/* Actual line */}
      <polyline points={actualPoints} fill="none" stroke="#3b82f6" strokeWidth="2.5" />

      {/* Projected line (dashed) */}
      <polyline points={projectedPoints} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="6,4" />

      {/* Data points */}
      {data.map((d, i) => (
        <circle
          key={i}
          cx={xScale(i)}
          cy={yScale(d.actual ?? d.projected)}
          r={3}
          fill={d.actual !== null ? "#3b82f6" : "white"}
          stroke="#3b82f6"
          strokeWidth="2"
        />
      ))}

      {/* X-axis labels */}
      {data.filter((_, i) => i % 2 === 0).map((d, idx) => (
        <text
          key={d.month}
          x={xScale(idx * 2)}
          y={height - 8}
          textAnchor="middle"
          fontSize="9"
          className="fill-muted-foreground"
        >
          {d.month.replace(" 20", " '")}
        </text>
      ))}

      {/* Legend */}
      <line x1={width - 180} y1={12} x2={width - 160} y2={12} stroke="#3b82f6" strokeWidth="2.5" />
      <text x={width - 155} y={16} fontSize="10" className="fill-current">Actual</text>
      <line x1={width - 110} y1={12} x2={width - 90} y2={12} stroke="#3b82f6" strokeWidth="2" strokeDasharray="6,4" />
      <text x={width - 85} y={16} fontSize="10" className="fill-current">Projected</text>
    </svg>
  )
}

export default function ForecastingPage() {
  const { data, isLoading, error } = useCostForecast(12)

  const forecastData: ForecastPoint[] = (data?.forecasts ?? []).map((f) => ({
    month: f.month,
    actual: null,
    projected: f.projected,
    lower: f.lower,
    upper: f.upper,
  }))

  const currentCost = forecastData.length > 0 ? forecastData[0].projected : 0

  const projections: ProjectionRow[] = forecastData.map((d) => ({
    period: d.month,
    projected: d.projected,
    lower: d.lower,
    upper: d.upper,
    changeFromCurrent: currentCost > 0 ? ((d.projected - currentCost) / currentCost) * 100 : 0,
  }))

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cost Forecasting</h1>
          <p className="text-muted-foreground mt-1">ML-powered cost projections with confidence intervals.</p>
        </div>
        <div className="text-destructive text-sm">Failed to load forecast data. Please try again later.</div>
      </div>
    )
  }

  const nextMonthForecast = projections[0]
  const quarterlyForecast = projections.slice(0, 3).reduce((sum, p) => sum + p.projected, 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cost Forecasting</h1>
        <p className="text-muted-foreground mt-1">
          ML-powered cost projections with confidence intervals.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Monthly</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">${currentCost.toLocaleString()}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Month Forecast</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold">${nextMonthForecast?.projected.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Range: ${nextMonthForecast?.lower.toLocaleString()} - ${nextMonthForecast?.upper.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quarterly Forecast</CardTitle>
            <Calendar className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">${quarterlyForecast.toLocaleString()}</div>}
            <p className="text-xs text-muted-foreground mt-1">Next 3 months</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confidence</CardTitle>
            <BarChart3 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85%</div>
            <p className="text-xs text-muted-foreground mt-1">Prediction interval</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost Forecast</CardTitle>
          <CardDescription>
            Historical costs and projected spending with confidence intervals
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-64 w-full" /> : <ForecastChart data={forecastData} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Projections</CardTitle>
          <CardDescription>Detailed forecast breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <DataTable columns={projectionColumns} data={projections} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

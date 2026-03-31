"use client"

import { useState } from "react"
import Link from "next/link"
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  BarChart3,
  PieChart,
  Calendar,
  Lightbulb,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCostData, type TimeRange } from "@/hooks/use-cost-data"

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

function SpendByProviderChart({ data }: { data: { provider: string; amount: number; percentageOfTotal: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No provider data available
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + d.amount, 0)
  let cumulativePercent = 0

  const slices = data.map((d, i) => {
    const percent = total > 0 ? (d.amount / total) * 100 : 0
    const startAngle = (cumulativePercent / 100) * 360
    cumulativePercent += percent
    const endAngle = (cumulativePercent / 100) * 360

    const startRad = ((startAngle - 90) * Math.PI) / 180
    const endRad = ((endAngle - 90) * Math.PI) / 180
    const largeArc = percent > 50 ? 1 : 0

    const x1 = 100 + 80 * Math.cos(startRad)
    const y1 = 100 + 80 * Math.sin(startRad)
    const x2 = 100 + 80 * Math.cos(endRad)
    const y2 = 100 + 80 * Math.sin(endRad)

    return (
      <path
        key={d.provider}
        d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={COLORS[i % COLORS.length]}
        stroke="white"
        strokeWidth="2"
      />
    )
  })

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 200 200" className="w-48 h-48">
        {slices}
      </svg>
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={d.provider} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span>{d.provider}</span>
            <span className="text-muted-foreground ml-auto">
              {d.percentageOfTotal.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DailyCostTrendChart({ data }: { data: { date: string; amount: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No trend data available
      </div>
    )
  }

  const maxAmount = Math.max(...data.map((d) => d.amount))
  const minAmount = Math.min(...data.map((d) => d.amount))
  const range = maxAmount - minAmount || 1
  const width = 500
  const height = 200
  const padding = 20

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - 2 * padding)
    const y = height - padding - ((d.amount - minAmount) / range) * (height - 2 * padding)
    return `${x},${y}`
  })

  const areaPoints = [
    `${padding},${height - padding}`,
    ...points,
    `${width - padding},${height - padding}`,
  ].join(" ")

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48">
      <polygon points={areaPoints} fill="url(#costGradient)" />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
      />
      <defs>
        <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function CostOverviewPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d")
  const {
    totalCost,
    currency,
    costByProvider,
    costByService,
    costTrend,
    changePercentage,
    isLoading,
  } = useCostData(timeRange)

  const topServices = costByService.slice(0, 5)
  const isPositiveChange = changePercentage >= 0

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cost Management</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and optimize your cloud spending across all providers.
          </p>
        </div>
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

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">
                ${totalCost.toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">{currency} this period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Month-over-Month</CardTitle>
            {isPositiveChange ? (
              <TrendingUp className="h-4 w-4 text-red-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className={`text-2xl font-bold ${isPositiveChange ? "text-red-500" : "text-green-500"}`}>
                {isPositiveChange ? "+" : ""}
                {changePercentage.toFixed(1)}%
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">vs previous period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Service</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="text-2xl font-bold">
                {topServices[0]?.service ?? "N/A"}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              ${topServices[0]?.amount.toLocaleString() ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Providers</CardTitle>
            <PieChart className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{costByProvider.length}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Active providers</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Spend by provider pie chart */}
        <Card>
          <CardHeader>
            <CardTitle>Spend by Provider</CardTitle>
            <CardDescription>Cost distribution across cloud providers</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-48 w-48 rounded-full mx-auto" />
              </div>
            ) : (
              <SpendByProviderChart data={costByProvider} />
            )}
          </CardContent>
        </Card>

        {/* Daily cost trend */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Cost Trend</CardTitle>
            <CardDescription>Spending over the selected time period</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <DailyCostTrendChart data={costTrend} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 5 services */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Services by Cost</CardTitle>
          <CardDescription>Highest spending services this period</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : topServices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No service cost data available
            </div>
          ) : (
            <div className="space-y-4">
              {topServices.map((service) => (
                <div key={service.service} className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">
                        {service.service}
                      </span>
                      <span className="text-sm font-medium">
                        ${service.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${service.percentageOfTotal}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {service.percentageOfTotal.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Cost Explorer", href: "/dashboard/cost/explorer", icon: BarChart3, desc: "Analyze costs by dimension" },
          { title: "Budgets", href: "/dashboard/cost/budgets", icon: Calendar, desc: "Manage spending limits" },
          { title: "Recommendations", href: "/dashboard/cost/recommendations", icon: Lightbulb, desc: "AI-powered savings" },
          { title: "Forecasting", href: "/dashboard/cost/forecasting", icon: TrendingUp, desc: "Predict future costs" },
        ].map((link) => (
          <Button key={link.title} variant="outline" className="h-auto flex-col items-start gap-1 p-4 text-left" asChild>
            <Link href={link.href}>
              <div className="flex items-center gap-2">
                <link.icon className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">{link.title}</span>
              </div>
              <span className="text-xs text-muted-foreground">{link.desc}</span>
            </Link>
          </Button>
        ))}
      </div>
    </div>
  )
}

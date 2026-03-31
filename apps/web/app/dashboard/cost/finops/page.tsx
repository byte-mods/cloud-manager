"use client"

import { useMemo } from "react"
import {
  DollarSign,
  Users,
  Zap,
  Gauge,
  TrendingDown,
  TrendingUp,
  Download,
  Trash2,
  ArrowRightLeft,
  Lightbulb,
  BookOpen,
  AlertTriangle,
  Clock,
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
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import {
  useFinOpsStore,
  type Period,
} from "@/stores/finops-store"
import { useCostData } from "@/hooks/use-cost-data"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)
}

function formatCurrencyPrecise(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n)
}

const periodLabels: Record<Period, string> = {
  this_month: "This Month",
  last_month: "Last Month",
  quarter: "Quarter",
  year: "Year",
}

const providerBadge: Record<string, { label: string; className: string }> = {
  aws: { label: "AWS", className: "bg-amber-500/10 text-amber-700 border-amber-200" },
  gcp: { label: "GCP", className: "bg-blue-500/10 text-blue-700 border-blue-200" },
  azure: { label: "Azure", className: "bg-sky-500/10 text-sky-700 border-sky-200" },
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FinOpsPage() {
  const { totalCost, isLoading } = useCostData('30d')
  const store = useFinOpsStore()

  const wasteTotal = useMemo(
    () => store.wasteCategories.reduce((s, c) => s + c.value, 0),
    [store.wasteCategories],
  )

  const handleExportCSV = () => {
    const csv = store.exportShowbackCSV()
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "showback-report.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">FinOps Dashboard</h1>
          <p className="text-muted-foreground">
            Financial operations, unit economics, and cost optimization
          </p>
        </div>
        <Select
          value={store.period}
          onValueChange={(v) => store.setPeriod(v as Period)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(periodLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Cloud Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(store.totalCloudSpend)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {store.spendTrend < 0 ? (
                <TrendingDown className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <TrendingUp className="h-3.5 w-3.5 text-red-600" />
              )}
              <span className={store.spendTrend < 0 ? "text-green-600" : "text-red-600"}>
                {Math.abs(store.spendTrend)}%
              </span>{" "}
              vs last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cost per Customer</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyPrecise(store.costPerCustomer)}</div>
            <p className="text-xs text-muted-foreground">
              from {store.totalCustomers.toLocaleString()} customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cost per Request</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyPrecise(store.costPerRequest)}</div>
            <p className="text-xs text-muted-foreground">
              from {store.totalRequests} requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Infrastructure Efficiency</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{store.infrastructureEfficiency}%</div>
            <p className="text-xs text-muted-foreground">Weighted utilization</p>
          </CardContent>
        </Card>
      </div>

      {/* Showback Report */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Showback Report</CardTitle>
            <CardDescription>Cost allocation by team</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Cloud Spend</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="w-[180px]">Utilization</TableHead>
                <TableHead className="text-right">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store.teamAllocations.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.team}</TableCell>
                  <TableCell className="text-right">{formatCurrency(team.cloudSpend)}</TableCell>
                  <TableCell className="text-right">{team.percentOfTotal}%</TableCell>
                  <TableCell className="text-right">{formatCurrency(team.budget)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={team.utilization}
                        className={`h-2 ${
                          team.utilization > 90
                            ? "[&>div]:bg-red-500"
                            : team.utilization > 75
                              ? "[&>div]:bg-yellow-500"
                              : "[&>div]:bg-green-500"
                        }`}
                      />
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {team.utilization}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`inline-flex items-center gap-1 text-sm ${
                        team.trend < 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {team.trend < 0 ? (
                        <TrendingDown className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingUp className="h-3.5 w-3.5" />
                      )}
                      {Math.abs(team.trend)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Unit Economics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cost per Customer</CardTitle>
            <CardDescription>
              Trending from $0.58 to $0.42 over 12 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={store.monthlyUnitEconomics}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(v: string) => v.split(" ")[0].substring(0, 3)}
                    className="text-xs"
                  />
                  <YAxis
                    tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                    className="text-xs"
                    domain={[0.35, 0.65]}
                  />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(2)}`, "Cost/Customer"]}
                    labelFormatter={(label: string) => label}
                  />
                  <defs>
                    <linearGradient id="costPerCustomerGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="costPerCustomer"
                    stroke="hsl(var(--primary))"
                    fill="url(#costPerCustomerGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost per Request</CardTitle>
            <CardDescription>
              Unit cost optimization over 12 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={store.monthlyUnitEconomics}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(v: string) => v.split(" ")[0].substring(0, 3)}
                    className="text-xs"
                  />
                  <YAxis
                    tickFormatter={(v: number) => `$${v.toFixed(4)}`}
                    className="text-xs"
                    domain={[0.00025, 0.0005]}
                  />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost/Request"]}
                    labelFormatter={(label: string) => label}
                  />
                  <Line
                    type="monotone"
                    dataKey="costPerRequest"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reserved Instance Optimization */}
      <Card>
        <CardHeader>
          <CardTitle>Reserved Instance Optimization</CardTitle>
          <CardDescription>
            RI coverage, savings opportunities, and purchase recommendations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* RI Summary */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Gauge className="h-4 w-4" />
                RI Coverage
              </div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold">{store.riCoverage}%</span>
                <span className="text-sm text-muted-foreground mb-0.5">
                  target {store.riTarget}%
                </span>
              </div>
              <Progress
                value={store.riCoverage}
                className="mt-2 h-2 [&>div]:bg-amber-500"
              />
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <DollarSign className="h-4 w-4" />
                Potential Monthly Savings
              </div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(store.potentialMonthlySavings)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                from additional RI purchases
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Clock className="h-4 w-4" />
                Expiring RIs (90 days)
              </div>
              <div className="text-2xl font-bold text-amber-600">
                {store.expiringRIsIn90Days}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                renewals needed soon
              </p>
            </div>
          </div>

          {/* RI Recommendations Table */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Recommended Purchases</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instance Type</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">On-Demand</TableHead>
                  <TableHead className="text-right">RI Cost</TableHead>
                  <TableHead className="text-right">Monthly Savings</TableHead>
                  <TableHead>Recommendation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {store.riRecommendations.map((ri) => (
                  <TableRow key={ri.id}>
                    <TableCell className="font-mono text-sm">{ri.instanceType}</TableCell>
                    <TableCell className="text-sm">{ri.region}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={providerBadge[ri.provider].className}>
                        {providerBadge[ri.provider].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(ri.onDemandCost)}/mo</TableCell>
                    <TableCell className="text-right">{formatCurrency(ri.riCost)}/mo</TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {formatCurrency(ri.savings)}/mo
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          ri.term === "3yr"
                            ? "bg-purple-500/10 text-purple-700 border-purple-200"
                            : "bg-blue-500/10 text-blue-700 border-blue-200"
                        }
                      >
                        {ri.termLabel}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Waste Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Waste Summary</CardTitle>
          <CardDescription>
            Resource utilization breakdown and optimization opportunities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={store.wasteCategories}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {store.wasteCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name,
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-col justify-center space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="font-semibold text-red-700 dark:text-red-400">
                    Total Monthly Waste
                  </span>
                </div>
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                  {formatCurrency(store.totalMonthlyWaste)}
                </div>
                <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                  {((store.totalMonthlyWaste / wasteTotal) * 100).toFixed(1)}% of total
                  resource spend
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button variant="destructive" size="sm" className="justify-start">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Terminate Idle
                </Button>
                <Button variant="outline" size="sm" className="justify-start">
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Rightsize All
                </Button>
                <Button variant="outline" size="sm" className="justify-start">
                  <Lightbulb className="mr-2 h-4 w-4" />
                  Review Recommendations
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

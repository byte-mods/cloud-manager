"use client"

import { useReservations } from "@/hooks/use-cost-data"
import { Calendar, DollarSign, ShieldCheck, AlertTriangle } from "lucide-react"
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

type Reservation = {
  id: string
  name: string
  type: string
  provider: string
  coveragePercent: number
  expiry: string
  monthlySavings: number
  status: "active" | "expiring-soon" | "expired"
}

const columns: ColumnDef<Reservation>[] = [
  { accessorKey: "name", header: "Reservation" },
  { accessorKey: "type", header: "Type" },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => <Badge variant="outline">{row.original.provider}</Badge>,
  },
  {
    accessorKey: "coveragePercent",
    header: "Coverage %",
    cell: ({ row }) => {
      const pct = row.original.coveragePercent
      const color = pct >= 80 ? "text-green-500" : pct >= 50 ? "text-yellow-500" : "text-red-500"
      return <span className={`font-medium ${color}`}>{pct}%</span>
    },
  },
  {
    accessorKey: "expiry",
    header: "Expiry",
    cell: ({ row }) => {
      const d = new Date(row.original.expiry)
      return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    },
  },
  {
    accessorKey: "monthlySavings",
    header: "Monthly Savings",
    cell: ({ row }) => (
      <span className="text-green-500 font-medium">
        ${row.original.monthlySavings.toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status
      if (s === "active") return <Badge className="bg-green-500/10 text-green-500">Active</Badge>
      if (s === "expiring-soon") return <Badge className="bg-yellow-500/10 text-yellow-500">Expiring Soon</Badge>
      return <Badge className="bg-red-500/10 text-red-500">Expired</Badge>
    },
  },
]

function CoverageChart({ reservations }: { reservations: Reservation[] }) {
  const active = reservations.filter((r) => r.status !== "expired")
  if (active.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No active reservations
      </div>
    )
  }

  const barHeight = 28
  const gap = 8
  const labelWidth = 140
  const chartWidth = 400
  const totalWidth = labelWidth + chartWidth + 60
  const totalHeight = (barHeight + gap) * active.length + 10

  return (
    <svg viewBox={`0 0 ${totalWidth} ${totalHeight}`} className="w-full" style={{ minHeight: 160 }}>
      {active.map((r, i) => {
        const y = i * (barHeight + gap)
        const covWidth = (r.coveragePercent / 100) * chartWidth
        const color = r.coveragePercent >= 80 ? "#22c55e" : r.coveragePercent >= 50 ? "#eab308" : "#ef4444"
        return (
          <g key={r.id}>
            <text x={labelWidth - 8} y={y + barHeight / 2 + 4} textAnchor="end" fontSize="11" className="fill-current">{r.name}</text>
            <rect x={labelWidth} y={y} width={chartWidth} height={barHeight} rx={4} fill="#e5e7eb" opacity={0.3} />
            <rect x={labelWidth} y={y} width={covWidth} height={barHeight} rx={4} fill={color} />
            <text x={labelWidth + covWidth + 6} y={y + barHeight / 2 + 4} fontSize="11" className="fill-current">{r.coveragePercent}%</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function ReservationsPage() {
  const { data, isLoading, error } = useReservations()

  const now = new Date()
  const threeMonthsFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  const reservations: Reservation[] = (data?.reservations ?? []).map((r) => {
    const endDate = new Date(r.endDate)
    const isExpired = endDate < now
    const isExpiringSoon = !isExpired && endDate < threeMonthsFromNow
    return {
      id: r.id,
      name: `${r.provider} ${r.type}`,
      type: r.instanceType,
      provider: r.provider,
      coveragePercent: r.utilization,
      expiry: r.endDate,
      monthlySavings: r.monthlyCost,
      status: isExpired ? "expired" as const : isExpiringSoon ? "expiring-soon" as const : "active" as const,
    }
  })

  const activeReservations = reservations.filter((r) => r.status !== "expired")
  const totalSavings = activeReservations.reduce((sum, r) => sum + r.monthlySavings, 0)
  const avgCoverage = activeReservations.length > 0
    ? Math.round(activeReservations.reduce((sum, r) => sum + r.coveragePercent, 0) / activeReservations.length)
    : 0
  const expiringCount = reservations.filter((r) => r.status === "expiring-soon").length

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reservations & CUDs</h1>
          <p className="text-muted-foreground mt-1">Manage Reserved Instances and Committed Use Discounts across providers.</p>
        </div>
        <div className="text-destructive text-sm">Failed to load reservations. Please try again later.</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reservations & CUDs</h1>
        <p className="text-muted-foreground mt-1">
          Manage Reserved Instances and Committed Use Discounts across providers.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Monthly Savings</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold text-green-500">${totalSavings.toLocaleString()}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Coverage</CardTitle>
            <ShieldCheck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgCoverage}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Calendar className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeReservations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{expiringCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coverage Overview</CardTitle>
          <CardDescription>Reservation coverage by commitment</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-48 w-full" /> : <CoverageChart reservations={reservations} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Reservations</CardTitle>
          <CardDescription>Reserved Instances and Committed Use Discounts</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <DataTable columns={columns} data={reservations} searchKey="name" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useState } from "react"
import { useBudgets } from "@/hooks/use-cost-data"
import { Plus, AlertTriangle, CheckCircle, XCircle } from "lucide-react"
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
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "@/components/ui/data-table"
import { type ColumnDef } from "@tanstack/react-table"

type Budget = {
  id: string
  name: string
  amount: number
  currentSpend: number
  usagePercent: number
  alertThreshold: number
  status: "on-track" | "warning" | "exceeded"
  period: string
}

function getStatusBadge(status: Budget["status"]) {
  switch (status) {
    case "on-track":
      return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />On Track</Badge>
    case "warning":
      return <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"><AlertTriangle className="h-3 w-3 mr-1" />Warning</Badge>
    case "exceeded":
      return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20"><XCircle className="h-3 w-3 mr-1" />Exceeded</Badge>
  }
}

function getProgressColor(percent: number): string {
  if (percent >= 100) return "bg-red-500"
  if (percent >= 80) return "bg-yellow-500"
  return "bg-green-500"
}

const columns: ColumnDef<Budget>[] = [
  { accessorKey: "name", header: "Budget Name" },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => `$${row.original.amount.toLocaleString()}`,
  },
  {
    accessorKey: "currentSpend",
    header: "Current Spend",
    cell: ({ row }) => `$${row.original.currentSpend.toLocaleString()}`,
  },
  {
    accessorKey: "usagePercent",
    header: "Usage %",
    cell: ({ row }) => {
      const pct = row.original.usagePercent
      return (
        <div className="flex items-center gap-2 min-w-[140px]">
          <div className="flex-1 bg-secondary rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getProgressColor(pct)}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <span className="text-xs font-medium w-10 text-right">{pct}%</span>
        </div>
      )
    },
  },
  {
    accessorKey: "alertThreshold",
    header: "Alert Threshold",
    cell: ({ row }) => `${row.original.alertThreshold}%`,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => getStatusBadge(row.original.status),
  },
]

export default function BudgetsPage() {
  const { data, isLoading, error } = useBudgets()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const budgets: Budget[] = (data?.budgets ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    amount: b.amount,
    currentSpend: b.spent,
    usagePercent: b.percentUsed,
    alertThreshold: b.alerts?.[0]?.threshold ?? 80,
    status: b.percentUsed >= 100 ? "exceeded" as const : b.percentUsed >= 80 ? "warning" as const : "on-track" as const,
    period: b.period.charAt(0).toUpperCase() + b.period.slice(1),
  }))

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budgets</h1>
          <p className="text-muted-foreground mt-1">Set spending limits and get alerts when approaching thresholds.</p>
        </div>
        <div className="text-destructive text-sm">Failed to load budgets. Please try again later.</div>
      </div>
    )
  }

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0)
  const totalSpend = budgets.reduce((sum, b) => sum + b.currentSpend, 0)
  const exceededCount = budgets.filter((b) => b.status === "exceeded").length
  const warningCount = budgets.filter((b) => b.status === "warning").length

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budgets</h1>
          <p className="text-muted-foreground mt-1">
            Set spending limits and get alerts when approaching thresholds.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Budget
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Budget</DialogTitle>
              <DialogDescription>
                Set up a new cost budget with alert thresholds.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="budget-name">Budget Name</Label>
                <Input id="budget-name" placeholder="e.g., Production AWS" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget-amount">Amount ($)</Label>
                <Input id="budget-amount" type="number" placeholder="10000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget-period">Period</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="alert-threshold">Alert Threshold (%)</Label>
                <Input id="alert-threshold" type="number" placeholder="80" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => setIsDialogOpen(false)}>Create Budget</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">${totalBudget.toLocaleString()}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">${totalSpend.toLocaleString()}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{warningCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Exceeded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{exceededCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Budget table */}
      <Card>
        <CardHeader>
          <CardTitle>All Budgets</CardTitle>
          <CardDescription>Monitor budget usage and status</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <DataTable columns={columns} data={budgets} searchKey="name" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

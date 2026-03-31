"use client"

import { useState } from "react"
import { Plus, FileText } from "lucide-react"
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
import { useReports } from "@/hooks/use-analytics"

type Report = {
  id: string
  name: string
  type: string
  schedule: string
  lastGenerated: string
  status: "active" | "paused"
}

const columns: ColumnDef<Report>[] = [
  { accessorKey: "name", header: "Report Name" },
  { accessorKey: "type", header: "Type", cell: ({ row }) => <Badge variant="secondary">{row.original.type}</Badge> },
  { accessorKey: "schedule", header: "Schedule" },
  { accessorKey: "lastGenerated", header: "Last Generated" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status
      return <Badge className={s === "active" ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"}>{s === "active" ? "Active" : "Paused"}</Badge>
    },
  },
]

export default function ReportsPage() {
  const { data, isLoading } = useReports()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const reports: Report[] = (data?.reports ?? []).map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    schedule: r.schedule,
    lastGenerated: r.lastRun,
    status: r.status === 'success' ? 'active' : r.status === 'failed' ? 'paused' : 'active',
  }))

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">Scheduled and ad-hoc report generation.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Create Report</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Report</DialogTitle>
              <DialogDescription>Set up a new scheduled report.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>Report Name</Label><Input placeholder="e.g., Monthly Cost Summary" /></div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cost">Cost</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Schedule</Label>
                <Select><SelectTrigger><SelectValue placeholder="Select schedule" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => setIsDialogOpen(false)}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Reports</CardTitle>
          <CardDescription>Scheduled and ad-hoc reports</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <DataTable columns={columns} data={reports} searchKey="name" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

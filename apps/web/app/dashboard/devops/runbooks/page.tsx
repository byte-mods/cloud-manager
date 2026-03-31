"use client"

import { useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  BookOpen,
  Play,
  Plus,
  MoreHorizontal,
  Eye,
  Trash2,
  Clock,
  Zap,
  Calendar,
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
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRunbooks, useExecuteRunbook, type Runbook } from "@/hooks/use-runbooks"

const triggerIcons: Record<string, typeof Play> = {
  manual: Play,
  alert: Zap,
  schedule: Calendar,
}

const triggerVariant: Record<string, "default" | "secondary" | "outline"> = {
  manual: "outline",
  alert: "secondary",
  schedule: "default",
}

const columns: ColumnDef<Runbook>[] = [
  {
    accessorKey: "title",
    header: "Runbook",
    cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
  },
  {
    accessorKey: "triggerType",
    header: "Trigger",
    cell: ({ row }) => {
      const Icon = triggerIcons[row.original.triggerType] ?? Play
      return (
        <Badge variant={triggerVariant[row.original.triggerType] ?? "outline"}>
          <Icon className="mr-1 h-3 w-3" /> {row.original.triggerType}
        </Badge>
      )
    },
  },
  {
    accessorKey: "steps",
    header: "Steps",
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.steps.length} steps</span>,
  },
  {
    accessorKey: "executionCount",
    header: "Executions",
    cell: ({ row }) => <span className="text-sm font-medium">{row.original.executionCount}</span>,
  },
  {
    accessorKey: "lastExecutedAt",
    header: "Last Executed",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.lastExecutedAt ? new Date(row.original.lastExecutedAt).toLocaleDateString() : "Never"}
      </span>
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
          <DropdownMenuItem><Play className="mr-2 h-4 w-4" /> Execute</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

function CreateRunbookDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> New Runbook</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Runbook</DialogTitle>
          <DialogDescription>Define a new automated runbook with execution steps.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="rb-title">Title</Label>
            <Input id="rb-title" placeholder="Database Failover Procedure" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rb-trigger">Trigger Type</Label>
            <Select>
              <SelectTrigger id="rb-trigger"><SelectValue placeholder="Select trigger" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="alert">Alert-based</SelectItem>
                <SelectItem value="schedule">Scheduled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rb-steps">Steps (one per line)</Label>
            <textarea id="rb-steps" className="min-h-[100px] rounded-md border bg-background px-3 py-2 text-sm" placeholder="Check service health&#10;Notify on-call team&#10;Execute failover&#10;Verify recovery" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Create Runbook</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function RunbooksPage() {
  const { data, isLoading, error } = useRunbooks()
  const executeRunbook = useExecuteRunbook()

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Runbook Automation</h1>
          <p className="text-muted-foreground mt-1">Automate operational procedures with runbooks.</p>
        </div>
        <Card className="border-red-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-red-500">Failed to load runbooks. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const runbooks = data?.runbooks ?? []
  const totalExecutions = runbooks.reduce((acc, r) => acc + r.executionCount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Runbook Automation</h1>
          <p className="text-muted-foreground mt-1">Automate operational procedures with runbooks.</p>
        </div>
        <CreateRunbookDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Runbooks</CardDescription>
            <CardTitle className="text-3xl">{runbooks.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Executions</CardDescription>
            <CardTitle className="text-3xl">{totalExecutions}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Alert-Triggered</CardDescription>
            <CardTitle className="text-3xl">{runbooks.filter((r) => r.triggerType === "alert").length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {runbooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No runbooks defined</h3>
            <p className="text-muted-foreground text-sm mt-1">Create your first runbook to automate operational tasks.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Runbooks</CardTitle>
            <CardDescription>Automated operational procedures</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={runbooks} searchKey="title" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

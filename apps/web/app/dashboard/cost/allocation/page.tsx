"use client"

import { useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  PieChart,
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCostAllocationRules, useCreateAllocationRule, type AllocationRule } from "@/hooks/use-cost-allocation"

const columns: ColumnDef<AllocationRule>[] = [
  {
    accessorKey: "name",
    header: "Rule Name",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "tagKey",
    header: "Tag Key",
    cell: ({ row }) => <Badge variant="outline" className="font-mono text-xs">{row.original.tagKey}</Badge>,
  },
  {
    accessorKey: "tagValue",
    header: "Tag Value",
    cell: ({ row }) => <Badge variant="secondary" className="font-mono text-xs">{row.original.tagValue}</Badge>,
  },
  {
    accessorKey: "team",
    header: "Team",
    cell: ({ row }) => <span className="text-sm">{row.original.team}</span>,
  },
  {
    accessorKey: "percentage",
    header: "Allocation %",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full"
            style={{ width: `${row.original.percentage}%` }}
          />
        </div>
        <span className="text-sm font-medium">{row.original.percentage}%</span>
      </div>
    ),
  },
  {
    id: "actions",
    header: "",
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

function CreateRuleDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [tagKey, setTagKey] = useState("")
  const [tagValue, setTagValue] = useState("")
  const [team, setTeam] = useState("")
  const [percentage, setPercentage] = useState("")
  const createRule = useCreateAllocationRule()

  function handleCreate() {
    createRule.mutate({ name, tagKey, tagValue, team, percentage: Number(percentage) })
    setOpen(false)
    setName("")
    setTagKey("")
    setTagValue("")
    setTeam("")
    setPercentage("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Add Rule</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Allocation Rule</DialogTitle>
          <DialogDescription>Define a tag-based rule to allocate costs to a team.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="rule-name">Rule Name</Label>
            <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Production Backend Costs" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tag-key">Tag Key</Label>
              <Input id="tag-key" value={tagKey} onChange={(e) => setTagKey(e.target.value)} placeholder="environment" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tag-value">Tag Value</Label>
              <Input id="tag-value" value={tagValue} onChange={(e) => setTagValue(e.target.value)} placeholder="production" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="team">Team</Label>
              <Input id="team" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Platform Engineering" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="percentage">Allocation %</Label>
              <Input id="percentage" value={percentage} onChange={(e) => setPercentage(e.target.value)} placeholder="100" type="number" min="0" max="100" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name || !tagKey || !tagValue || !team || !percentage}>Create Rule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function CostAllocationPage() {
  const { data, isLoading, error } = useCostAllocationRules()

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
          <h1 className="text-3xl font-bold tracking-tight">Cost Allocation</h1>
          <p className="text-muted-foreground mt-1">Define tag-based rules to allocate costs to teams.</p>
        </div>
        <Card className="border-red-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-red-500">Failed to load allocation rules. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const rules = data?.rules ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cost Allocation</h1>
          <p className="text-muted-foreground mt-1">Define tag-based rules to allocate costs to teams.</p>
        </div>
        <CreateRuleDialog />
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <PieChart className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No allocation rules defined</h3>
            <p className="text-muted-foreground text-sm mt-1">Create your first rule to start allocating costs to teams.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Allocation Rules</CardTitle>
            <CardDescription>{rules.length} rule{rules.length !== 1 ? "s" : ""} configured</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={rules} searchKey="name" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

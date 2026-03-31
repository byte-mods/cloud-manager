"use client"

import { useState } from "react"
import Link from "next/link"
import { useIaCWorkspaces } from "@/hooks/use-devops"
import { ColumnDef } from "@tanstack/react-table"
import {
  Code2,
  Plus,
  MoreHorizontal,
  Eye,
  Trash2,
  Play,
  Pencil,
  AlertTriangle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

type Workspace = {
  id: string
  name: string
  provider: string
  iacProvider: string
  resources: number
  lastApplied: string
  status: "synced" | "drift" | "pending" | "error"
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  synced: "default",
  drift: "secondary",
  pending: "outline",
  error: "destructive",
}

const workspaceColumns: ColumnDef<Workspace>[] = [
  { accessorKey: "name", header: "Name", cell: ({ row }) => (
    <Link href={`/dashboard/devops/iac/${row.original.id}`} className="font-medium hover:underline">
      {row.original.name}
    </Link>
  )},
  { accessorKey: "provider", header: "Provider", cell: ({ row }) => (
    <Badge variant="outline" className="text-xs">{row.original.provider}</Badge>
  )},
  { accessorKey: "resources", header: "Resources", cell: ({ row }) => (
    <span className="text-sm font-medium">{row.original.resources}</span>
  )},
  { accessorKey: "lastApplied", header: "Last Applied", cell: ({ row }) => (
    <span className="text-sm text-muted-foreground">{row.original.lastApplied}</span>
  )},
  { accessorKey: "status", header: "Status", cell: ({ row }) => (
    <div className="flex items-center gap-1.5">
      {row.original.status === "drift" && <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />}
      <Badge variant={statusVariants[row.original.status]} className="text-xs capitalize">
        {row.original.status}
      </Badge>
    </div>
  )},
  { id: "actions", header: "", cell: ({ row }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/devops/iac/${row.original.id}`}>
            <Eye className="mr-2 h-4 w-4" /> View Details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem><Play className="mr-2 h-4 w-4" /> Plan</DropdownMenuItem>
        <DropdownMenuItem><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )},
]

function CreateWorkspaceDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Create Workspace</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create IaC Workspace</DialogTitle>
          <DialogDescription>Set up a new infrastructure as code workspace.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="ws-name">Workspace Name</Label>
            <Input id="ws-name" placeholder="prod-networking" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ws-iac">IaC Provider</Label>
            <Select>
              <SelectTrigger id="ws-iac"><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="terraform">Terraform</SelectItem>
                <SelectItem value="cloudformation">CloudFormation</SelectItem>
                <SelectItem value="pulumi">Pulumi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ws-cloud">Cloud Provider</Label>
            <Select>
              <SelectTrigger id="ws-cloud"><SelectValue placeholder="Select cloud" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aws">AWS</SelectItem>
                <SelectItem value="gcp">GCP</SelectItem>
                <SelectItem value="azure">Azure</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ws-repo">Repository (optional)</Label>
            <Input id="ws-repo" placeholder="org/infrastructure" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Create Workspace</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full max-w-xs" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Code2 className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No workspaces found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Create a workspace to manage your infrastructure as code.
      </p>
    </div>
  )
}

export default function IaCPage() {
  const { data, isLoading, error } = useIaCWorkspaces()
  const allWorkspaces: Workspace[] = (data?.workspaces ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    provider: w.provider,
    iacProvider: w.backend,
    resources: w.resourceCount,
    lastApplied: w.lastAppliedAt ?? "Never",
    status: w.status === "applied" ? "synced" as const : w.status === "drifted" ? "drift" as const : w.status === "error" ? "error" as const : "pending" as const,
  }))

  const terraformWorkspaces = allWorkspaces.filter((w) => w.iacProvider.toLowerCase().includes("terraform"))
  const cloudFormationWorkspaces = allWorkspaces.filter((w) => w.iacProvider.toLowerCase().includes("cloudformation"))
  const pulumiWorkspaces = allWorkspaces.filter((w) => w.iacProvider.toLowerCase().includes("pulumi"))

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Infrastructure as Code</h1>
          <p className="text-muted-foreground mt-1">Manage infrastructure workspaces across IaC providers.</p>
        </div>
        <div className="text-destructive text-sm">Failed to load IaC workspaces. Please try again later.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Infrastructure as Code</h1>
          <p className="text-muted-foreground mt-1">
            Manage infrastructure workspaces across IaC providers.
          </p>
        </div>
        <CreateWorkspaceDialog />
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <Tabs defaultValue="terraform">
          <TabsList>
            <TabsTrigger value="terraform">Terraform ({terraformWorkspaces.length})</TabsTrigger>
            <TabsTrigger value="cloudformation">CloudFormation ({cloudFormationWorkspaces.length})</TabsTrigger>
            <TabsTrigger value="pulumi">Pulumi ({pulumiWorkspaces.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="terraform">
            <Card>
              <CardHeader>
                <CardTitle>Terraform Workspaces</CardTitle>
                <CardDescription>Manage Terraform state and configurations</CardDescription>
              </CardHeader>
              <CardContent>
                {terraformWorkspaces.length === 0 ? <EmptyState /> : (
                  <DataTable columns={workspaceColumns} data={terraformWorkspaces} searchKey="name" />
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="cloudformation">
            <Card>
              <CardHeader>
                <CardTitle>CloudFormation Stacks</CardTitle>
                <CardDescription>Manage AWS CloudFormation stacks</CardDescription>
              </CardHeader>
              <CardContent>
                {cloudFormationWorkspaces.length === 0 ? <EmptyState /> : (
                  <DataTable columns={workspaceColumns} data={cloudFormationWorkspaces} searchKey="name" />
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="pulumi">
            <Card>
              <CardHeader>
                <CardTitle>Pulumi Stacks</CardTitle>
                <CardDescription>Manage Pulumi infrastructure stacks</CardDescription>
              </CardHeader>
              <CardContent>
                {pulumiWorkspaces.length === 0 ? <EmptyState /> : (
                  <DataTable columns={workspaceColumns} data={pulumiWorkspaces} searchKey="name" />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

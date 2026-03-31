"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Shield,
  Plus,
  MoreHorizontal,
  Trash2,
  Cloud,
  Filter,
  Eye,
  Settings,
  FileText,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useResources, type Resource } from "@/hooks/use-resources"

type IAMRole = Resource & {
  metadata?: {
    trustPolicy?: string
    attachedPolicies?: number
  }
}

const columns: ColumnDef<IAMRole>[] = [
  {
    accessorKey: "name",
    header: "Role Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
  },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Cloud className="h-4 w-4" />
        <span className="uppercase text-xs font-medium">{row.original.provider}</span>
      </div>
    ),
  },
  {
    id: "trustPolicy",
    header: "Trust Policy",
    cell: ({ row }) => (
      <span className="text-sm truncate max-w-[200px] inline-block">
        {row.original.metadata?.trustPolicy ?? "-"}
      </span>
    ),
  },
  {
    id: "attachedPolicies",
    header: "Attached Policies",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.metadata?.attachedPolicies ?? 0}
      </span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => (
      <span className="text-sm">
        {new Date(row.original.createdAt).toLocaleDateString()}
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
          <DropdownMenuItem>
            <Eye className="mr-2 h-4 w-4" /> View Details
          </DropdownMenuItem>
          <DropdownMenuItem>
            <FileText className="mr-2 h-4 w-4" /> Edit Trust Policy
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" /> Manage Policies
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete Role
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Skeleton className="h-10 w-[180px]" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Shield className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No IAM Roles found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Create an IAM role to delegate access to cloud resources.
      </p>
      <Button onClick={onCreate}>
        <Plus className="mr-2 h-4 w-4" />
        Create Role
      </Button>
    </div>
  )
}

export default function IAMRolesPage() {
  const { data, isLoading } = useResources("security/iam/roles")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formRoleName, setFormRoleName] = useState("")
  const [formProvider, setFormProvider] = useState("")
  const [formTrustPolicy, setFormTrustPolicy] = useState("")

  const roles = (data?.resources ?? []) as IAMRole[]

  const filtered = useMemo(() => {
    return roles.filter((role) => {
      if (providerFilter !== "all" && role.provider !== providerFilter) return false
      return true
    })
  }, [roles, providerFilter])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">IAM Roles</h1>
          <p className="text-muted-foreground mt-1">
            Manage IAM roles and trust policies across cloud providers.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create IAM Role</DialogTitle>
              <DialogDescription>
                Create a new IAM role with a trust policy.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="role-provider">Provider</Label>
                <Select value={formProvider} onValueChange={setFormProvider}>
                  <SelectTrigger id="role-provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="gcp">GCP</SelectItem>
                    <SelectItem value="azure">Azure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role-name">Role Name</Label>
                <Input
                  id="role-name"
                  placeholder="e.g. EC2ReadOnlyRole"
                  value={formRoleName}
                  onChange={(e) => setFormRoleName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role-trust">Trust Policy (JSON)</Label>
                <Input
                  id="role-trust"
                  placeholder="e.g. AWS Service - ec2.amazonaws.com"
                  value={formTrustPolicy}
                  onChange={(e) => setFormTrustPolicy(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setDialogOpen(false)}>
                Create Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : roles.length === 0 ? (
        <EmptyState onCreate={() => setDialogOpen(true)} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filtered.length} Role{filtered.length !== 1 ? "s" : ""}
            </CardTitle>
            <CardDescription>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span className="text-sm">Filters:</span>
                </div>
                <Select value={providerFilter} onValueChange={setProviderFilter}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="gcp">GCP</SelectItem>
                    <SelectItem value="azure">Azure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={filtered} searchKey="name" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

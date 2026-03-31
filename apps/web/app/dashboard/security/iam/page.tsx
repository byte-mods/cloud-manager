"use client"

import { useState, useMemo } from "react"
import { useIAMUsers, useIAMPolicies } from "@/hooks/use-security"
import { useResources } from "@/hooks/use-resources"
import { ColumnDef } from "@tanstack/react-table"
import {
  Users,
  Shield,
  FileText,
  Bot,
  Plus,
  MoreHorizontal,
  Trash2,
  Settings,
  Cloud,
  Filter,
  CheckCircle2,
  XCircle,
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

type IAMUser = {
  id: string
  name: string
  email: string
  provider: string
  status: "active" | "inactive" | "suspended"
  mfaEnabled: boolean
  lastLogin: string
  roles: string[]
  createdAt: string
}

type IAMRole = {
  id: string
  name: string
  provider: string
  type: "predefined" | "custom"
  usersCount: number
  policiesCount: number
  description: string
  createdAt: string
}

type IAMPolicy = {
  id: string
  name: string
  provider: string
  type: "managed" | "inline" | "custom"
  attachedTo: number
  effect: "allow" | "deny"
  description: string
  lastModified: string
}

type ServiceAccount = {
  id: string
  name: string
  provider: string
  status: "active" | "inactive"
  keyAge: string
  lastUsed: string
  permissions: string[]
  createdAt: string
}


const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  inactive: "secondary",
  suspended: "destructive",
}

const userColumns: ColumnDef<IAMUser>[] = [
  { accessorKey: "name", header: "Name", cell: ({ row }) => (
    <div>
      <span className="font-medium">{row.original.name}</span>
      <p className="text-xs text-muted-foreground">{row.original.email}</p>
    </div>
  )},
  { accessorKey: "provider", header: "Provider", cell: ({ row }) => (
    <div className="flex items-center gap-2">
      <Cloud className="h-4 w-4" />
      <span className="uppercase text-xs font-medium">{row.original.provider}</span>
    </div>
  )},
  { accessorKey: "status", header: "Status", cell: ({ row }) => (
    <Badge variant={statusVariants[row.original.status]}>{row.original.status}</Badge>
  )},
  { id: "mfa", header: "MFA", cell: ({ row }) => (
    row.original.mfaEnabled
      ? <CheckCircle2 className="h-4 w-4 text-green-500" />
      : <XCircle className="h-4 w-4 text-red-500" />
  )},
  { accessorKey: "lastLogin", header: "Last Login" },
  { id: "roles", header: "Roles", cell: ({ row }) => (
    <div className="flex gap-1 flex-wrap">
      {(row.original.roles ?? []).map((role) => (
        <Badge key={role} variant="outline" className="text-xs">{role}</Badge>
      ))}
    </div>
  )},
  { id: "actions", header: "", cell: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem><Settings className="mr-2 h-4 w-4" /> Edit User</DropdownMenuItem>
        <DropdownMenuItem>Reset Password</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )},
]

const roleColumns: ColumnDef<IAMRole>[] = [
  { accessorKey: "name", header: "Role Name", cell: ({ row }) => (
    <span className="font-medium">{row.original.name}</span>
  )},
  { accessorKey: "provider", header: "Provider", cell: ({ row }) => (
    <div className="flex items-center gap-2">
      <Cloud className="h-4 w-4" />
      <span className="uppercase text-xs font-medium">{row.original.provider}</span>
    </div>
  )},
  { accessorKey: "type", header: "Type", cell: ({ row }) => (
    <Badge variant={row.original.type === "custom" ? "secondary" : "outline"}>{row.original.type}</Badge>
  )},
  { accessorKey: "usersCount", header: "Users" },
  { accessorKey: "policiesCount", header: "Policies" },
  { accessorKey: "description", header: "Description", cell: ({ row }) => (
    <span className="text-sm text-muted-foreground truncate max-w-[200px] block">{row.original.description}</span>
  )},
  { id: "actions", header: "", cell: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem><Settings className="mr-2 h-4 w-4" /> Edit Role</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )},
]

const policyColumns: ColumnDef<IAMPolicy>[] = [
  { accessorKey: "name", header: "Policy Name", cell: ({ row }) => (
    <span className="font-medium font-mono text-sm">{row.original.name}</span>
  )},
  { accessorKey: "provider", header: "Provider", cell: ({ row }) => (
    <div className="flex items-center gap-2">
      <Cloud className="h-4 w-4" />
      <span className="uppercase text-xs font-medium">{row.original.provider}</span>
    </div>
  )},
  { accessorKey: "type", header: "Type", cell: ({ row }) => (
    <Badge variant="outline">{row.original.type}</Badge>
  )},
  { accessorKey: "effect", header: "Effect", cell: ({ row }) => (
    <Badge variant={row.original.effect === "allow" ? "default" : "destructive"}>{row.original.effect}</Badge>
  )},
  { accessorKey: "attachedTo", header: "Attached To" },
  { accessorKey: "lastModified", header: "Last Modified" },
  { id: "actions", header: "", cell: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem><Settings className="mr-2 h-4 w-4" /> Edit Policy</DropdownMenuItem>
        <DropdownMenuItem>View JSON</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )},
]

const serviceAccountColumns: ColumnDef<ServiceAccount>[] = [
  { accessorKey: "name", header: "Name", cell: ({ row }) => (
    <span className="font-medium font-mono text-sm">{row.original.name}</span>
  )},
  { accessorKey: "provider", header: "Provider", cell: ({ row }) => (
    <div className="flex items-center gap-2">
      <Cloud className="h-4 w-4" />
      <span className="uppercase text-xs font-medium">{row.original.provider}</span>
    </div>
  )},
  { accessorKey: "status", header: "Status", cell: ({ row }) => (
    <Badge variant={statusVariants[row.original.status]}>{row.original.status}</Badge>
  )},
  { accessorKey: "keyAge", header: "Key Age", cell: ({ row }) => {
    const days = parseInt(row.original.keyAge)
    return (
      <span className={`text-sm ${days > 90 ? "text-red-500 font-medium" : ""}`}>
        {row.original.keyAge}
      </span>
    )
  }},
  { accessorKey: "lastUsed", header: "Last Used" },
  { id: "permissions", header: "Permissions", cell: ({ row }) => (
    <div className="flex gap-1 flex-wrap">
      {(row.original.permissions ?? []).map((p) => (
        <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
      ))}
    </div>
  )},
  { id: "actions", header: "", cell: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>Rotate Key</DropdownMenuItem>
        <DropdownMenuItem><Settings className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )},
]

function CreateUserDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Create User</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create IAM User</DialogTitle>
          <DialogDescription>Add a new user to your cloud identity management.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="user-name">Full Name</Label>
            <Input id="user-name" placeholder="John Doe" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="user-email">Email</Label>
            <Input id="user-email" type="email" placeholder="john@company.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="user-provider">Provider</Label>
            <Select>
              <SelectTrigger id="user-provider"><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aws">AWS</SelectItem>
                <SelectItem value="gcp">GCP</SelectItem>
                <SelectItem value="azure">Azure</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="user-role">Initial Role</Label>
            <Select>
              <SelectTrigger id="user-role"><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrator</SelectItem>
                <SelectItem value="developer">Developer</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Create User</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateRoleDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Create Role</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create IAM Role</DialogTitle>
          <DialogDescription>Define a new role with specific permissions.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="role-name">Role Name</Label>
            <Input id="role-name" placeholder="custom-role-name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="role-provider">Provider</Label>
            <Select>
              <SelectTrigger id="role-provider"><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aws">AWS</SelectItem>
                <SelectItem value="gcp">GCP</SelectItem>
                <SelectItem value="azure">Azure</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="role-desc">Description</Label>
            <Input id="role-desc" placeholder="Role description" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Create Role</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreatePolicyDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Create Policy</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create IAM Policy</DialogTitle>
          <DialogDescription>Define a new access policy.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="policy-name">Policy Name</Label>
            <Input id="policy-name" placeholder="custom-policy-name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="policy-provider">Provider</Label>
            <Select>
              <SelectTrigger id="policy-provider"><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aws">AWS</SelectItem>
                <SelectItem value="gcp">GCP</SelectItem>
                <SelectItem value="azure">Azure</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="policy-effect">Effect</Label>
            <Select>
              <SelectTrigger id="policy-effect"><SelectValue placeholder="Select effect" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="allow">Allow</SelectItem>
                <SelectItem value="deny">Deny</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="policy-desc">Description</Label>
            <Input id="policy-desc" placeholder="Policy description" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Create Policy</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateServiceAccountDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Create Service Account</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Service Account</DialogTitle>
          <DialogDescription>Create a new service account for programmatic access.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="sa-name">Account Name</Label>
            <Input id="sa-name" placeholder="my-service-account" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sa-provider">Provider</Label>
            <Select>
              <SelectTrigger id="sa-provider"><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aws">AWS</SelectItem>
                <SelectItem value="gcp">GCP</SelectItem>
                <SelectItem value="azure">Azure</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sa-desc">Description</Label>
            <Input id="sa-desc" placeholder="Service account purpose" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Create Account</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Skeleton className="h-10 w-[180px]" />
        <Skeleton className="h-10 w-[180px]" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

export default function IAMPage() {
  const [activeTab, setActiveTab] = useState("users")
  const [providerFilter, setProviderFilter] = useState<string>("all")

  const { data: usersData } = useIAMUsers()
  const { data: policiesData } = useIAMPolicies()

  const apiUsers: IAMUser[] = (usersData?.users ?? []).map((u: any) => ({ id: u.id, name: u.name ?? u.userName, email: u.email ?? "", provider: u.provider ?? "aws", status: u.status ?? "active", mfaEnabled: u.mfaEnabled ?? false, lastLogin: u.lastLogin ?? "-", groups: u.groups ?? [] }))
  const apiPolicies: IAMPolicy[] = (policiesData?.policies ?? []).map((p: any) => ({ id: p.id, name: p.name ?? p.policyName, provider: p.provider ?? "aws", type: p.type ?? "managed", attachedTo: p.attachedTo ?? 0, description: p.description ?? "" }))

  const filteredUsers = useMemo(() =>
    apiUsers.filter((u) => providerFilter === "all" || u.provider === providerFilter),
    [providerFilter, apiUsers]
  )
  const filteredRoles = useMemo(() =>
    ([] as IAMRole[]).filter((r) => providerFilter === "all" || r.provider === providerFilter),
    [providerFilter]
  )
  const filteredPolicies = useMemo(() =>
    apiPolicies.filter((p) => providerFilter === "all" || p.provider === providerFilter),
    [providerFilter, apiPolicies]
  )
  const filteredServiceAccounts = useMemo(() =>
    ([] as ServiceAccount[]).filter((sa) => providerFilter === "all" || sa.provider === providerFilter),
    [providerFilter]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">IAM Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage identity and access across all cloud providers.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4" />
        <span className="text-sm">Provider:</span>
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" /> Roles
          </TabsTrigger>
          <TabsTrigger value="policies" className="gap-2">
            <FileText className="h-4 w-4" /> Policies
          </TabsTrigger>
          <TabsTrigger value="service-accounts" className="gap-2">
            <Bot className="h-4 w-4" /> Service Accounts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Users ({filteredUsers.length})</CardTitle>
                <CardDescription>IAM users across your cloud providers</CardDescription>
              </div>
              <CreateUserDialog />
            </CardHeader>
            <CardContent>
              <DataTable columns={userColumns} data={filteredUsers} searchKey="name" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Roles ({filteredRoles.length})</CardTitle>
                <CardDescription>IAM roles defining permission boundaries</CardDescription>
              </div>
              <CreateRoleDialog />
            </CardHeader>
            <CardContent>
              <DataTable columns={roleColumns} data={filteredRoles} searchKey="name" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Policies ({filteredPolicies.length})</CardTitle>
                <CardDescription>Access policies and permission definitions</CardDescription>
              </div>
              <CreatePolicyDialog />
            </CardHeader>
            <CardContent>
              <DataTable columns={policyColumns} data={filteredPolicies} searchKey="name" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="service-accounts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Service Accounts ({filteredServiceAccounts.length})</CardTitle>
                <CardDescription>Programmatic access accounts and API keys</CardDescription>
              </div>
              <CreateServiceAccountDialog />
            </CardHeader>
            <CardContent>
              <DataTable columns={serviceAccountColumns} data={filteredServiceAccounts} searchKey="name" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

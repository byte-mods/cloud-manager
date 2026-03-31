"use client"

import { useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Key,
  Plus,
  MoreHorizontal,
  RotateCw,
  Eye,
  EyeOff,
  Trash2,
  Cloud,
  Clock,
  History,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
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
import { useSecrets } from "@/hooks/use-security"

type Secret = {
  id: string
  name: string
  provider: string
  type: "api-key" | "password" | "certificate" | "token" | "ssh-key" | "connection-string"
  lastRotated: string
  rotationDays: number
  status: "active" | "expired" | "rotation-needed" | "disabled"
  versions: number
  createdAt: string
}

type SecretVersion = {
  version: number
  createdAt: string
  createdBy: string
  status: "current" | "previous" | "deprecated"
}


const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  expired: "destructive",
  "rotation-needed": "secondary",
  disabled: "outline",
}

const columns: ColumnDef<Secret>[] = [
  { accessorKey: "name", header: "Name", cell: ({ row }) => (
    <span className="font-mono text-sm font-medium">{row.original.name}</span>
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
  { accessorKey: "lastRotated", header: "Last Rotated", cell: ({ row }) => (
    <div className="flex items-center gap-2">
      <Clock className="h-3 w-3 text-muted-foreground" />
      <span className="text-sm">{row.original.lastRotated}</span>
    </div>
  )},
  { accessorKey: "status", header: "Status", cell: ({ row }) => (
    <div className="flex items-center gap-2">
      <Badge variant={statusVariants[row.original.status]}>{row.original.status}</Badge>
      {row.original.status === "rotation-needed" && (
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
      )}
    </div>
  )},
  { accessorKey: "versions", header: "Versions" },
  { id: "actions", header: "", cell: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> View Secret</DropdownMenuItem>
        <DropdownMenuItem><RotateCw className="mr-2 h-4 w-4" /> Rotate</DropdownMenuItem>
        <DropdownMenuItem><History className="mr-2 h-4 w-4" /> Version History</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )},
]

function CreateSecretDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Create Secret</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Secret</DialogTitle>
          <DialogDescription>Store a new secret in your vault.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="secret-name">Secret Name</Label>
            <Input id="secret-name" placeholder="prod/service/secret-name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="secret-provider">Provider</Label>
            <Select>
              <SelectTrigger id="secret-provider"><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aws">AWS Secrets Manager</SelectItem>
                <SelectItem value="gcp">GCP Secret Manager</SelectItem>
                <SelectItem value="azure">Azure Key Vault</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="secret-type">Type</Label>
            <Select>
              <SelectTrigger id="secret-type"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="api-key">API Key</SelectItem>
                <SelectItem value="password">Password</SelectItem>
                <SelectItem value="certificate">Certificate</SelectItem>
                <SelectItem value="token">Token</SelectItem>
                <SelectItem value="ssh-key">SSH Key</SelectItem>
                <SelectItem value="connection-string">Connection String</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="secret-value">Secret Value</Label>
            <Input id="secret-value" type="password" placeholder="Enter secret value" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rotation-period">Rotation Period (days)</Label>
            <Input id="rotation-period" type="number" placeholder="30" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Create Secret</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VersionHistoryPanel() {
  const [expanded, setExpanded] = useState(false)
  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <CardTitle className="text-base">Version History</CardTitle>
          <CardDescription className="ml-auto">prod/database/master-password</CardDescription>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          <div className="rounded-md border">
            <div className="grid grid-cols-4 gap-4 p-3 bg-muted text-sm font-medium">
              <span>Version</span>
              <span>Created At</span>
              <span>Created By</span>
              <span>Status</span>
            </div>
            <div className="p-6 text-center text-sm text-muted-foreground">No data available</div>
          </div>
        </CardContent>
      )}
    </Card>
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Key className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No secrets found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Start by creating your first secret.
      </p>
    </div>
  )
}

export default function SecretsPage() {
  const { data, isLoading } = useSecrets()

  // Transform API data to UI format
  const apiSecrets = data?.secrets ?? []
  const secrets: Secret[] = apiSecrets.map((s) => {
      const expiryDate = s.expiresAt ? new Date(s.expiresAt) : null
      const now = new Date()
      const daysSinceRotation = s.lastRotated ? Math.floor((now.getTime() - new Date(s.lastRotated).getTime()) / (1000 * 60 * 60 * 24)) : 0
      return {
        id: s.id,
        name: s.name,
        provider: s.provider.toLowerCase(),
        type: s.type.toLowerCase() as Secret['type'],
        lastRotated: s.lastRotated.split('T')[0] + ' ago',
        rotationDays: 30,
        status: (!s.expiresAt || expiryDate! > now) ? 'active' : 'expired',
        versions: 1,
        createdAt: s.lastRotated.split('T')[0],
      }
    })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Secrets Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage secrets, API keys, and credentials across all providers.
          </p>
        </div>
        <CreateSecretDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{secrets.length}</div>
            <p className="text-xs text-muted-foreground">Total Secrets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">
              {secrets.filter((s) => s.status === "active").length}
            </div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-500">
              {secrets.filter((s) => s.status === "rotation-needed").length}
            </div>
            <p className="text-xs text-muted-foreground">Need Rotation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-500">
              {secrets.filter((s) => s.status === "expired").length}
            </div>
            <p className="text-xs text-muted-foreground">Expired</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : secrets.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Secrets</CardTitle>
            <CardDescription>All secrets across your cloud providers</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={secrets} searchKey="name" />
          </CardContent>
        </Card>
      )}

      <VersionHistoryPanel />
    </div>
  )
}

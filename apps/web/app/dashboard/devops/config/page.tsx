"use client"

import { useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { useDevOpsConfig } from "@/hooks/use-devops"
import {
  Settings,
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Copy,
  Download,
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

type ConfigItem = {
  id: string
  name: string
  provider: string
  type: "env-vars" | "secrets" | "feature-flags" | "config-map"
  instances: number
  lastUpdated: string
  environment: string
}

const typeVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "env-vars": "default",
  secrets: "destructive",
  "feature-flags": "secondary",
  "config-map": "outline",
}

const typeLabels: Record<string, string> = {
  "env-vars": "Env Vars",
  secrets: "Secrets",
  "feature-flags": "Feature Flags",
  "config-map": "Config Map",
}

const columns: ColumnDef<ConfigItem>[] = [
  { accessorKey: "name", header: "Config Name", cell: ({ row }) => (
    <span className="font-medium">{row.original.name}</span>
  )},
  { accessorKey: "provider", header: "Provider", cell: ({ row }) => (
    <span className="text-sm">{row.original.provider}</span>
  )},
  { accessorKey: "type", header: "Type", cell: ({ row }) => (
    <Badge variant={typeVariants[row.original.type]} className="text-xs">
      {typeLabels[row.original.type]}
    </Badge>
  )},
  { accessorKey: "environment", header: "Environment", cell: ({ row }) => (
    <Badge variant="outline" className="text-xs capitalize">{row.original.environment}</Badge>
  )},
  { accessorKey: "instances", header: "Instances", cell: ({ row }) => (
    <span className="text-sm font-medium">{row.original.instances}</span>
  )},
  { accessorKey: "lastUpdated", header: "Last Updated", cell: ({ row }) => (
    <span className="text-sm text-muted-foreground">{row.original.lastUpdated}</span>
  )},
  { id: "actions", header: "", cell: ({ row }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> View</DropdownMenuItem>
        <DropdownMenuItem><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
        <DropdownMenuItem><Copy className="mr-2 h-4 w-4" /> Duplicate</DropdownMenuItem>
        <DropdownMenuItem><Download className="mr-2 h-4 w-4" /> Export</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )},
]

function CreateConfigDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Create Config</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Configuration</DialogTitle>
          <DialogDescription>Add a new configuration entry.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="cfg-name">Config Name</Label>
            <Input id="cfg-name" placeholder="my-service-config" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cfg-provider">Provider</Label>
            <Select>
              <SelectTrigger id="cfg-provider"><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aws-parameter-store">AWS Parameter Store</SelectItem>
                <SelectItem value="aws-secrets-manager">AWS Secrets Manager</SelectItem>
                <SelectItem value="hashicorp-vault">HashiCorp Vault</SelectItem>
                <SelectItem value="gcp-secret-manager">GCP Secret Manager</SelectItem>
                <SelectItem value="k8s-configmap">Kubernetes ConfigMap</SelectItem>
                <SelectItem value="launchdarkly">LaunchDarkly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cfg-type">Type</Label>
            <Select>
              <SelectTrigger id="cfg-type"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="env-vars">Environment Variables</SelectItem>
                <SelectItem value="secrets">Secrets</SelectItem>
                <SelectItem value="feature-flags">Feature Flags</SelectItem>
                <SelectItem value="config-map">Config Map</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cfg-env">Environment</Label>
            <Select>
              <SelectTrigger id="cfg-env"><SelectValue placeholder="Select environment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="development">Development</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Settings className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No configurations found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Create your first configuration to manage application settings.
      </p>
    </div>
  )
}

export default function ConfigPage() {
  const { data, isLoading, error } = useDevOpsConfig()
  const configs: ConfigItem[] = (data?.entries ?? []).map((e) => ({
    id: e.id,
    name: e.key,
    provider: e.service,
    type: "env-vars" as const,
    instances: 1,
    lastUpdated: e.lastModified,
    environment: e.environment,
  }))

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuration Management</h1>
          <p className="text-muted-foreground mt-1">Centralized configuration and secrets management across providers.</p>
        </div>
        <div className="text-destructive text-sm">Failed to load configurations. Please try again later.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuration Management</h1>
          <p className="text-muted-foreground mt-1">
            Centralized configuration and secrets management across providers.
          </p>
        </div>
        <CreateConfigDialog />
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : configs.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Configurations ({configs.length})</CardTitle>
            <CardDescription>All managed configurations and secrets</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={configs} searchKey="name" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

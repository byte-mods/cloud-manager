"use client"

import { useState } from "react"
import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import {
  Container,
  Plus,
  MoreHorizontal,
  Cloud,
  Package,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useResources, type Resource } from "@/hooks/use-resources"

type Registry = {
  id: string
  name: string
  provider: string
  imagesCount: number
  totalSize: string
  createdAt: string
}

type ContainerService = Resource & {
  metadata?: {
    tasks?: number
    replicas?: number
    cpu: string
    memory: string
    desiredCount?: number
  }
}

const registryColumns: ColumnDef<Registry>[] = [
  {
    accessorKey: "name",
    header: "Name",
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
        <span className="uppercase text-xs font-medium">
          {row.original.provider}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "imagesCount",
    header: "Images",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.imagesCount}</span>
    ),
  },
  {
    accessorKey: "totalSize",
    header: "Size",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.totalSize}</span>
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
          <DropdownMenuItem>View Images</DropdownMenuItem>
          <DropdownMenuItem>Settings</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

const serviceColumns: ColumnDef<ContainerService>[] = [
  {
    accessorKey: "name",
    header: "Name",
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
        <span className="uppercase text-xs font-medium">
          {row.original.provider}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status
      const variant =
        status === "active"
          ? "default"
          : status === "draining"
          ? "outline"
          : status === "failed"
          ? "destructive"
          : "secondary"
      return <Badge variant={variant}>{status}</Badge>
    },
  },
  {
    id: "tasks",
    header: "Tasks/Replicas",
    cell: ({ row }) => {
      const meta = row.original.metadata
      return (
        <span className="text-sm">
          {meta?.tasks ?? meta?.replicas ?? 0}
          {meta?.desiredCount != null ? ` / ${meta.desiredCount}` : ""}
        </span>
      )
    },
  },
  {
    id: "cpu",
    header: "CPU",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.metadata?.cpu ?? "-"}</span>
    ),
  },
  {
    id: "memory",
    header: "Memory",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.metadata?.memory ?? "-"}</span>
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
          <DropdownMenuItem>View Details</DropdownMenuItem>
          <DropdownMenuItem>Scale</DropdownMenuItem>
          <DropdownMenuItem>View Logs</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

function EmptyRegistries() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Package className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No registries found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        No container registries are connected to your account.
      </p>
    </div>
  )
}

function EmptyServices() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Container className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No container services found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        No container services (ECS, Cloud Run, etc.) are running.
      </p>
    </div>
  )
}

export default function ContainersPage() {
  const [activeTab, setActiveTab] = useState("registries")
  const {
    data: registriesData,
    isLoading: registriesLoading,
  } = useResources("compute/container-registries")
  const {
    data: servicesData,
    isLoading: servicesLoading,
  } = useResources("compute/container-services")

  const registries = (registriesData?.resources ?? []) as unknown as Registry[]
  const services = (servicesData?.resources ?? []) as ContainerService[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Containers</h1>
          <p className="text-muted-foreground mt-1">
            Manage container registries and services across all providers.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="registries">
            Registries
            {registries.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {registries.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="services">
            Services
            {services.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {services.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registries">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Container Registries</CardTitle>
              <CardDescription>
                ECR, Artifact Registry, and Azure Container Registry
              </CardDescription>
            </CardHeader>
            <CardContent>
              {registriesLoading ? (
                <LoadingSkeleton />
              ) : registries.length === 0 ? (
                <EmptyRegistries />
              ) : (
                <DataTable
                  columns={registryColumns}
                  data={registries}
                  searchKey="name"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Container Services</CardTitle>
              <CardDescription>
                ECS, Cloud Run, and Azure Container Apps
              </CardDescription>
            </CardHeader>
            <CardContent>
              {servicesLoading ? (
                <LoadingSkeleton />
              ) : services.length === 0 ? (
                <EmptyServices />
              ) : (
                <DataTable
                  columns={serviceColumns}
                  data={services}
                  searchKey="name"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

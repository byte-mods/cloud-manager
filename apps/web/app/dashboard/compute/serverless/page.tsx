"use client"

import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import {
  Cpu,
  Plus,
  MoreHorizontal,
  Cloud,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useResources, type Resource } from "@/hooks/use-resources"

type ServerlessFunction = Resource & {
  metadata?: {
    runtime?: string
    memory?: number
    timeout?: number
    lastInvoked?: string
    invocations7d?: number
    handler?: string
  }
}

const runtimeColors: Record<string, string> = {
  "nodejs18.x": "bg-green-500/10 text-green-700",
  "nodejs20.x": "bg-green-500/10 text-green-700",
  "python3.11": "bg-blue-500/10 text-blue-700",
  "python3.12": "bg-blue-500/10 text-blue-700",
  "go1.x": "bg-cyan-500/10 text-cyan-700",
  "java17": "bg-red-500/10 text-red-700",
  "dotnet6": "bg-purple-500/10 text-purple-700",
  "rust": "bg-orange-500/10 text-orange-700",
}

const columns: ColumnDef<ServerlessFunction>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
  },
  {
    id: "runtime",
    header: "Runtime",
    cell: ({ row }) => {
      const runtime = row.original.metadata?.runtime ?? "-"
      const colorClass = runtimeColors[runtime] ?? "bg-gray-500/10 text-gray-700"
      return (
        <Badge variant="outline" className={colorClass}>
          {runtime}
        </Badge>
      )
    },
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
    id: "memory",
    header: "Memory",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.metadata?.memory
          ? `${row.original.metadata.memory} MB`
          : "-"}
      </span>
    ),
  },
  {
    id: "timeout",
    header: "Timeout",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.metadata?.timeout
          ? `${row.original.metadata.timeout}s`
          : "-"}
      </span>
    ),
  },
  {
    id: "lastInvoked",
    header: "Last Invoked",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.metadata?.lastInvoked ?? "Never"}
      </span>
    ),
  },
  {
    id: "invocations",
    header: "Invocations (7d)",
    cell: ({ row }) => (
      <span className="text-sm font-medium">
        {row.original.metadata?.invocations7d?.toLocaleString() ?? "0"}
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
          <DropdownMenuItem>View Details</DropdownMenuItem>
          <DropdownMenuItem>View Logs</DropdownMenuItem>
          <DropdownMenuItem>Test Invoke</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Edit Configuration</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">
            Delete Function
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

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
      <Cpu className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No serverless functions found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Get started by creating your first serverless function.
      </p>
      <Button asChild>
        <Link href="/dashboard/compute/serverless/create">
          <Plus className="mr-2 h-4 w-4" />
          Create Function
        </Link>
      </Button>
    </div>
  )
}

export default function ServerlessPage() {
  const { data, isLoading } = useResources("compute/serverless")
  const functions = (data?.resources ?? []) as ServerlessFunction[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Serverless</h1>
          <p className="text-muted-foreground mt-1">
            Manage serverless functions across Lambda, Cloud Functions, and Azure Functions.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/compute/serverless/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Function
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : functions.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {functions.length} Function{functions.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={functions}
              searchKey="name"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import { HardDrive, FolderTree, Shield, Table2 } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/ui/data-table"
import { type ColumnDef } from "@tanstack/react-table"
import { useDataLakeDatasets } from "@/hooks/use-data-engineering"

type Catalog = {
  id: string
  name: string
  provider: string
  databases: number
  tables: number
  lastCrawled: string
}

type GovernanceRule = {
  id: string
  name: string
  type: string
  scope: string
  status: "active" | "inactive"
}

type TableSchema = {
  id: string
  name: string
  database: string
  columns: number
  rows: string
  format: string
  lastUpdated: string
}


const catalogColumns: ColumnDef<Catalog>[] = [
  { accessorKey: "name", header: "Catalog" },
  { accessorKey: "provider", header: "Provider", cell: ({ row }) => <Badge variant="outline">{row.original.provider}</Badge> },
  { accessorKey: "databases", header: "Databases" },
  { accessorKey: "tables", header: "Tables" },
  { accessorKey: "lastCrawled", header: "Last Crawled" },
]

const ruleColumns: ColumnDef<GovernanceRule>[] = [
  { accessorKey: "name", header: "Rule" },
  { accessorKey: "type", header: "Type", cell: ({ row }) => <Badge variant="secondary">{row.original.type}</Badge> },
  { accessorKey: "scope", header: "Scope" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => {
    const s = row.original.status
    return <Badge className={s === "active" ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"}>{s === "active" ? "Active" : "Inactive"}</Badge>
  }},
]

const tableColumns: ColumnDef<TableSchema>[] = [
  { accessorKey: "name", header: "Table" },
  { accessorKey: "database", header: "Database" },
  { accessorKey: "columns", header: "Columns" },
  { accessorKey: "rows", header: "Rows" },
  { accessorKey: "format", header: "Format", cell: ({ row }) => <Badge variant="outline">{row.original.format}</Badge> },
  { accessorKey: "lastUpdated", header: "Last Updated" },
]

export default function DataLakePage() {
  const [activeTab, setActiveTab] = useState("catalogs")
  const { data, isLoading, error } = useDataLakeDatasets()

  const datasets = data?.datasets ?? []

  const catalogs: Catalog[] = datasets.map((d) => ({
    id: d.id,
    name: d.name,
    provider: d.location,
    databases: 1,
    tables: 1,
    lastCrawled: d.lastUpdated,
  }))

  const tables: TableSchema[] = datasets.map((d) => ({
    id: d.id,
    name: d.name,
    database: d.location,
    columns: 0,
    rows: d.size,
    format: d.format,
    lastUpdated: d.lastUpdated,
  }))

  const rules: GovernanceRule[] = []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Lake</h1>
        <p className="text-muted-foreground mt-1">
          Manage data lake storage, catalogs, governance, and schemas.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <HardDrive className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4.2 TB</div>
            <Progress value={42} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">42% of 10 TB quota</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Catalogs</CardTitle>
            <FolderTree className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{catalogs.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tables</CardTitle>
            <Table2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{catalogs.reduce((s, c) => s + c.tables, 0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Governance Rules</CardTitle>
            <Shield className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{rules.filter((r) => r.status === "active").length} active</div></CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="catalogs">Catalogs</TabsTrigger>
          <TabsTrigger value="governance">Governance</TabsTrigger>
          <TabsTrigger value="tables">Tables & Schemas</TabsTrigger>
        </TabsList>
        <TabsContent value="catalogs">
          <Card>
            <CardHeader><CardTitle>Data Catalogs</CardTitle><CardDescription>Metadata catalogs across providers</CardDescription></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-40 w-full" /> : <DataTable columns={catalogColumns} data={catalogs} searchKey="name" />}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="governance">
          <Card>
            <CardHeader><CardTitle>Governance Rules</CardTitle><CardDescription>Data governance and compliance rules</CardDescription></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-40 w-full" /> : <DataTable columns={ruleColumns} data={rules} searchKey="name" />}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tables">
          <Card>
            <CardHeader><CardTitle>Tables & Schemas</CardTitle><CardDescription>Registered tables and their schemas</CardDescription></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-40 w-full" /> : <DataTable columns={tableColumns} data={tables} searchKey="name" />}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

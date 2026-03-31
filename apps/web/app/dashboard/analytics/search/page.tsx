"use client"

import { useState, useMemo } from "react"
import { Search, FileText } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import { type ColumnDef } from "@tanstack/react-table"
import { useSearchIndexes } from "@/hooks/use-analytics"

type SearchResult = {
  id: string
  title: string
  type: string
  snippet: string
  score: number
}

type SearchIndex = {
  id: string
  name: string
  provider: string
  documents: string
  size: string
  status: "active" | "indexing" | "error"
}

const indexColumns: ColumnDef<SearchIndex>[] = [
  { accessorKey: "name", header: "Index" },
  { accessorKey: "provider", header: "Provider", cell: ({ row }) => <Badge variant="outline">{row.original.provider}</Badge> },
  { accessorKey: "documents", header: "Documents" },
  { accessorKey: "size", header: "Size" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => {
    const s = row.original.status
    const cls = s === "active" ? "bg-green-500/10 text-green-500" : s === "indexing" ? "bg-blue-500/10 text-blue-500" : "bg-red-500/10 text-red-500"
    return <Badge className={cls}>{s.charAt(0).toUpperCase() + s.slice(1)}</Badge>
  }},
]

export default function SearchPage() {
  const { data, isLoading, error } = useSearchIndexes()
  const [searchQuery, setSearchQuery] = useState("")
  const [hasSearched, setHasSearched] = useState(false)

  const indexes: SearchIndex[] = useMemo(() =>
    (data?.indexes ?? []).map((idx) => ({
      id: idx.id,
      name: idx.name,
      provider: "-",
      documents: idx.documentCount.toLocaleString(),
      size: `${(idx.sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
      status: idx.status === "building" ? "indexing" as const : idx.status as SearchIndex["status"],
    })),
    [data]
  )

  const handleSearch = () => {
    if (searchQuery.trim()) setHasSearched(true)
  }

  if (isLoading) return <div className="space-y-4">{Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Search</h1>
        <p className="text-muted-foreground mt-1">
          Full-text search across your cloud resources and logs.
        </p>
      </div>

      {/* Search input */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search resources, logs, configurations..."
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Results</CardTitle>
            <CardDescription>{([] as SearchResult[]).length} results found</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {([] as SearchResult[]).map((result) => (
              <div key={result.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="font-medium text-sm">{result.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{result.type}</Badge>
                    <span className="text-xs text-muted-foreground">Score: {result.score}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground ml-6">{result.snippet}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Index management */}
      <Card>
        <CardHeader>
          <CardTitle>Index Management</CardTitle>
          <CardDescription>Search indexes across providers</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={indexColumns} data={indexes} searchKey="name" />
        </CardContent>
      </Card>
    </div>
  )
}

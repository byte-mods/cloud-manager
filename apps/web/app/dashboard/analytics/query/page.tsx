"use client"

import { useState, useCallback } from "react"
import { Play, Clock, Database } from "lucide-react"
import dynamic from "next/dynamic"
import { useAnalyticsQuery } from "@/hooks/use-analytics"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false })

export default function QueryPage() {
  const [query, setQuery] = useState(`SELECT service, region, total_cost, request_count, avg_latency_ms
FROM cloud_metrics.service_usage
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
ORDER BY total_cost DESC
LIMIT 10;`)
  const [engine, setEngine] = useState("bigquery")
  const [submittedQuery, setSubmittedQuery] = useState("")
  const { data: queryResult, isLoading: isRunning } = useAnalyticsQuery(submittedQuery, { enabled: submittedQuery.length > 0 })
  const hasRun = !!queryResult

  const handleRun = useCallback(() => {
    setSubmittedQuery(query)
  }, [query])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Query Engines</h1>
        <p className="text-muted-foreground mt-1">
          Run SQL queries against your cloud data warehouses.
        </p>
      </div>

      {/* Query editor */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">SQL Editor</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={engine} onValueChange={setEngine}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bigquery">Google BigQuery</SelectItem>
                  <SelectItem value="redshift">Amazon Redshift</SelectItem>
                  <SelectItem value="synapse">Azure Synapse</SelectItem>
                  <SelectItem value="athena">Amazon Athena</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleRun} disabled={isRunning}>
                <Play className="h-4 w-4 mr-1" />
                {isRunning ? "Running..." : "Run Query"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <MonacoEditor
              height="160px"
              defaultLanguage="sql"
              value={query}
              onChange={(value) => setQuery(value ?? "")}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                padding: { top: 12, bottom: 12 },
                renderLineHighlight: "none",
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                scrollbar: { vertical: "hidden", horizontal: "hidden" },
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {hasRun && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Results</CardTitle>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  1.2s
                </Badge>
                <Badge variant="secondary">{queryResult?.rowCount ?? queryResult?.rows.length ?? 0} rows</Badge>
                <Badge variant="secondary">
                  <Database className="h-3 w-3 mr-1" />
                  248 KB scanned
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {(queryResult?.columns ?? []).map((col) => (
                      <TableHead key={col} className="font-mono text-xs">{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(queryResult?.rows ?? []).map((row, i) => (
                    <TableRow key={i}>
                      {row.map((cell, j) => (
                        <TableCell key={j} className="font-mono text-xs">{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

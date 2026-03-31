"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { Plus, Key, Trash2, Copy } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DataTable } from "@/components/ui/data-table"
import { type ColumnDef } from "@tanstack/react-table"

type APIKey = {
  id: string
  name: string
  keyPrefix: string
  created: string
  lastUsed: string
  status: "active" | "revoked"
}


const columns: ColumnDef<APIKey>[] = [
  { accessorKey: "name", header: "Key Name" },
  {
    accessorKey: "keyPrefix",
    header: "Key",
    cell: ({ row }) => (
      <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
        {row.original.keyPrefix}
      </code>
    ),
  },
  { accessorKey: "created", header: "Created" },
  { accessorKey: "lastUsed", header: "Last Used" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status
      return <Badge className={s === "active" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}>{s === "active" ? "Active" : "Revoked"}</Badge>
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      row.original.status === "active" ? (
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          <Trash2 className="h-3 w-3 mr-1" />
          Revoke
        </Button>
      ) : null
    ),
  },
]

export default function APIKeysPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ apiKeys: APIKey[] }>({
    queryKey: ["settings", "api-keys"],
    queryFn: () => apiClient.get("/v1/auth/api-keys"),
  })

  const keys = data?.apiKeys ?? []

  const handleGenerate = () => {
    setGeneratedKey("cm_live_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0")
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground mt-1">Manage API keys for programmatic access.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setGeneratedKey(null) }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Generate Key</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate API Key</DialogTitle>
              <DialogDescription>Create a new API key for programmatic access.</DialogDescription>
            </DialogHeader>
            {generatedKey ? (
              <div className="space-y-4 py-4">
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                    Copy this key now. It will not be shown again.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input value={generatedKey} readOnly className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigator.clipboard.writeText(generatedKey)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Key Name</Label>
                  <Input placeholder="e.g., Production API Key" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Give this key a descriptive name so you can identify it later.
                </p>
              </div>
            )}
            <DialogFooter>
              {generatedKey ? (
                <Button onClick={() => { setIsDialogOpen(false); setGeneratedKey(null) }}>Done</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleGenerate}>
                    <Key className="h-4 w-4 mr-2" />
                    Generate
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All API Keys</CardTitle>
          <CardDescription>Manage your API access keys</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={keys} searchKey="name" />
        </CardContent>
      </Card>
    </div>
  )
}

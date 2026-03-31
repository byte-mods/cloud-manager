"use client"

import { useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Webhook as WebhookIcon,
  Plus,
  MoreHorizontal,
  Trash2,
  CheckCircle2,
  XCircle,
  Copy,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useWebhooks, useCreateWebhook, useDeleteWebhook, type Webhook } from "@/hooks/use-webhooks"

const AVAILABLE_EVENTS = [
  "resource.created",
  "resource.updated",
  "resource.deleted",
  "alert.triggered",
  "deployment.completed",
  "cost.threshold",
  "security.violation",
  "incident.created",
]

const columns: ColumnDef<Webhook>[] = [
  {
    accessorKey: "url",
    header: "URL",
    cell: ({ row }) => (
      <span className="font-mono text-sm truncate max-w-[300px] block">{row.original.url}</span>
    ),
  },
  {
    accessorKey: "events",
    header: "Events",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.events.slice(0, 3).map((e) => (
          <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
        ))}
        {row.original.events.length > 3 && (
          <Badge variant="secondary" className="text-xs">+{row.original.events.length - 3}</Badge>
        )}
      </div>
    ),
  },
  {
    accessorKey: "active",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.active ? "default" : "secondary"}>
        {row.original.active ? (
          <><CheckCircle2 className="mr-1 h-3 w-3" /> Active</>
        ) : (
          <><XCircle className="mr-1 h-3 w-3" /> Inactive</>
        )}
      </Badge>
    ),
  },
  {
    accessorKey: "failureCount",
    header: "Failures",
    cell: ({ row }) => (
      <span className={row.original.failureCount > 0 ? "text-red-500 font-medium" : "text-muted-foreground"}>
        {row.original.failureCount}
      </span>
    ),
  },
  {
    accessorKey: "lastTriggeredAt",
    header: "Last Triggered",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.lastTriggeredAt ?? "Never"}
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
          <DropdownMenuItem><Copy className="mr-2 h-4 w-4" /> Copy URL</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

function CreateWebhookDialog() {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [secret, setSecret] = useState("")
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const createWebhook = useCreateWebhook()

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    )
  }

  function handleCreate() {
    createWebhook.mutate({ url, events: selectedEvents, active: true })
    setOpen(false)
    setUrl("")
    setSecret("")
    setSelectedEvents([])
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Add Webhook</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Webhook</DialogTitle>
          <DialogDescription>Configure a new webhook endpoint to receive event notifications.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="webhook-url">Payload URL</Label>
            <Input id="webhook-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhooks" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="webhook-secret">Secret (optional)</Label>
            <Input id="webhook-secret" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="whsec_..." type="password" />
          </div>
          <div className="grid gap-2">
            <Label>Events</Label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="rounded border-input"
                  />
                  {event}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!url || selectedEvents.length === 0}>Create Webhook</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function WebhooksPage() {
  const { data, isLoading, error } = useWebhooks()

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
          <p className="text-muted-foreground mt-1">Manage webhook endpoints for event notifications.</p>
        </div>
        <Card className="border-red-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-red-500">Failed to load webhooks. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const webhooks = data?.webhooks ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
          <p className="text-muted-foreground mt-1">Manage webhook endpoints for event notifications.</p>
        </div>
        <CreateWebhookDialog />
      </div>

      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <WebhookIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No webhooks configured</h3>
            <p className="text-muted-foreground text-sm mt-1">Add your first webhook to start receiving event notifications.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Webhook Endpoints</CardTitle>
            <CardDescription>{webhooks.length} webhook{webhooks.length !== 1 ? "s" : ""} configured</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={webhooks} searchKey="url" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

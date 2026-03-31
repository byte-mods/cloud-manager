"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useIaCWorkspace } from "@/hooks/use-devops"
import { ColumnDef } from "@tanstack/react-table"
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  XCircle,
  Code2,
  AlertTriangle,
  Sparkles,
  Loader2,
  Copy,
  Check,
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
import { apiClient } from "@/lib/api-client"

type ApplyHistory = {
  id: string
  action: "apply" | "plan" | "destroy"
  status: "success" | "failed"
  changes: { added: number; changed: number; destroyed: number }
  appliedBy: string
  appliedAt: string
  duration: string
}


const historyColumns: ColumnDef<ApplyHistory>[] = [
  { accessorKey: "action", header: "Action", cell: ({ row }) => (
    <Badge variant="outline" className="text-xs capitalize">{row.original.action}</Badge>
  )},
  { accessorKey: "status", header: "Status", cell: ({ row }) => (
    <div className="flex items-center gap-1.5">
      {row.original.status === "success" ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-red-500" />
      )}
      <Badge variant={row.original.status === "success" ? "default" : "destructive"} className="text-xs capitalize">
        {row.original.status}
      </Badge>
    </div>
  )},
  { id: "changes", header: "Changes", cell: ({ row }) => {
    const c = row.original.changes
    return (
      <div className="flex items-center gap-2 text-xs">
        {c.added > 0 && <span className="text-green-500 font-medium">+{c.added}</span>}
        {c.changed > 0 && <span className="text-yellow-500 font-medium">~{c.changed}</span>}
        {c.destroyed > 0 && <span className="text-red-500 font-medium">-{c.destroyed}</span>}
        {c.added === 0 && c.changed === 0 && c.destroyed === 0 && (
          <span className="text-muted-foreground">No changes</span>
        )}
      </div>
    )
  }},
  { accessorKey: "appliedBy", header: "Applied By", cell: ({ row }) => (
    <span className="text-sm">{row.original.appliedBy}</span>
  )},
  { accessorKey: "appliedAt", header: "Date", cell: ({ row }) => (
    <span className="text-sm text-muted-foreground">{row.original.appliedAt}</span>
  )},
  { accessorKey: "duration", header: "Duration", cell: ({ row }) => (
    <span className="text-sm font-mono text-muted-foreground">{row.original.duration}</span>
  )},
]

function DiffView({ output }: { output: string }) {
  return (
    <pre className="text-xs font-mono bg-muted p-4 rounded-md overflow-x-auto whitespace-pre-wrap">
      {output.split("\n").map((line, i) => {
        let className = ""
        if (line.startsWith("+") && !line.startsWith("++")) className = "text-green-500"
        else if (line.startsWith("-") && !line.startsWith("--")) className = "text-red-500"
        else if (line.startsWith("~")) className = "text-yellow-500"
        return (
          <div key={i} className={className}>
            {line}
          </div>
        )
      })}
    </pre>
  )
}

function AIGenerateDialog({
  iacProvider,
  onGenerate,
}: {
  iacProvider: string
  onGenerate: (code: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) return

    setIsGenerating(true)
    setError(null)

    try {
      const response = await apiClient.post<{ code: string }>("/ai/iac/generate", {
        prompt,
        provider: iacProvider,
      })
      onGenerate(response.code)
      setOpen(false)
      setPrompt("")
    } catch (err: any) {
      setError(err?.message ?? "Failed to generate code. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const suggestions = [
    "Create an S3 bucket with versioning enabled",
    "Set up an RDS PostgreSQL instance with Multi-AZ",
    "Deploy a load balancer with auto-scaling",
    "Create a VPC with public and private subnets",
    "Set up a Kubernetes cluster with node pools",
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="mr-2 h-4 w-4" /> AI Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Generate Infrastructure Code</DialogTitle>
          <DialogDescription>
            Describe what you want to create in plain language. AI will generate {iacProvider} code.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="prompt">Describe your infrastructure</Label>
            <Textarea
              id="prompt"
              placeholder="e.g., Create an S3 bucket with versioning enabled and encryption..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Suggestions</Label>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setPrompt(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={!prompt.trim() || isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Code
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ApplyConfirmDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Play className="mr-2 h-4 w-4" /> Apply
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Apply</DialogTitle>
          <DialogDescription>
            This will apply the planned changes to your infrastructure. This action may create, modify, or destroy resources.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30">
            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Plan: 1 to add, 1 to change, 1 to destroy.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>
            Confirm Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-[300px] w-full" />
      <Skeleton className="h-[200px] w-full" />
    </div>
  )
}

export default function IaCWorkspaceDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { data: workspace, isLoading, error } = useIaCWorkspace(id)
  const [code, setCode] = useState("")
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton />
      </div>
    )
  }

  if (error || !workspace) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/devops/iac">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to IaC
          </Link>
        </Button>
        <div className="text-destructive text-sm">Failed to load workspace details. Please try again later.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/devops/iac">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to IaC
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{workspace.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline">{workspace.backend}</Badge>
              <Badge variant="outline">{workspace.provider}</Badge>
              <span className="text-sm text-muted-foreground">{workspace.resourceCount} resources</span>
              <Badge variant="default" className="text-xs capitalize">{workspace.status}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <AIGenerateDialog iacProvider={workspace.backend} onGenerate={setCode} />
          <Button variant="outline">
            <Code2 className="mr-2 h-4 w-4" /> Plan
          </Button>
          <ApplyConfirmDialog />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Edit your infrastructure code</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" /> Copy
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          <Textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="font-mono text-sm min-h-[350px] resize-y"
            spellCheck={false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan Output</CardTitle>
          <CardDescription>Last plan execution result</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-sm text-muted-foreground">No data available</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Apply History</CardTitle>
          <CardDescription>Previous infrastructure changes</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={historyColumns} data={[]} />
        </CardContent>
      </Card>
    </div>
  )
}

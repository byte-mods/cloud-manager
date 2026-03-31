"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import Link from "next/link"
import {
  ArrowLeft,
  Terminal,
  CheckCircle,
  Circle,
  Clock,
  Play,
  RefreshCw,
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
import { Progress } from "@/components/ui/progress"

type EnvironmentStatus = "provisioning" | "ready" | "expired"

type Task = {
  id: string
  title: string
  verified: boolean
}


/** Simulated xterm.js-like sandbox terminal with command execution */
function SandboxTerminal({ status }: { status: string }) {
  const termRef = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState<string[]>([])
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const mockCommands: Record<string, string> = {
    "aws s3 ls": "2026-01-15 10:30:00 my-data-bucket\n2026-02-20 14:15:00 my-logs-bucket\n2026-03-10 09:45:00 sandbox-assets",
    "aws ec2 describe-instances --query 'Reservations[].Instances[].InstanceId' --output text": "i-0abc123def456789\ni-0def789abc012345",
    "terraform --version": "Terraform v1.8.2\non darwin_arm64",
    "terraform init": "Initializing the backend...\nInitializing provider plugins...\n- Finding hashicorp/aws versions matching \"~> 5.0\"...\n- Installing hashicorp/aws v5.82.0...\n\nTerraform has been successfully initialized!",
    "terraform plan": "Plan: 3 to add, 0 to change, 0 to destroy.",
    "kubectl get pods": "NAME                         READY   STATUS    RESTARTS   AGE\nweb-frontend-7d8f9-abc12    1/1     Running   0          2d\napi-gateway-5c6d7-jkl89     1/1     Running   1          5d\nredis-cluster-0              1/1     Running   0          30d",
    "kubectl get nodes": "NAME     STATUS   ROLES    AGE   VERSION\nnode-1   Ready    <none>   45d   v1.30.4\nnode-2   Ready    <none>   45d   v1.30.4\nnode-3   Ready    <none>   45d   v1.30.4",
    help: "Available commands:\n  aws s3 ls              - List S3 buckets\n  aws ec2 describe-*     - Describe EC2 resources\n  terraform init/plan    - Terraform operations\n  kubectl get pods/nodes - Kubernetes operations\n  clear                  - Clear terminal\n  help                   - Show this help",
    clear: "__CLEAR__",
  }

  useEffect(() => {
    if (status === "ready") {
      setLines(["Welcome to the Cloud Manager Sandbox", "AWS CLI, Terraform, and kubectl are pre-configured.", "Type 'help' for available commands.", ""])
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [status])

  const handleCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim()
    if (!trimmed) return
    if (trimmed === "clear") { setLines([]); return }
    if (trimmed === "help") {
      setLines(prev => [...prev, `sandbox $ ${trimmed}`, "Available commands: aws, terraform, kubectl, gcloud, az, helm, docker, curl", "Type any supported CLI command to execute it.", ""])
      return
    }

    setLines(prev => [...prev, `sandbox $ ${trimmed}`])

    // Try real backend execution
    try {
      const resp = await fetch("/api/v1/learn/sandbox/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: trimmed }),
      })
      const data = await resp.json()
      const output = data.stdout || data.stderr || "No output"
      setLines(prev => [...prev, ...output.split("\n"), ""])
    } catch {
      // Fallback to local mock if backend unavailable
      const output = mockCommands[trimmed] ?? `bash: ${trimmed.split(" ")[0]}: command not found`
      setLines(prev => [...prev, ...output.split("\n"), ""])
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCommand(input)
      setInput("")
    }
  }

  if (status === "provisioning") {
    return (
      <div className="p-4 font-mono text-sm text-zinc-500" style={{ minHeight: 460 }}>
        <p>Provisioning sandbox environment...</p>
        <p className="mt-1 animate-pulse">Setting up AWS resources...</p>
      </div>
    )
  }

  if (status === "expired") {
    return (
      <div className="p-4 font-mono text-sm text-red-400" style={{ minHeight: 460 }}>
        <p>Environment expired.</p>
        <p className="text-zinc-500 mt-1">Your sandbox session has ended.</p>
      </div>
    )
  }

  return (
    <div
      ref={termRef}
      className="p-4 font-mono text-sm text-green-400 cursor-text overflow-auto"
      style={{ minHeight: 460, maxHeight: 460, fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
      onClick={() => inputRef.current?.focus()}
    >
      {lines.map((line, i) => (
        <div key={i} className={line.startsWith("sandbox $") ? "text-green-500" : "text-zinc-300"}>
          {line || "\u00A0"}
        </div>
      ))}
      <div className="flex items-center">
        <span className="text-green-500 shrink-0">sandbox $&nbsp;</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-green-400 outline-none caret-green-400"
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </div>
  )
}

export default function SandboxPage() {
  const [status, setStatus] = useState<EnvironmentStatus>("provisioning")
  const [timeRemaining, setTimeRemaining] = useState(3600) // 60 minutes
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    const timer = setTimeout(() => setStatus("ready"), 2000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (status !== "ready") return
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          setStatus("expired")
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [status])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  const completedTasks = tasks.filter((t) => t.verified).length
  const taskProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0

  const handleVerify = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, verified: true } : t))
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/learn">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Learning Center
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <Badge
            variant={status === "ready" ? "default" : status === "provisioning" ? "secondary" : "destructive"}
            className="gap-1"
          >
            {status === "provisioning" && <RefreshCw className="h-3 w-3 animate-spin" />}
            {status === "ready" && <CheckCircle className="h-3 w-3" />}
            {status === "provisioning" ? "Provisioning..." : status === "ready" ? "Ready" : "Expired"}
          </Badge>
          {status === "ready" && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(timeRemaining)} remaining
            </Badge>
          )}
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sandbox Environment</h1>
        <p className="text-muted-foreground mt-1">
          Hands-on practice environment for cloud infrastructure exercises.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Terminal area */}
        <div className="lg:col-span-2">
          <div className="bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden" style={{ minHeight: 500 }}>
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-xs text-zinc-400 ml-2">Sandbox Terminal</span>
            </div>
            <SandboxTerminal status={status} />
          </div>
        </div>

        {/* Task checklist */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Task Progress</CardTitle>
              <CardDescription>
                {completedTasks} of {tasks.length} tasks completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={taskProgress} className="h-2 mb-4" />
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-2">
                    {task.verified ? (
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`text-sm ${task.verified ? "line-through text-muted-foreground" : ""}`}>
                        {task.title}
                      </p>
                      {!task.verified && status === "ready" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-1 h-7 text-xs"
                          onClick={() => handleVerify(task.id)}
                        >
                          Verify
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {status === "expired" && (
            <Button className="w-full" onClick={() => { setStatus("provisioning"); setTimeRemaining(3600); setTimeout(() => setStatus("ready"), 2000) }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Start New Session
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

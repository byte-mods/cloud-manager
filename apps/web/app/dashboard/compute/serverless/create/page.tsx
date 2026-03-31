"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Plus,
  Trash2,
  Code,
  Globe,
  Clock,
  Zap,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

type TriggerType = "http" | "schedule" | "event"

type EnvVar = {
  key: string
  value: string
}

type FormState = {
  name: string
  runtime: string
  memory: number
  timeout: number
  triggerType: TriggerType
  triggerConfig: string
  envVars: EnvVar[]
  code: string
}

const runtimes = [
  { value: "nodejs20.x", label: "Node.js 20.x" },
  { value: "nodejs18.x", label: "Node.js 18.x" },
  { value: "python3.12", label: "Python 3.12" },
  { value: "python3.11", label: "Python 3.11" },
  { value: "go1.x", label: "Go 1.x" },
  { value: "java17", label: "Java 17" },
  { value: "dotnet6", label: ".NET 6" },
  { value: "rust", label: "Rust (Custom)" },
]

const memoryOptions = [128, 256, 512, 1024, 2048, 3072, 4096, 8192, 10240]

export default function CreateServerlessFunctionPage() {
  const { data: regions } = useQuery({ queryKey: ['regions'], queryFn: () => apiClient.get('/v1/cloud/aws/compute/instances'), enabled: false })
  const router = useRouter()
  const [formState, setFormState] = useState<FormState>({
    name: "",
    runtime: "",
    memory: 256,
    timeout: 30,
    triggerType: "http",
    triggerConfig: "",
    envVars: [],
    code: "// Write your function code here\nexport async function handler(event, context) {\n  return {\n    statusCode: 200,\n    body: JSON.stringify({ message: 'Hello from Cloud Manager!' }),\n  };\n}\n",
  })

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setFormState((prev) => ({ ...prev, [key]: value }))
  }

  const addEnvVar = () => {
    updateField("envVars", [...formState.envVars, { key: "", value: "" }])
  }

  const removeEnvVar = (index: number) => {
    updateField(
      "envVars",
      formState.envVars.filter((_, i) => i !== index)
    )
  }

  const updateEnvVar = (index: number, field: "key" | "value", value: string) => {
    const updated = [...formState.envVars]
    updated[index] = { ...updated[index], [field]: value }
    updateField("envVars", updated)
  }

  const isValid =
    formState.name.trim() !== "" &&
    formState.runtime !== "" &&
    formState.memory > 0 &&
    formState.timeout > 0

  const handleCreate = () => {
    if (!isValid) return
    // In a real app, this would submit to the API
    router.push("/dashboard/compute/serverless")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/compute/serverless")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Functions
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Function</h1>
        <p className="text-muted-foreground mt-1">
          Create a new serverless function with triggers and configuration.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Configuration</CardTitle>
            <CardDescription>
              Set the function name, runtime, and resource limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fn-name">Function Name</Label>
              <Input
                id="fn-name"
                placeholder="my-function"
                value={formState.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="runtime">Runtime</Label>
              <Select
                value={formState.runtime}
                onValueChange={(v) => updateField("runtime", v)}
              >
                <SelectTrigger id="runtime">
                  <SelectValue placeholder="Select runtime" />
                </SelectTrigger>
                <SelectContent>
                  {runtimes.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>
                      {rt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="memory">Memory (MB)</Label>
                <Select
                  value={String(formState.memory)}
                  onValueChange={(v) => updateField("memory", parseInt(v))}
                >
                  <SelectTrigger id="memory">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {memoryOptions.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m >= 1024 ? `${m / 1024} GB` : `${m} MB`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeout">Timeout (seconds)</Label>
                <Input
                  id="timeout"
                  type="number"
                  min={1}
                  max={900}
                  value={formState.timeout}
                  onChange={(e) =>
                    updateField("timeout", parseInt(e.target.value) || 1)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trigger Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Trigger Configuration</CardTitle>
            <CardDescription>
              Configure how the function is invoked
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { type: "http" as TriggerType, icon: Globe, label: "HTTP" },
                  { type: "schedule" as TriggerType, icon: Clock, label: "Schedule" },
                  { type: "event" as TriggerType, icon: Zap, label: "Event" },
                ] as const
              ).map(({ type, icon: Icon, label }) => (
                <div
                  key={type}
                  className={`cursor-pointer rounded-lg border-2 p-4 text-center transition-colors hover:border-primary/50 ${
                    formState.triggerType === type
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                  onClick={() => updateField("triggerType", type)}
                >
                  <Icon className="h-6 w-6 mx-auto mb-2" />
                  <p className="text-sm font-medium">{label}</p>
                </div>
              ))}
            </div>

            {formState.triggerType === "http" && (
              <div className="space-y-2">
                <Label>HTTP Method & Path</Label>
                <div className="flex gap-2">
                  <Select defaultValue="GET">
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                      <SelectItem value="ANY">ANY</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="/api/my-endpoint"
                    value={formState.triggerConfig}
                    onChange={(e) =>
                      updateField("triggerConfig", e.target.value)
                    }
                  />
                </div>
              </div>
            )}

            {formState.triggerType === "schedule" && (
              <div className="space-y-2">
                <Label>Cron Expression</Label>
                <Input
                  placeholder="cron(0 12 * * ? *)"
                  value={formState.triggerConfig}
                  onChange={(e) =>
                    updateField("triggerConfig", e.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Example: cron(0 12 * * ? *) runs every day at noon UTC
                </p>
              </div>
            )}

            {formState.triggerType === "event" && (
              <div className="space-y-2">
                <Label>Event Source</Label>
                <Select
                  value={formState.triggerConfig}
                  onValueChange={(v) => updateField("triggerConfig", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select event source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="s3">S3 Bucket Event</SelectItem>
                    <SelectItem value="sqs">SQS Queue</SelectItem>
                    <SelectItem value="sns">SNS Topic</SelectItem>
                    <SelectItem value="dynamodb">DynamoDB Stream</SelectItem>
                    <SelectItem value="kinesis">Kinesis Stream</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Environment Variables */}
      <Card>
        <CardHeader>
          <CardTitle>Environment Variables</CardTitle>
          <CardDescription>
            Key-value pairs available to your function at runtime
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {formState.envVars.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No environment variables configured.
            </p>
          ) : (
            formState.envVars.map((env, index) => (
              <div key={index} className="flex items-center gap-3">
                <Input
                  placeholder="KEY"
                  value={env.key}
                  onChange={(e) => updateEnvVar(index, "key", e.target.value)}
                  className="max-w-[240px] font-mono"
                />
                <Input
                  placeholder="value"
                  value={env.value}
                  onChange={(e) =>
                    updateEnvVar(index, "value", e.target.value)
                  }
                  className="font-mono"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={() => removeEnvVar(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
          <Button variant="outline" size="sm" onClick={addEnvVar}>
            <Plus className="mr-1 h-3 w-3" />
            Add Variable
          </Button>
        </CardContent>
      </Card>

      {/* Code Editor Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Function Code
          </CardTitle>
          <CardDescription>
            Write or paste your function code below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            className="font-mono text-sm min-h-[300px] bg-muted/50"
            value={formState.code}
            onChange={(e) => updateField("code", e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/compute/serverless")}
        >
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={!isValid}>
          Create Function
        </Button>
      </div>
    </div>
  )
}

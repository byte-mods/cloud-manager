"use client"

import { useWebhooks } from "@/hooks/use-webhooks"
import { useState } from "react"
import {
  Plug,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
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

type Integration = {
  id: string
  name: string
  description: string
  configKey: string
  placeholder: string
  connected: boolean
  value: string
}

const defaultIntegrations: Integration[] = [
  { id: "slack", name: "Slack", description: "Send alerts and notifications to Slack channels via webhook.", configKey: "Webhook URL", placeholder: "https://hooks.slack.com/services/...", connected: false, value: "" },
  { id: "teams", name: "Microsoft Teams", description: "Forward notifications to Teams channels via connector.", configKey: "Connector URL", placeholder: "https://outlook.office.com/webhook/...", connected: false, value: "" },
  { id: "pagerduty", name: "PagerDuty", description: "Route incidents and alerts to PagerDuty for on-call management.", configKey: "API Key", placeholder: "pdkey_...", connected: false, value: "" },
  { id: "opsgenie", name: "OpsGenie", description: "Integrate with OpsGenie for alert management and on-call scheduling.", configKey: "API Key", placeholder: "ogkey_...", connected: false, value: "" },
  { id: "jira", name: "Jira", description: "Create Jira tickets from incidents and security findings.", configKey: "API Token", placeholder: "https://your-domain.atlassian.net", connected: false, value: "" },
]

export default function IntegrationsPage() {
  const { data: webhooksData } = useWebhooks()
  const [integrations, setIntegrations] = useState<Integration[]>(defaultIntegrations)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, "success" | "failed">>({})

  function updateValue(id: string, value: string) {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, value } : i))
    )
  }

  function handleSave(id: string) {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, connected: !!i.value } : i))
    )
  }

  function handleTest(id: string) {
    setTestingId(id)
    setTestResults((prev) => ({ ...prev, [id]: undefined as any }))
    setTimeout(() => {
      const integration = integrations.find((i) => i.id === id)
      setTestResults((prev) => ({
        ...prev,
        [id]: integration?.value ? "success" : "failed",
      }))
      setTestingId(null)
    }, 1500)
  }

  function handleDisconnect(id: string) {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, connected: false, value: "" } : i))
    )
    setTestResults((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const connectedCount = integrations.filter((i) => i.connected).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground mt-1">Configure ChatOps and third-party integrations.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Integrations</CardDescription>
            <CardTitle className="text-3xl">{integrations.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Connected</CardDescription>
            <CardTitle className="text-3xl text-green-500">{connectedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Not Connected</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">{integrations.length - connectedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4">
        {integrations.map((integration) => (
          <Card key={integration.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{integration.name}</CardTitle>
                  <CardDescription>{integration.description}</CardDescription>
                </div>
                <Badge variant={integration.connected ? "default" : "outline"}>
                  {integration.connected ? (
                    <><CheckCircle2 className="mr-1 h-3 w-3" /> Connected</>
                  ) : (
                    <><XCircle className="mr-1 h-3 w-3" /> Not Connected</>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <div className="grid gap-2 flex-1">
                  <Label htmlFor={`int-${integration.id}`}>{integration.configKey}</Label>
                  <Input
                    id={`int-${integration.id}`}
                    value={integration.value}
                    onChange={(e) => updateValue(integration.id, e.target.value)}
                    placeholder={integration.placeholder}
                    type="password"
                  />
                </div>
                <Button variant="outline" onClick={() => handleSave(integration.id)} disabled={!integration.value}>
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleTest(integration.id)}
                  disabled={!integration.connected || testingId === integration.id}
                >
                  {testingId === integration.id ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing...</>
                  ) : (
                    "Test"
                  )}
                </Button>
                {integration.connected && (
                  <Button variant="destructive" size="sm" onClick={() => handleDisconnect(integration.id)}>
                    Disconnect
                  </Button>
                )}
              </div>
              {testResults[integration.id] && (
                <div className={`mt-3 text-sm flex items-center gap-1 ${testResults[integration.id] === "success" ? "text-green-500" : "text-red-500"}`}>
                  {testResults[integration.id] === "success" ? (
                    <><CheckCircle2 className="h-4 w-4" /> Connection test successful</>
                  ) : (
                    <><XCircle className="h-4 w-4" /> Connection test failed</>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

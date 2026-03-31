"use client"

import { useNotificationPreferences } from "@/hooks/use-settings"
import { useState } from "react"
import { Bell, Mail, MessageSquare, Webhook, Clock, Phone } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Channel = {
  id: string
  name: string
  type: string
  icon: typeof Bell
  enabled: boolean
  endpoint: string
}

const initialChannels: Channel[] = [
  { id: "email", name: "Email", type: "email", icon: Mail, enabled: true, endpoint: "admin@cloudmanager.dev" },
  { id: "slack", name: "Slack", type: "webhook", icon: MessageSquare, enabled: true, endpoint: "https://hooks.slack.com/services/T.../B.../xxx" },
  { id: "pagerduty", name: "PagerDuty", type: "api", icon: Phone, enabled: false, endpoint: "" },
  { id: "webhook", name: "Custom Webhook", type: "webhook", icon: Webhook, enabled: false, endpoint: "" },
]

export default function NotificationSettingsPage() {
  const { data: prefs } = useNotificationPreferences()
  const [channels, setChannels] = useState(initialChannels)
  const [quietStart, setQuietStart] = useState("22:00")
  const [quietEnd, setQuietEnd] = useState("07:00")

  const toggleChannel = (id: string) => {
    setChannels(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c))
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground mt-1">Configure notification channels and alert routing.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>Configure where you receive alerts and notifications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {channels.map((channel) => (
            <div key={channel.id} className="flex items-start justify-between gap-4 pb-4 border-b last:border-0 last:pb-0">
              <div className="flex items-start gap-3">
                <div className="rounded-lg border p-2"><channel.icon className="h-4 w-4" /></div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{channel.name}</span>
                    <Badge variant={channel.enabled ? "default" : "secondary"}>{channel.enabled ? "Active" : "Disabled"}</Badge>
                  </div>
                  {channel.endpoint && <p className="text-xs text-muted-foreground mt-1 font-mono">{channel.endpoint}</p>}
                </div>
              </div>
              <Switch checked={channel.enabled} onCheckedChange={() => toggleChannel(channel.id)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alert Routing</CardTitle>
          <CardDescription>Configure which alerts go to which channels.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Critical Security Alerts", default: "all" },
            { label: "Cost Anomalies", default: "email" },
            { label: "Infrastructure Changes", default: "slack" },
            { label: "Deployment Status", default: "slack" },
            { label: "Compliance Violations", default: "all" },
            { label: "Performance Alerts", default: "email" },
          ].map((rule) => (
            <div key={rule.label} className="flex items-center justify-between">
              <span className="text-sm">{rule.label}</span>
              <Select defaultValue={rule.default}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="email">Email Only</SelectItem>
                  <SelectItem value="slack">Slack Only</SelectItem>
                  <SelectItem value="pagerduty">PagerDuty</SelectItem>
                  <SelectItem value="none">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" />Quiet Hours</CardTitle>
          <CardDescription>Suppress non-critical notifications during these hours.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="grid gap-2">
              <Label>Start</Label>
              <Input type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} className="w-32" />
            </div>
            <span className="mt-6 text-muted-foreground">to</span>
            <div className="grid gap-2">
              <Label>End</Label>
              <Input type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} className="w-32" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Critical alerts will still be delivered during quiet hours.</p>
        </CardContent>
      </Card>

      <div className="flex justify-end"><Button>Save Settings</Button></div>
    </div>
  )
}

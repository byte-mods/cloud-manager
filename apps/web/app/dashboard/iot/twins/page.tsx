"use client"

import { useState } from "react"
import { useDigitalTwins } from "@/hooks/use-iot"
import { useCloudProvider } from "@/hooks/use-cloud-provider"
import { Server } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

type DigitalTwin = {
  id: string
  deviceName: string
  provider: string
  service: string
  lastSync: string
  state: Record<string, unknown>
}

export default function DigitalTwinsPage() {
  const { provider } = useCloudProvider()
  const { data, isLoading, error } = useDigitalTwins(provider)

  const twins: DigitalTwin[] = (data?.twins ?? []).map((t) => ({
    id: t.id,
    deviceName: t.name,
    provider: provider,
    service: t.modelId,
    lastSync: t.lastUpdated,
    state: { ...t.properties, telemetry: t.telemetry },
  }))

  const [selectedTwin, setSelectedTwin] = useState<string | null>(null)
  const resolvedSelectedTwin = selectedTwin ?? twins[0]?.id ?? null

  const activeTwin = twins.find((t) => t.id === resolvedSelectedTwin)

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Digital Twins</h1>
          <p className="text-muted-foreground mt-1">View device shadows, twins, and state across AWS, Azure, and GCP.</p>
        </div>
        <div className="text-destructive text-sm">Failed to load digital twins. Please try again later.</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Digital Twins</h1>
        <p className="text-muted-foreground mt-1">
          View device shadows, twins, and state across AWS, Azure, and GCP.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Twin list */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : twins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No digital twins found</div>
          ) : (
            twins.map((twin) => (
              <Card
                key={twin.id}
                className={`cursor-pointer transition-colors ${resolvedSelectedTwin === twin.id ? "border-primary" : "hover:border-primary/50"}`}
                onClick={() => setSelectedTwin(twin.id)}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{twin.deviceName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{twin.provider}</Badge>
                        <span className="text-xs text-muted-foreground">{twin.service}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{twin.lastSync}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* State viewer */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {activeTwin ? `${activeTwin.deviceName} State` : "Select a device"}
            </CardTitle>
            {activeTwin && (
              <CardDescription>
                {activeTwin.service} - Last synced: {activeTwin.lastSync}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {activeTwin ? (
              <div className="rounded-lg overflow-hidden border">
                <div className="bg-zinc-900 px-4 py-2 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">JSON State</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-zinc-400 hover:text-zinc-200"
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(activeTwin.state, null, 2))}
                  >
                    Copy
                  </Button>
                </div>
                <pre className="bg-zinc-950 p-4 overflow-x-auto text-sm">
                  <code className="text-zinc-300 font-mono">
                    {JSON.stringify(activeTwin.state, null, 2)}
                  </code>
                </pre>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Select a device twin to view its state
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

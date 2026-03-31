"use client"

import { useMemo } from "react"
import {
  Server,
  Database,
  HardDrive,
  Globe,
  Shield,
  Zap,
  Container,
  Wifi,
  Cloud,
  BarChart3,
  Brain,
  MessageSquare,
  Network,
  X,
  Trash2,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Link2,
  Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  useInfrastructureStore,
  type ServiceNode,
  type ServiceType,
  type CloudProvider,
} from "@/stores/infrastructure-store"

const typeIcons: Record<ServiceType, React.ElementType> = {
  compute: Server,
  storage: HardDrive,
  database: Database,
  networking: Globe,
  security: Shield,
  serverless: Zap,
  container: Container,
  cdn: Wifi,
  dns: Network,
  loadbalancer: Cloud,
  queue: MessageSquare,
  cache: Database,
  ml: Brain,
  monitoring: BarChart3,
}

const providerBadgeColor: Record<CloudProvider, string> = {
  aws: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  gcp: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  azure: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  multi: "bg-purple-500/20 text-purple-400 border-purple-500/30",
}

const severityColors: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
}

function formatBytes(bytes: number): string {
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(1)}k`
  return `${bytes}`
}

export default function ConfigPanel() {
  const selectedNodeId = useInfrastructureStore(s => s.selectedNodeId)
  const currentProject = useInfrastructureStore(s => s.currentProject)
  const updateNodeConfig = useInfrastructureStore(s => s.updateNodeConfig)
  const updateNodeLabel = useInfrastructureStore(s => s.updateNodeLabel)
  const removeNode = useInfrastructureStore(s => s.removeNode)
  const setSelectedNodeId = useInfrastructureStore(s => s.setSelectedNodeId)

  const serviceNode = useMemo(() => {
    if (!currentProject || !selectedNodeId) return null
    const node = currentProject.nodes.find(n => n.id === selectedNodeId)
    return node ? (node.data.serviceNode as ServiceNode) : null
  }, [currentProject, selectedNodeId])

  const connections = useMemo(() => {
    if (!currentProject || !selectedNodeId) return []
    return currentProject.edges
      .filter(e => e.source === selectedNodeId || e.target === selectedNodeId)
      .map(e => {
        const isSource = e.source === selectedNodeId
        const otherId = isSource ? e.target : e.source
        const otherNode = currentProject.nodes.find(n => n.id === otherId)
        const otherSn = otherNode ? (otherNode.data.serviceNode as ServiceNode) : null
        return {
          edgeId: e.id,
          direction: isSource ? "outbound" as const : "inbound" as const,
          otherName: otherSn?.serviceName ?? "Unknown",
          otherLabel: otherSn?.label ?? "",
          protocol: (e.data?.protocol as string) ?? "TCP",
          port: (e.data?.port as number) ?? 0,
          encrypted: (e.data?.encrypted as boolean) ?? false,
          trafficRate: (e.data?.trafficRate as number) ?? 0,
        }
      })
  }, [currentProject, selectedNodeId])

  if (!serviceNode) return null

  const Icon = typeIcons[serviceNode.type] ?? Server
  const config = serviceNode.config ?? {}

  return (
    <div className="w-[320px] border-l bg-card/50 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b flex items-start gap-3">
        <div className="rounded-lg p-2 bg-accent/50 shrink-0">
          <Icon className="h-5 w-5 text-foreground/80" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{serviceNode.serviceName}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge className={`text-[10px] px-1.5 py-0 h-4 border ${providerBadgeColor[serviceNode.provider]}`}>
              {serviceNode.provider.toUpperCase()}
            </Badge>
            <span className="text-[10px] text-muted-foreground capitalize">{serviceNode.type}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => setSelectedNodeId(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="config" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 h-8 p-0.5">
          <TabsTrigger value="config" className="text-xs h-7 flex-1">Config</TabsTrigger>
          <TabsTrigger value="security" className="text-xs h-7 flex-1">
            Security
            {(serviceNode.securityIssues?.length ?? 0) > 0 && (
              <span className="ml-1 bg-red-500/20 text-red-400 text-[9px] rounded-full px-1.5">
                {serviceNode.securityIssues.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="traffic" className="text-xs h-7 flex-1">Traffic</TabsTrigger>
          <TabsTrigger value="connections" className="text-xs h-7 flex-1">Links</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 mt-1">
          {/* Config Tab */}
          <TabsContent value="config" className="px-3 pb-3 space-y-3 mt-0">
            <div className="space-y-1.5">
              <Label className="text-xs">Display Name</Label>
              <Input
                value={serviceNode.label}
                onChange={e => updateNodeLabel(serviceNode.id, e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <Separator />

            {/* Dynamic fields based on service type */}
            {(serviceNode.type === "compute" || serviceNode.type === "container") && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Instance Type</Label>
                  <Input
                    value={config.instanceType ?? config.machineType ?? config.vmSize ?? config.nodeType ?? ""}
                    onChange={e => {
                      const key = config.instanceType !== undefined ? "instanceType"
                        : config.machineType !== undefined ? "machineType"
                        : config.vmSize !== undefined ? "vmSize"
                        : "nodeType"
                      updateNodeConfig(serviceNode.id, { [key]: e.target.value })
                    }}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Region</Label>
                  <Input
                    value={config.region ?? ""}
                    onChange={e => updateNodeConfig(serviceNode.id, { region: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                {config.count !== undefined && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Count</Label>
                    <Input
                      type="number"
                      value={config.count ?? 1}
                      onChange={e => updateNodeConfig(serviceNode.id, { count: parseInt(e.target.value) || 1 })}
                      className="h-8 text-xs"
                    />
                  </div>
                )}
                {config.os !== undefined && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Operating System</Label>
                    <Input
                      value={config.os ?? ""}
                      onChange={e => updateNodeConfig(serviceNode.id, { os: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                )}
                {config.nodeCount !== undefined && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Node Count</Label>
                    <Input
                      type="number"
                      value={config.nodeCount ?? 3}
                      onChange={e => updateNodeConfig(serviceNode.id, { nodeCount: parseInt(e.target.value) || 1 })}
                      className="h-8 text-xs"
                    />
                  </div>
                )}
              </>
            )}

            {serviceNode.type === "storage" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Storage Class</Label>
                  <Select
                    value={config.storageClass ?? config.tier ?? "STANDARD"}
                    onValueChange={v => updateNodeConfig(serviceNode.id, config.storageClass !== undefined ? { storageClass: v } : { tier: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STANDARD">Standard</SelectItem>
                      <SelectItem value="NEARLINE">Nearline / IA</SelectItem>
                      <SelectItem value="COLDLINE">Coldline / Glacier</SelectItem>
                      <SelectItem value="Hot">Hot</SelectItem>
                      <SelectItem value="Cool">Cool</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Size (GB)</Label>
                  <Input
                    type="number"
                    value={config.sizeGb ?? config.capacityGb ?? 100}
                    onChange={e => updateNodeConfig(serviceNode.id, config.sizeGb !== undefined ? { sizeGb: parseInt(e.target.value) || 0 } : { capacityGb: parseInt(e.target.value) || 0 })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Versioning</Label>
                  <Switch
                    checked={config.versioning ?? false}
                    onCheckedChange={v => updateNodeConfig(serviceNode.id, { versioning: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Encryption</Label>
                  <Switch
                    checked={config.encryption ?? false}
                    onCheckedChange={v => updateNodeConfig(serviceNode.id, { encryption: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Public Access</Label>
                  <Switch
                    checked={config.publicAccess ?? false}
                    onCheckedChange={v => updateNodeConfig(serviceNode.id, { publicAccess: v })}
                  />
                </div>
              </>
            )}

            {(serviceNode.type === "database" || serviceNode.type === "cache") && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Engine</Label>
                  <Input
                    value={config.engine ?? config.api ?? ""}
                    onChange={e => updateNodeConfig(serviceNode.id, config.engine !== undefined ? { engine: e.target.value } : { api: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                {config.version !== undefined && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Version</Label>
                    <Input
                      value={config.version ?? ""}
                      onChange={e => updateNodeConfig(serviceNode.id, { version: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                )}
                {(config.instanceClass !== undefined || config.tier !== undefined || config.nodeType !== undefined) && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Instance Class</Label>
                    <Input
                      value={config.instanceClass ?? config.tier ?? config.nodeType ?? ""}
                      onChange={e => {
                        const key = config.instanceClass !== undefined ? "instanceClass"
                          : config.tier !== undefined ? "tier" : "nodeType"
                        updateNodeConfig(serviceNode.id, { [key]: e.target.value })
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                )}
                {config.storageGb !== undefined && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Storage (GB)</Label>
                    <Input
                      type="number"
                      value={config.storageGb ?? 100}
                      onChange={e => updateNodeConfig(serviceNode.id, { storageGb: parseInt(e.target.value) || 0 })}
                      className="h-8 text-xs"
                    />
                  </div>
                )}
                {config.multiAz !== undefined && (
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Multi-AZ</Label>
                    <Switch
                      checked={config.multiAz ?? false}
                      onCheckedChange={v => updateNodeConfig(serviceNode.id, { multiAz: v })}
                    />
                  </div>
                )}
                {config.encryption !== undefined && (
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Encryption</Label>
                    <Switch
                      checked={config.encryption ?? false}
                      onCheckedChange={v => updateNodeConfig(serviceNode.id, { encryption: v })}
                    />
                  </div>
                )}
              </>
            )}

            {serviceNode.type === "networking" && (
              <>
                {config.cidrBlock !== undefined && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">CIDR Block</Label>
                    <Input
                      value={config.cidrBlock ?? ""}
                      onChange={e => updateNodeConfig(serviceNode.id, { cidrBlock: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                )}
                {config.region !== undefined && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Region</Label>
                    <Input
                      value={config.region ?? ""}
                      onChange={e => updateNodeConfig(serviceNode.id, { region: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                )}
                {config.azCount !== undefined && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Availability Zones</Label>
                    <Input
                      type="number"
                      value={config.azCount ?? 2}
                      onChange={e => updateNodeConfig(serviceNode.id, { azCount: parseInt(e.target.value) || 1 })}
                      className="h-8 text-xs"
                    />
                  </div>
                )}
              </>
            )}

            {serviceNode.type === "serverless" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Runtime</Label>
                  <Input
                    value={config.runtime ?? ""}
                    onChange={e => updateNodeConfig(serviceNode.id, { runtime: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Memory (MB)</Label>
                  <Input
                    type="number"
                    value={config.memory ?? 256}
                    onChange={e => updateNodeConfig(serviceNode.id, { memory: parseInt(e.target.value) || 128 })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Timeout (sec)</Label>
                  <Input
                    type="number"
                    value={config.timeout ?? 30}
                    onChange={e => updateNodeConfig(serviceNode.id, { timeout: parseInt(e.target.value) || 30 })}
                    className="h-8 text-xs"
                  />
                </div>
              </>
            )}

            {/* Generic key-value fallback for other config fields */}
            {serviceNode.type === "security" && Object.entries(config).map(([key, val]) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs capitalize">{key.replace(/([A-Z])/g, " $1")}</Label>
                <Input
                  value={String(val)}
                  onChange={e => updateNodeConfig(serviceNode.id, { [key]: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            ))}

            <Separator />

            <div className="flex items-center justify-between rounded-md bg-accent/30 px-3 py-2">
              <span className="text-xs text-muted-foreground">Est. Monthly Cost</span>
              <span className="text-sm font-semibold text-foreground">
                ${serviceNode.estimatedMonthlyCost?.toFixed(2) ?? "0.00"}
              </span>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="px-3 pb-3 mt-0">
            {(serviceNode.securityIssues?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Shield className="h-8 w-8 text-green-500/50 mb-2" />
                <p className="text-xs text-muted-foreground">No security issues detected</p>
              </div>
            ) : (
              <div className="space-y-2">
                {serviceNode.securityIssues.map(issue => (
                  <div
                    key={issue.id}
                    className="flex items-start gap-2.5 rounded-md border border-border/50 p-2.5"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">{issue.message}</p>
                      <Badge className={`text-[9px] px-1.5 py-0 h-4 mt-1 border ${severityColors[issue.severity]}`}>
                        {issue.severity.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Traffic Tab */}
          <TabsContent value="traffic" className="px-3 pb-3 mt-0">
            <div className="space-y-3">
              <div className="rounded-md border border-border/50 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowDownRight className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-xs text-muted-foreground">Traffic In</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {formatBytes(serviceNode.trafficIn ?? 0)} req/s
                  </span>
                </div>
                {/* Mini sparkline bar */}
                <div className="h-2 rounded-full bg-accent/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500/60 transition-all duration-1000"
                    style={{ width: `${Math.min(100, ((serviceNode.trafficIn ?? 0) / 5000) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-md border border-border/50 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs text-muted-foreground">Traffic Out</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {formatBytes(serviceNode.trafficOut ?? 0)} req/s
                  </span>
                </div>
                <div className="h-2 rounded-full bg-accent/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500/60 transition-all duration-1000"
                    style={{ width: `${Math.min(100, ((serviceNode.trafficOut ?? 0) / 5000) * 100)}%` }}
                  />
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground text-center">
                Traffic values are simulated and update every 2 seconds.
              </p>
            </div>
          </TabsContent>

          {/* Connections Tab */}
          <TabsContent value="connections" className="px-3 pb-3 mt-0">
            {connections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Link2 className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No connections yet</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Drag from a handle to another node to connect.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {connections.map(conn => (
                  <div
                    key={conn.edgeId}
                    className="flex items-start gap-2.5 rounded-md border border-border/50 p-2.5"
                  >
                    {conn.direction === "outbound" ? (
                      <ArrowUpRight className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        {conn.otherName}
                        {conn.otherLabel ? ` (${conn.otherLabel})` : ""}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                          {conn.protocol}:{conn.port}
                        </Badge>
                        {conn.encrypted && (
                          <Badge className="text-[9px] px-1 py-0 h-3.5 bg-purple-500/15 text-purple-400 border-purple-500/25">
                            <Lock className="h-2 w-2 mr-0.5" />
                            TLS
                          </Badge>
                        )}
                        <span className="text-[9px] text-muted-foreground">
                          {formatBytes(conn.trafficRate)} req/s
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Delete button */}
      <div className="p-3 border-t">
        <Button
          variant="destructive"
          size="sm"
          className="w-full text-xs h-8"
          onClick={() => {
            removeNode(serviceNode.id)
          }}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Remove Service
        </Button>
      </div>
    </div>
  )
}

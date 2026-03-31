"use client"

import { useState, useMemo, type DragEvent } from "react"
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
  Search,
  ChevronDown,
  ChevronRight,
  GripVertical,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  SERVICE_CATALOG,
  SERVICE_CATEGORIES,
  type ServiceDefinition,
  type ServiceType,
  type CloudProvider,
} from "@/stores/infrastructure-store"

const typeIcons: Record<ServiceType | string, React.ElementType> = {
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

const categoryIcons: Record<string, React.ElementType> = {
  Compute: Server,
  Storage: HardDrive,
  Database: Database,
  Networking: Globe,
  Security: Shield,
  Integration: MessageSquare,
  "AI/ML": Brain,
  Monitoring: BarChart3,
}

const providerBadge: Record<string, string> = {
  aws: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  gcp: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  azure: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
}

export default function ServicePalette() {
  const [search, setSearch] = useState("")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const filteredServices = useMemo(() => {
    return SERVICE_CATALOG.filter(s => {
      if (providerFilter !== "all" && s.provider !== providerFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          s.serviceName.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.type.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [search, providerFilter])

  const grouped = useMemo(() => {
    const map: Record<string, ServiceDefinition[]> = {}
    for (const cat of SERVICE_CATEGORIES) {
      const items = filteredServices.filter(s => s.category === cat)
      if (items.length > 0) map[cat] = items
    }
    return map
  }, [filteredServices])

  const onDragStart = (event: DragEvent, service: ServiceDefinition) => {
    event.dataTransfer.setData("application/reactflow", JSON.stringify(service))
    event.dataTransfer.effectAllowed = "move"
  }

  const toggleCategory = (cat: string) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  return (
    <div className="w-[280px] border-r bg-card/50 flex flex-col h-full">
      <div className="p-3 border-b space-y-2.5">
        <h3 className="text-sm font-semibold text-foreground">Services</h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search services..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Tabs value={providerFilter} onValueChange={setProviderFilter}>
          <TabsList className="w-full h-7 p-0.5">
            <TabsTrigger value="all" className="text-[10px] h-6 flex-1">All</TabsTrigger>
            <TabsTrigger value="aws" className="text-[10px] h-6 flex-1">AWS</TabsTrigger>
            <TabsTrigger value="gcp" className="text-[10px] h-6 flex-1">GCP</TabsTrigger>
            <TabsTrigger value="azure" className="text-[10px] h-6 flex-1">Azure</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {Object.entries(grouped).map(([category, services]) => {
            const CatIcon = categoryIcons[category] ?? Server
            const isCollapsed = collapsed[category]
            return (
              <div key={category}>
                <button
                  onClick={() => toggleCategory(category)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <CatIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">{category}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{services.length}</span>
                </button>
                {!isCollapsed && (
                  <div className="ml-2 space-y-0.5 mt-0.5">
                    {services.map(service => {
                      const SIcon = typeIcons[service.type] ?? Server
                      return (
                        <div
                          key={`${service.provider}-${service.serviceName}`}
                          draggable
                          onDragStart={e => onDragStart(e, service)}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing
                            hover:bg-accent/60 transition-colors group border border-transparent hover:border-border/50"
                        >
                          <GripVertical className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground/70 shrink-0" />
                          <SIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-foreground truncate flex-1">
                            {service.serviceName}
                          </span>
                          <Badge
                            className={`text-[9px] px-1 py-0 h-3.5 font-medium border shrink-0 ${providerBadge[service.provider] ?? ""}`}
                          >
                            {service.provider.toUpperCase()}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          {Object.keys(grouped).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              No services match your filters.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

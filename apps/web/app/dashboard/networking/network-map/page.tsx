"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import {
  Globe,
  ArrowDownUp,
  Shield,
  Database,
  Server,
  HardDrive,
  Network,
  Cloud,
  Filter,
  X,
  Wifi,
  Activity,
  Layers,
  Container,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { VpcNode, type VpcNodeData } from "@/components/networking/vpc-node"
import { SubnetNode, type SubnetNodeData } from "@/components/networking/subnet-node"
import { useDependencyGraph } from "@/hooks/use-dependencies"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Provider = "aws" | "gcp" | "azure"

type ServiceNodeData = {
  label: string
  type: "ec2" | "rds" | "elasticache" | "alb" | "gce" | "cloudsql" | "memorystore" | "cloudlb" | "vm" | "azuresql" | "aks" | "azurelb" | "igw" | "nat"
  provider: Provider
  ip: string
  status: "healthy" | "warning" | "error"
}

type NetworkDetail = {
  id: string
  name: string
  type: string
  ip: string
  routes: string[]
  securityRules: { direction: string; port: string; source: string; action: string }[]
  trafficMetrics: { inbound: string; outbound: string; latency: string }
  connectedNodes: { name: string; latency: string }[]
}

// ---------------------------------------------------------------------------
// Provider colors
// ---------------------------------------------------------------------------

const providerColors: Record<Provider, { node: string; edge: string }> = {
  aws: { node: "#f97316", edge: "#fb923c" },
  gcp: { node: "#3b82f6", edge: "#60a5fa" },
  azure: { node: "#8b5cf6", edge: "#a78bfa" },
}

// ---------------------------------------------------------------------------
// Service node icons
// ---------------------------------------------------------------------------

const serviceIcons: Record<string, typeof Server> = {
  ec2: Server,
  gce: Server,
  vm: Server,
  rds: Database,
  cloudsql: Database,
  azuresql: Database,
  elasticache: Zap,
  memorystore: Zap,
  alb: Network,
  cloudlb: Network,
  azurelb: Network,
  aks: Container,
  igw: Globe,
  nat: ArrowDownUp,
}

// ---------------------------------------------------------------------------
// Custom service node
// ---------------------------------------------------------------------------

function ServiceNodeComponent({ data }: NodeProps) {
  const d = data as unknown as ServiceNodeData
  const Icon = serviceIcons[d.type] || Cloud
  const statusColor =
    d.status === "healthy"
      ? "bg-green-500"
      : d.status === "warning"
        ? "bg-yellow-500"
        : "bg-red-500"

  return (
    <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2.5 py-1.5 min-w-[130px] shadow-sm">
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-gray-400" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-gray-400" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-gray-400" />

      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] font-semibold truncate flex-1">{d.label}</span>
        <div className={`h-2 w-2 rounded-full shrink-0 ${statusColor}`} />
      </div>
      <div className="text-[9px] text-muted-foreground mt-0.5">{d.ip}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Gateway node
// ---------------------------------------------------------------------------

function GatewayNodeComponent({ data }: NodeProps) {
  const d = data as unknown as ServiceNodeData
  const Icon = d.type === "igw" ? Globe : ArrowDownUp

  return (
    <div className="rounded-full border-2 border-cyan-400 dark:border-cyan-600 bg-cyan-50 dark:bg-cyan-950/40 px-4 py-2.5 flex items-center gap-2 shadow-md">
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-cyan-400" />
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-cyan-400" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2.5 !h-2.5 !bg-cyan-400" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2.5 !h-2.5 !bg-cyan-400" />

      <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
      <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">{d.label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Node types
// ---------------------------------------------------------------------------

const nodeTypes = {
  vpc: VpcNode,
  subnet: SubnetNode,
  service: ServiceNodeComponent,
  gateway: GatewayNodeComponent,
}

// ---------------------------------------------------------------------------
// Seed topology data
// ---------------------------------------------------------------------------

function buildTopology(providerFilter: string, regionFilter: string, showTraffic: boolean) {
  const nodes: Node[] = []
  const edges: Edge[] = []

  // Helpers
  let nextId = 1
  const id = (prefix: string) => `${prefix}-${nextId++}`

  // ── Internet Gateway ──────────────────────────────────────────────────
  const igwId = "igw-1"
  nodes.push({
    id: igwId,
    type: "gateway",
    position: { x: 600, y: 10 },
    data: { label: "Internet Gateway", type: "igw", provider: "aws", ip: "0.0.0.0/0", status: "healthy" },
  })

  // ── NAT Gateway ───────────────────────────────────────────────────────
  const natId = "nat-1"
  nodes.push({
    id: natId,
    type: "gateway",
    position: { x: 250, y: 100 },
    data: { label: "NAT Gateway", type: "nat", provider: "aws", ip: "10.0.0.5", status: "healthy" },
  })

  edges.push({
    id: "e-igw-nat",
    source: igwId,
    target: natId,
    style: { stroke: "#06b6d4", strokeWidth: 2 },
    animated: showTraffic,
    label: showTraffic ? "340 Mbps" : undefined,
    labelStyle: { fontSize: 9, fill: "#6b7280" },
  })

  // ══════════════════════════════════════════════════════════════════════
  // AWS prod-vpc
  // ══════════════════════════════════════════════════════════════════════
  if (providerFilter === "all" || providerFilter === "aws") {
    const vpcProdId = "vpc-aws-prod"
    nodes.push({
      id: vpcProdId,
      type: "vpc",
      position: { x: 20, y: 180 },
      data: { label: "prod-vpc", cidr: "10.0.0.0/16", region: "us-east-1", provider: "aws", subnetCount: 4 } satisfies VpcNodeData,
    })

    // Subnets
    const pubSub1 = "sub-aws-pub-1a"
    const pubSub2 = "sub-aws-pub-1b"
    const priSub1 = "sub-aws-pri-1a"
    const priSub2 = "sub-aws-pri-1b"

    nodes.push(
      { id: pubSub1, type: "subnet", position: { x: 40, y: 310 }, data: { label: "public-1a", cidr: "10.0.1.0/24", az: "us-east-1a", isPublic: true, provider: "aws" } satisfies SubnetNodeData },
      { id: pubSub2, type: "subnet", position: { x: 260, y: 310 }, data: { label: "public-1b", cidr: "10.0.2.0/24", az: "us-east-1b", isPublic: true, provider: "aws" } satisfies SubnetNodeData },
      { id: priSub1, type: "subnet", position: { x: 40, y: 580 }, data: { label: "private-1a", cidr: "10.0.10.0/24", az: "us-east-1a", isPublic: false, provider: "aws" } satisfies SubnetNodeData },
      { id: priSub2, type: "subnet", position: { x: 260, y: 580 }, data: { label: "private-1b", cidr: "10.0.11.0/24", az: "us-east-1b", isPublic: false, provider: "aws" } satisfies SubnetNodeData },
    )

    // VPC → subnet edges
    edges.push(
      { id: "e-vpc-pub1", source: vpcProdId, target: pubSub1, style: { stroke: "#fb923c", strokeWidth: 1 } },
      { id: "e-vpc-pub2", source: vpcProdId, target: pubSub2, style: { stroke: "#fb923c", strokeWidth: 1 } },
      { id: "e-vpc-pri1", source: vpcProdId, target: priSub1, style: { stroke: "#fb923c", strokeWidth: 1 } },
      { id: "e-vpc-pri2", source: vpcProdId, target: priSub2, style: { stroke: "#fb923c", strokeWidth: 1 } },
    )

    // IGW → VPC
    edges.push({
      id: "e-igw-vpc-prod",
      source: igwId,
      target: vpcProdId,
      style: { stroke: "#06b6d4", strokeWidth: 2 },
      animated: showTraffic,
      label: showTraffic ? "1.2 Gbps" : undefined,
      labelStyle: { fontSize: 9, fill: "#6b7280" },
    })

    // Services
    const albId = "svc-alb"
    const ec2a = "svc-ec2-a"
    const ec2b = "svc-ec2-b"
    const rdsId = "svc-rds"
    const cacheId = "svc-cache"

    nodes.push(
      { id: albId, type: "service", position: { x: 80, y: 420 }, data: { label: "prod-alb", type: "alb", provider: "aws", ip: "10.0.1.10", status: "healthy" } satisfies ServiceNodeData },
      { id: ec2a, type: "service", position: { x: 40, y: 490 }, data: { label: "web-server-1", type: "ec2", provider: "aws", ip: "10.0.1.20", status: "healthy" } satisfies ServiceNodeData },
      { id: ec2b, type: "service", position: { x: 260, y: 490 }, data: { label: "web-server-2", type: "ec2", provider: "aws", ip: "10.0.2.20", status: "warning" } satisfies ServiceNodeData },
      { id: rdsId, type: "service", position: { x: 60, y: 680 }, data: { label: "prod-db (RDS)", type: "rds", provider: "aws", ip: "10.0.10.50", status: "healthy" } satisfies ServiceNodeData },
      { id: cacheId, type: "service", position: { x: 280, y: 680 }, data: { label: "prod-cache", type: "elasticache", provider: "aws", ip: "10.0.11.50", status: "healthy" } satisfies ServiceNodeData },
    )

    // Service edges
    edges.push(
      { id: "e-alb-ec2a", source: albId, target: ec2a, style: { stroke: "#22c55e", strokeWidth: 1.5 }, animated: showTraffic, label: showTraffic ? "420 Mbps" : undefined, labelStyle: { fontSize: 9, fill: "#6b7280" } },
      { id: "e-alb-ec2b", source: albId, target: ec2b, style: { stroke: "#22c55e", strokeWidth: 1.5 }, animated: showTraffic, label: showTraffic ? "380 Mbps" : undefined, labelStyle: { fontSize: 9, fill: "#6b7280" } },
      { id: "e-ec2a-rds", source: ec2a, target: rdsId, style: { stroke: "#22c55e", strokeWidth: 1.5 }, animated: showTraffic, label: showTraffic ? "150 Mbps" : undefined, labelStyle: { fontSize: 9, fill: "#6b7280" } },
      { id: "e-ec2b-rds", source: ec2b, target: rdsId, style: { stroke: "#eab308", strokeWidth: 1.5 }, animated: showTraffic, label: showTraffic ? "12ms" : undefined, labelStyle: { fontSize: 9, fill: "#6b7280" } },
      { id: "e-ec2a-cache", source: ec2a, target: cacheId, style: { stroke: "#22c55e", strokeWidth: 1.5 }, animated: showTraffic },
      { id: "e-ec2b-cache", source: ec2b, target: cacheId, style: { stroke: "#22c55e", strokeWidth: 1.5 }, animated: showTraffic },
      { id: "e-pub1-alb", source: pubSub1, target: albId, style: { stroke: "#fb923c", strokeWidth: 1 } },
    )

    // ── AWS dev-vpc ─────────────────────────────────────────────────────
    const vpcDevId = "vpc-aws-dev"
    nodes.push({
      id: vpcDevId,
      type: "vpc",
      position: { x: 20, y: 810 },
      data: { label: "dev-vpc", cidr: "172.16.0.0/16", region: "us-east-1", provider: "aws", subnetCount: 1 } satisfies VpcNodeData,
    })

    const devSub = "sub-aws-dev"
    nodes.push({
      id: devSub,
      type: "subnet",
      position: { x: 40, y: 920 },
      data: { label: "dev-subnet", cidr: "172.16.1.0/24", az: "us-east-1a", isPublic: false, provider: "aws" } satisfies SubnetNodeData,
    })

    const devEc2 = "svc-dev-ec2"
    nodes.push({
      id: devEc2,
      type: "service",
      position: { x: 60, y: 1010 },
      data: { label: "dev-instance", type: "ec2", provider: "aws", ip: "172.16.1.10", status: "healthy" } satisfies ServiceNodeData,
    })

    edges.push(
      { id: "e-devvpc-sub", source: vpcDevId, target: devSub, style: { stroke: "#fb923c", strokeWidth: 1 } },
      { id: "e-devsub-ec2", source: devSub, target: devEc2, style: { stroke: "#22c55e", strokeWidth: 1 } },
    )

    // Peering: prod-vpc ↔ dev-vpc
    edges.push({
      id: "e-peer-prod-dev",
      source: vpcProdId,
      target: vpcDevId,
      sourceHandle: "right",
      targetHandle: "right",
      style: { stroke: "#f59e0b", strokeWidth: 2, strokeDasharray: "6 3" },
      animated: showTraffic,
      label: showTraffic ? "Peering: 45 Mbps" : "VPC Peering",
      labelStyle: { fontSize: 9, fill: "#f59e0b" },
    })
  }

  // ══════════════════════════════════════════════════════════════════════
  // GCP gcp-main-vpc
  // ══════════════════════════════════════════════════════════════════════
  if (providerFilter === "all" || providerFilter === "gcp") {
    const gcpVpcId = "vpc-gcp-main"
    nodes.push({
      id: gcpVpcId,
      type: "vpc",
      position: { x: 530, y: 180 },
      data: { label: "gcp-main-vpc", cidr: "10.128.0.0/16", region: "us-central1", provider: "gcp", subnetCount: 2 } satisfies VpcNodeData,
    })

    const gcpPub = "sub-gcp-pub"
    const gcpPri = "sub-gcp-pri"
    nodes.push(
      { id: gcpPub, type: "subnet", position: { x: 540, y: 310 }, data: { label: "gcp-public", cidr: "10.128.1.0/24", az: "us-central1-a", isPublic: true, provider: "gcp" } satisfies SubnetNodeData },
      { id: gcpPri, type: "subnet", position: { x: 740, y: 310 }, data: { label: "gcp-private", cidr: "10.128.10.0/24", az: "us-central1-b", isPublic: false, provider: "gcp" } satisfies SubnetNodeData },
    )

    edges.push(
      { id: "e-gcpvpc-pub", source: gcpVpcId, target: gcpPub, style: { stroke: "#60a5fa", strokeWidth: 1 } },
      { id: "e-gcpvpc-pri", source: gcpVpcId, target: gcpPri, style: { stroke: "#60a5fa", strokeWidth: 1 } },
    )

    // IGW → GCP VPC
    edges.push({
      id: "e-igw-gcp",
      source: igwId,
      target: gcpVpcId,
      style: { stroke: "#06b6d4", strokeWidth: 2 },
      animated: showTraffic,
      label: showTraffic ? "890 Mbps" : undefined,
      labelStyle: { fontSize: 9, fill: "#6b7280" },
    })

    // Services
    const gcpLb = "svc-gcp-lb"
    const gce1 = "svc-gce-1"
    const gce2 = "svc-gce-2"
    const gce3 = "svc-gce-3"
    const gcpSql = "svc-gcp-sql"
    const gcpMem = "svc-gcp-mem"

    nodes.push(
      { id: gcpLb, type: "service", position: { x: 570, y: 420 }, data: { label: "Cloud LB", type: "cloudlb", provider: "gcp", ip: "10.128.1.10", status: "healthy" } satisfies ServiceNodeData },
      { id: gce1, type: "service", position: { x: 520, y: 500 }, data: { label: "gce-app-1", type: "gce", provider: "gcp", ip: "10.128.1.20", status: "healthy" } satisfies ServiceNodeData },
      { id: gce2, type: "service", position: { x: 680, y: 500 }, data: { label: "gce-app-2", type: "gce", provider: "gcp", ip: "10.128.1.21", status: "healthy" } satisfies ServiceNodeData },
      { id: gce3, type: "service", position: { x: 840, y: 500 }, data: { label: "gce-app-3", type: "gce", provider: "gcp", ip: "10.128.1.22", status: "error" } satisfies ServiceNodeData },
      { id: gcpSql, type: "service", position: { x: 570, y: 620 }, data: { label: "Cloud SQL", type: "cloudsql", provider: "gcp", ip: "10.128.10.50", status: "healthy" } satisfies ServiceNodeData },
      { id: gcpMem, type: "service", position: { x: 770, y: 620 }, data: { label: "Memorystore", type: "memorystore", provider: "gcp", ip: "10.128.10.60", status: "healthy" } satisfies ServiceNodeData },
    )

    edges.push(
      { id: "e-gcplb-gce1", source: gcpLb, target: gce1, style: { stroke: "#22c55e", strokeWidth: 1.5 }, animated: showTraffic, label: showTraffic ? "310 Mbps" : undefined, labelStyle: { fontSize: 9, fill: "#6b7280" } },
      { id: "e-gcplb-gce2", source: gcpLb, target: gce2, style: { stroke: "#22c55e", strokeWidth: 1.5 }, animated: showTraffic },
      { id: "e-gcplb-gce3", source: gcpLb, target: gce3, style: { stroke: "#ef4444", strokeWidth: 1.5 }, animated: showTraffic, label: showTraffic ? "Errors" : undefined, labelStyle: { fontSize: 9, fill: "#ef4444" } },
      { id: "e-gce1-sql", source: gce1, target: gcpSql, style: { stroke: "#22c55e", strokeWidth: 1.5 }, animated: showTraffic },
      { id: "e-gce2-sql", source: gce2, target: gcpSql, style: { stroke: "#22c55e", strokeWidth: 1.5 }, animated: showTraffic },
      { id: "e-gce1-mem", source: gce1, target: gcpMem, style: { stroke: "#22c55e", strokeWidth: 1 }, animated: showTraffic },
      { id: "e-gce2-mem", source: gce2, target: gcpMem, style: { stroke: "#22c55e", strokeWidth: 1 }, animated: showTraffic },
      { id: "e-gcppub-lb", source: gcpPub, target: gcpLb, style: { stroke: "#60a5fa", strokeWidth: 1 } },
    )

    // Cross-cloud peering: AWS prod-vpc ↔ GCP vpc
    if (providerFilter === "all") {
      edges.push({
        id: "e-peer-aws-gcp",
        source: "vpc-aws-prod",
        target: gcpVpcId,
        sourceHandle: "right",
        targetHandle: "left",
        style: { stroke: "#f59e0b", strokeWidth: 2.5, strokeDasharray: "8 4" },
        animated: showTraffic,
        label: showTraffic ? "Cross-Cloud: 120 Mbps | 18ms" : "Cross-Cloud Peering",
        labelStyle: { fontSize: 9, fill: "#f59e0b", fontWeight: 600 },
      })
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // Azure azure-prod-vnet
  // ══════════════════════════════════════════════════════════════════════
  if (providerFilter === "all" || providerFilter === "azure") {
    const azVnetId = "vpc-azure-prod"
    nodes.push({
      id: azVnetId,
      type: "vpc",
      position: { x: 1050, y: 180 },
      data: { label: "azure-prod-vnet", cidr: "10.1.0.0/16", region: "eastus", provider: "azure", subnetCount: 2 } satisfies VpcNodeData,
    })

    const azPub = "sub-az-pub"
    const azPri = "sub-az-pri"
    nodes.push(
      { id: azPub, type: "subnet", position: { x: 1060, y: 310 }, data: { label: "az-frontend", cidr: "10.1.1.0/24", az: "eastus-1", isPublic: true, provider: "azure" } satisfies SubnetNodeData },
      { id: azPri, type: "subnet", position: { x: 1270, y: 310 }, data: { label: "az-backend", cidr: "10.1.10.0/24", az: "eastus-2", isPublic: false, provider: "azure" } satisfies SubnetNodeData },
    )

    edges.push(
      { id: "e-azvnet-pub", source: azVnetId, target: azPub, style: { stroke: "#a78bfa", strokeWidth: 1 } },
      { id: "e-azvnet-pri", source: azVnetId, target: azPri, style: { stroke: "#a78bfa", strokeWidth: 1 } },
    )

    // IGW → Azure VNet
    edges.push({
      id: "e-igw-azure",
      source: igwId,
      target: azVnetId,
      style: { stroke: "#06b6d4", strokeWidth: 2 },
      animated: showTraffic,
      label: showTraffic ? "670 Mbps" : undefined,
      labelStyle: { fontSize: 9, fill: "#6b7280" },
    })

    // Services
    const azLb = "svc-az-lb"
    const vm1 = "svc-az-vm1"
    const vm2 = "svc-az-vm2"
    const vm3 = "svc-az-vm3"
    const azSql = "svc-az-sql"
    const aksId = "svc-az-aks"

    nodes.push(
      { id: azLb, type: "service", position: { x: 1090, y: 420 }, data: { label: "Azure LB", type: "azurelb", provider: "azure", ip: "10.1.1.10", status: "healthy" } satisfies ServiceNodeData },
      { id: vm1, type: "service", position: { x: 1040, y: 500 }, data: { label: "web-vm-1", type: "vm", provider: "azure", ip: "10.1.1.20", status: "healthy" } satisfies ServiceNodeData },
      { id: vm2, type: "service", position: { x: 1200, y: 500 }, data: { label: "web-vm-2", type: "vm", provider: "azure", ip: "10.1.1.21", status: "healthy" } satisfies ServiceNodeData },
      { id: vm3, type: "service", position: { x: 1360, y: 500 }, data: { label: "web-vm-3", type: "vm", provider: "azure", ip: "10.1.1.22", status: "warning" } satisfies ServiceNodeData },
      { id: azSql, type: "service", position: { x: 1090, y: 620 }, data: { label: "Azure SQL", type: "azuresql", provider: "azure", ip: "10.1.10.50", status: "healthy" } satisfies ServiceNodeData },
      { id: aksId, type: "service", position: { x: 1290, y: 620 }, data: { label: "AKS Cluster", type: "aks", provider: "azure", ip: "10.1.10.60", status: "healthy" } satisfies ServiceNodeData },
    )

    edges.push(
      { id: "e-azlb-vm1", source: azLb, target: vm1, style: { stroke: "#22c55e", strokeWidth: 1.5 }, animated: showTraffic, label: showTraffic ? "280 Mbps" : undefined, labelStyle: { fontSize: 9, fill: "#6b7280" } },
      { id: "e-azlb-vm2", source: azLb, target: vm2, style: { stroke: "#22c55e", strokeWidth: 1.5 }, animated: showTraffic },
      { id: "e-azlb-vm3", source: azLb, target: vm3, style: { stroke: "#eab308", strokeWidth: 1.5 }, animated: showTraffic, label: showTraffic ? "8ms latency" : undefined, labelStyle: { fontSize: 9, fill: "#eab308" } },
      { id: "e-vm1-sql", source: vm1, target: azSql, style: { stroke: "#22c55e", strokeWidth: 1.5 }, animated: showTraffic },
      { id: "e-vm2-sql", source: vm2, target: azSql, style: { stroke: "#22c55e", strokeWidth: 1.5 }, animated: showTraffic },
      { id: "e-vm1-aks", source: vm1, target: aksId, style: { stroke: "#22c55e", strokeWidth: 1 }, animated: showTraffic },
      { id: "e-vm3-aks", source: vm3, target: aksId, style: { stroke: "#eab308", strokeWidth: 1 }, animated: showTraffic },
      { id: "e-azpub-lb", source: azPub, target: azLb, style: { stroke: "#a78bfa", strokeWidth: 1 } },
    )

    // Cross-cloud peering: GCP ↔ Azure
    if (providerFilter === "all") {
      edges.push({
        id: "e-peer-gcp-azure",
        source: "vpc-gcp-main",
        target: azVnetId,
        sourceHandle: "right",
        targetHandle: "left",
        style: { stroke: "#f59e0b", strokeWidth: 2.5, strokeDasharray: "8 4" },
        animated: showTraffic,
        label: showTraffic ? "Cross-Cloud: 85 Mbps | 24ms" : "Cross-Cloud Peering",
        labelStyle: { fontSize: 9, fill: "#f59e0b", fontWeight: 600 },
      })
    }
  }

  // Apply region filter
  if (regionFilter !== "all") {
    const vpcNodeIds = nodes
      .filter((n) => n.type === "vpc" && (n.data as unknown as VpcNodeData).region === regionFilter)
      .map((n) => n.id)

    if (vpcNodeIds.length === 0) {
      return { nodes: [nodes[0], nodes[1]], edges: [] } // keep igw + nat
    }
  }

  return { nodes, edges }
}

// ---------------------------------------------------------------------------
// Network details data
// ---------------------------------------------------------------------------

const networkDetails: Record<string, NetworkDetail> = {
  "vpc-aws-prod": {
    id: "vpc-aws-prod", name: "prod-vpc", type: "VPC",
    ip: "10.0.0.0/16",
    routes: ["0.0.0.0/0 → igw-abc123", "10.0.0.0/16 → local", "172.16.0.0/16 → pcx-dev"],
    securityRules: [
      { direction: "Inbound", port: "443", source: "0.0.0.0/0", action: "Allow" },
      { direction: "Inbound", port: "80", source: "0.0.0.0/0", action: "Allow" },
      { direction: "Outbound", port: "All", source: "0.0.0.0/0", action: "Allow" },
    ],
    trafficMetrics: { inbound: "1.2 Gbps", outbound: "890 Mbps", latency: "2ms" },
    connectedNodes: [
      { name: "dev-vpc", latency: "1ms" },
      { name: "gcp-main-vpc", latency: "18ms" },
    ],
  },
  "svc-alb": {
    id: "svc-alb", name: "prod-alb", type: "ALB",
    ip: "10.0.1.10",
    routes: ["10.0.1.0/24 → local"],
    securityRules: [
      { direction: "Inbound", port: "443", source: "0.0.0.0/0", action: "Allow" },
      { direction: "Inbound", port: "80", source: "0.0.0.0/0", action: "Allow → Redirect HTTPS" },
      { direction: "Outbound", port: "8080", source: "10.0.0.0/16", action: "Allow" },
    ],
    trafficMetrics: { inbound: "800 Mbps", outbound: "790 Mbps", latency: "1ms" },
    connectedNodes: [
      { name: "web-server-1", latency: "<1ms" },
      { name: "web-server-2", latency: "<1ms" },
    ],
  },
  "svc-ec2-a": {
    id: "svc-ec2-a", name: "web-server-1", type: "EC2",
    ip: "10.0.1.20",
    routes: ["10.0.1.0/24 → local", "0.0.0.0/0 → nat-gw"],
    securityRules: [
      { direction: "Inbound", port: "8080", source: "10.0.1.10/32", action: "Allow" },
      { direction: "Outbound", port: "5432", source: "10.0.10.0/24", action: "Allow" },
      { direction: "Outbound", port: "6379", source: "10.0.11.0/24", action: "Allow" },
    ],
    trafficMetrics: { inbound: "420 Mbps", outbound: "350 Mbps", latency: "1ms" },
    connectedNodes: [
      { name: "prod-db (RDS)", latency: "2ms" },
      { name: "prod-cache", latency: "<1ms" },
    ],
  },
  "svc-rds": {
    id: "svc-rds", name: "prod-db (RDS)", type: "RDS",
    ip: "10.0.10.50",
    routes: ["10.0.10.0/24 → local"],
    securityRules: [
      { direction: "Inbound", port: "5432", source: "10.0.1.0/24", action: "Allow" },
      { direction: "Inbound", port: "5432", source: "10.0.2.0/24", action: "Allow" },
    ],
    trafficMetrics: { inbound: "300 Mbps", outbound: "180 Mbps", latency: "2ms" },
    connectedNodes: [
      { name: "web-server-1", latency: "2ms" },
      { name: "web-server-2", latency: "3ms" },
    ],
  },
  "vpc-gcp-main": {
    id: "vpc-gcp-main", name: "gcp-main-vpc", type: "VPC",
    ip: "10.128.0.0/16",
    routes: ["0.0.0.0/0 → default-internet-gateway", "10.128.0.0/16 → local"],
    securityRules: [
      { direction: "Inbound", port: "443", source: "0.0.0.0/0", action: "Allow" },
      { direction: "Inbound", port: "22", source: "35.235.240.0/20", action: "Allow (IAP)" },
    ],
    trafficMetrics: { inbound: "890 Mbps", outbound: "720 Mbps", latency: "3ms" },
    connectedNodes: [
      { name: "prod-vpc (AWS)", latency: "18ms" },
      { name: "azure-prod-vnet", latency: "24ms" },
    ],
  },
  "vpc-azure-prod": {
    id: "vpc-azure-prod", name: "azure-prod-vnet", type: "VNet",
    ip: "10.1.0.0/16",
    routes: ["0.0.0.0/0 → Internet", "10.1.0.0/16 → VnetLocal"],
    securityRules: [
      { direction: "Inbound", port: "443", source: "Internet", action: "Allow" },
      { direction: "Inbound", port: "22", source: "VirtualNetwork", action: "Allow" },
      { direction: "Outbound", port: "All", source: "VirtualNetwork", action: "Allow" },
    ],
    trafficMetrics: { inbound: "670 Mbps", outbound: "540 Mbps", latency: "2ms" },
    connectedNodes: [
      { name: "gcp-main-vpc", latency: "24ms" },
    ],
  },
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function NetworkMapPage() {
  const { data: graph } = useDependencyGraph('aws')
  const [providerFilter, setProviderFilter] = useState("all")
  const [regionFilter, setRegionFilter] = useState("all")
  const [showTraffic, setShowTraffic] = useState(true)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  const { nodes: initNodes, edges: initEdges } = useMemo(
    () => buildTopology(providerFilter, regionFilter, showTraffic),
    [providerFilter, regionFilter, showTraffic],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)

  useEffect(() => {
    const { nodes: n, edges: e } = buildTopology(providerFilter, regionFilter, showTraffic)
    setNodes(n)
    setEdges(e)
  }, [providerFilter, regionFilter, showTraffic, setNodes, setEdges])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id)
  }, [])

  const detail = selectedNode ? networkDetails[selectedNode] : null

  // Stats
  const vpcCount = nodes.filter((n) => n.type === "vpc").length
  const subnetCount = nodes.filter((n) => n.type === "subnet").length
  const crossCloudEdges = edges.filter((e) => e.id.startsWith("e-peer-")).length
  const avgLatency = "14.7ms"

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Network Map</h1>
          <p className="text-sm text-muted-foreground">
            Real-time multi-cloud network topology visualization
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.15}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                if (n.type === "gateway") return "#06b6d4"
                const data = n.data as Record<string, unknown>
                const provider = data?.provider as string | undefined
                if (provider && provider in providerColors) {
                  return providerColors[provider as Provider].node
                }
                return "#888"
              }}
              maskColor="rgba(0,0,0,0.1)"
            />

            {/* Filter panel */}
            <Panel position="top-left">
              <Card className="shadow-lg">
                <CardContent className="p-3 flex items-center gap-3 flex-wrap">
                  <Filter className="h-4 w-4 text-muted-foreground" />

                  <Select value={providerFilter} onValueChange={setProviderFilter}>
                    <SelectTrigger className="h-8 w-[120px] text-xs">
                      <SelectValue placeholder="Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Providers</SelectItem>
                      <SelectItem value="aws">AWS</SelectItem>
                      <SelectItem value="gcp">GCP</SelectItem>
                      <SelectItem value="azure">Azure</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={regionFilter} onValueChange={setRegionFilter}>
                    <SelectTrigger className="h-8 w-[130px] text-xs">
                      <SelectValue placeholder="Region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Regions</SelectItem>
                      <SelectItem value="us-east-1">us-east-1</SelectItem>
                      <SelectItem value="us-central1">us-central1</SelectItem>
                      <SelectItem value="eastus">eastus</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={showTraffic}
                      onCheckedChange={setShowTraffic}
                      className="scale-75"
                    />
                    <span className="text-xs text-muted-foreground">Traffic</span>
                  </div>
                </CardContent>
              </Card>
            </Panel>

            {/* Legend */}
            <Panel position="bottom-left">
              <Card className="shadow-lg">
                <CardContent className="p-3 space-y-2">
                  <div className="text-xs font-semibold mb-1">Legend</div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-3 rounded border-2 border-orange-400 bg-orange-50" />
                      <span>AWS</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-3 rounded border-2 border-blue-400 bg-blue-50" />
                      <span>GCP</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-3 rounded border-2 border-purple-400 bg-purple-50" />
                      <span>Azure</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <div className="flex items-center gap-1">
                      <div className="h-0.5 w-6 bg-green-500" />
                      <span>Healthy</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-0.5 w-6 bg-yellow-500" />
                      <span>High Latency</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-0.5 w-6 bg-red-500" />
                      <span>Errors</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <div className="flex items-center gap-1">
                      <div className="h-0.5 w-6" style={{ borderTop: "2px dashed #f59e0b" }} />
                      <span>Cross-Cloud Peering</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-3 rounded-full border-2 border-cyan-400 bg-cyan-50" />
                      <span>Gateway</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Panel>
          </ReactFlow>
        </div>

        {/* Right panel - network details */}
        {detail && (
          <div className="w-[340px] border-l bg-background overflow-y-auto shrink-0">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">{detail.name}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelectedNode(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{detail.type}</Badge>
                <Badge variant="outline" className="text-xs font-mono">{detail.ip}</Badge>
              </div>

              {/* Routes */}
              <div>
                <h4 className="text-xs font-semibold mb-1.5 flex items-center gap-1">
                  <Activity className="h-3 w-3" /> Routes
                </h4>
                <div className="space-y-1">
                  {detail.routes.map((route, i) => (
                    <div key={i} className="text-[11px] text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1">
                      {route}
                    </div>
                  ))}
                </div>
              </div>

              {/* Security Rules */}
              <div>
                <h4 className="text-xs font-semibold mb-1.5 flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Security Group Rules
                </h4>
                <div className="space-y-1">
                  {detail.securityRules.map((rule, i) => (
                    <div key={i} className="text-[11px] bg-muted/50 rounded px-2 py-1.5 flex items-center gap-2">
                      <Badge
                        variant={rule.direction === "Inbound" ? "default" : "secondary"}
                        className="text-[9px] px-1 py-0"
                      >
                        {rule.direction}
                      </Badge>
                      <span className="font-mono text-muted-foreground">:{rule.port}</span>
                      <span className="text-muted-foreground truncate flex-1">{rule.source}</span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 ${rule.action.startsWith("Allow") ? "text-green-600 border-green-300" : "text-red-600 border-red-300"}`}
                      >
                        {rule.action}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Traffic Metrics */}
              <div>
                <h4 className="text-xs font-semibold mb-1.5 flex items-center gap-1">
                  <Wifi className="h-3 w-3" /> Traffic Metrics
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/50 rounded p-2 text-center">
                    <div className="text-[10px] text-muted-foreground">Inbound</div>
                    <div className="text-xs font-semibold text-green-600">{detail.trafficMetrics.inbound}</div>
                  </div>
                  <div className="bg-muted/50 rounded p-2 text-center">
                    <div className="text-[10px] text-muted-foreground">Outbound</div>
                    <div className="text-xs font-semibold text-blue-600">{detail.trafficMetrics.outbound}</div>
                  </div>
                  <div className="bg-muted/50 rounded p-2 text-center">
                    <div className="text-[10px] text-muted-foreground">Latency</div>
                    <div className="text-xs font-semibold">{detail.trafficMetrics.latency}</div>
                  </div>
                </div>
              </div>

              {/* Connected Nodes */}
              <div>
                <h4 className="text-xs font-semibold mb-1.5 flex items-center gap-1">
                  <Network className="h-3 w-3" /> Connected Nodes
                </h4>
                <div className="space-y-1">
                  {detail.connectedNodes.map((cn, i) => (
                    <div key={i} className="text-[11px] bg-muted/50 rounded px-2 py-1.5 flex items-center justify-between">
                      <span>{cn.name}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                        {cn.latency}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t px-4 py-2.5 flex items-center gap-6 shrink-0 bg-muted/30">
        <div className="flex items-center gap-1.5 text-xs">
          <Network className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">VPCs:</span>
          <span className="font-semibold">{vpcCount}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Subnets:</span>
          <span className="font-semibold">{subnetCount}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Cross-Cloud:</span>
          <span className="font-semibold">{crossCloudEdges}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Avg Latency:</span>
          <span className="font-semibold">{avgLatency}</span>
        </div>
      </div>
    </div>
  )
}

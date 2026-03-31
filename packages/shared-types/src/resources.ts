import type { CloudProvider } from "./cloud"

export type ResourceStatus = "running" | "stopped" | "pending" | "error" | "terminated" | "available" | "creating" | "deleting"

export interface Resource {
  id: string
  name: string
  type: string
  provider: CloudProvider
  region: string
  status: ResourceStatus
  tags?: Record<string, string>
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface Instance extends Resource { instanceType: string; publicIp?: string; privateIp?: string; az?: string }
export interface Volume extends Resource { size: number; volumeType: string; iops?: number; encrypted: boolean; attachedTo?: string }
export interface Bucket extends Resource { storageClass: string; versioning: boolean; encryption: boolean; objectCount?: number; totalSize?: number }
export interface VPC extends Resource { cidr: string; subnets: number; isDefault: boolean }
export interface DatabaseInstance extends Resource { engine: string; engineVersion: string; instanceClass: string; storageGb: number; multiAz: boolean; endpoint?: string }
export interface KubernetesCluster extends Resource { version: string; nodeCount: number; endpoint?: string }
export interface ServerlessFunction extends Resource { runtime: string; memory: number; timeout: number; handler: string }
export interface LoadBalancer extends Resource { lbType: "application" | "network" | "gateway"; scheme: "internet-facing" | "internal"; dnsName?: string }

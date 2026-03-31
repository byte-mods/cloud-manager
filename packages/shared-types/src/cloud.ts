export type CloudProvider = "aws" | "gcp" | "azure"

export interface CloudRegion {
  id: string
  name: string
  provider: CloudProvider
  location: string
  available: boolean
}

export interface CloudAccount {
  id: string
  name: string
  provider: CloudProvider
  accountId: string
  status: "connected" | "disconnected" | "error"
  lastSync: string
  regions: string[]
}

export interface CloudContext {
  provider: CloudProvider
  region: string
  account: string
}

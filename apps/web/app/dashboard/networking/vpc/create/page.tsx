"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Network } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

type VPCFormState = {
  name: string
  cidr: string
  region: string
  provider: string
  autoCreateSubnets: boolean
  dnsResolution: boolean
  dnsHostnames: boolean
}

const regionsByProvider: Record<string, { value: string; label: string }[]> = {
  aws: [
    { value: "us-east-1", label: "US East (N. Virginia)" },
    { value: "us-west-2", label: "US West (Oregon)" },
    { value: "eu-west-1", label: "EU (Ireland)" },
    { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  ],
  gcp: [
    { value: "us-central1", label: "US Central (Iowa)" },
    { value: "us-east1", label: "US East (South Carolina)" },
    { value: "europe-west1", label: "Europe West (Belgium)" },
  ],
  azure: [
    { value: "eastus", label: "East US" },
    { value: "westus2", label: "West US 2" },
    { value: "westeurope", label: "West Europe" },
  ],
}

export default function CreateVPCPage() {
  const { data: _regionsApi } = useQuery({ queryKey: ['regions'], queryFn: () => apiClient.get('/v1/cloud/aws/compute/instances'), enabled: false })
  const router = useRouter()
  const [formState, setFormState] = useState<VPCFormState>({
    name: "",
    cidr: "10.0.0.0/16",
    region: "",
    provider: "",
    autoCreateSubnets: true,
    dnsResolution: true,
    dnsHostnames: true,
  })

  const regions = formState.provider ? regionsByProvider[formState.provider] ?? [] : []

  const canSubmit =
    formState.name.length >= 2 &&
    formState.cidr.length > 0 &&
    formState.provider !== "" &&
    formState.region !== ""

  const handleCreate = () => {
    router.push("/dashboard/networking/vpc")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/networking/vpc")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to VPCs
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create VPC</h1>
        <p className="text-muted-foreground mt-1">
          Create a new virtual private cloud.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>VPC Configuration</CardTitle>
          <CardDescription>
            Configure the basic VPC settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="vpc-name">VPC Name</Label>
            <Input
              id="vpc-name"
              placeholder="my-vpc"
              value={formState.name}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="provider">Cloud Provider</Label>
              <Select
                value={formState.provider}
                onValueChange={(v) =>
                  setFormState((prev) => ({ ...prev, provider: v, region: "" }))
                }
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aws">AWS</SelectItem>
                  <SelectItem value="gcp">GCP</SelectItem>
                  <SelectItem value="azure">Azure</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Select
                value={formState.region}
                onValueChange={(v) =>
                  setFormState((prev) => ({ ...prev, region: v }))
                }
                disabled={!formState.provider}
              >
                <SelectTrigger id="region">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cidr">IPv4 CIDR Block</Label>
            <Input
              id="cidr"
              placeholder="10.0.0.0/16"
              value={formState.cidr}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, cidr: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">
              The range of IPv4 addresses for this VPC in CIDR notation (e.g. 10.0.0.0/16).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subnet Configuration</CardTitle>
          <CardDescription>
            Automatically create public and private subnets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="auto-subnets">Auto-create Subnets</Label>
              <p className="text-sm text-muted-foreground">
                Automatically create one public and one private subnet per availability zone
              </p>
            </div>
            <Switch
              id="auto-subnets"
              checked={formState.autoCreateSubnets}
              onCheckedChange={(checked) =>
                setFormState((prev) => ({ ...prev, autoCreateSubnets: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>DNS Settings</CardTitle>
          <CardDescription>
            Configure DNS resolution and hostname options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="dns-resolution">DNS Resolution</Label>
              <p className="text-sm text-muted-foreground">
                Enable DNS resolution through the Amazon-provided DNS server
              </p>
            </div>
            <Switch
              id="dns-resolution"
              checked={formState.dnsResolution}
              onCheckedChange={(checked) =>
                setFormState((prev) => ({ ...prev, dnsResolution: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="dns-hostnames">DNS Hostnames</Label>
              <p className="text-sm text-muted-foreground">
                Assign public DNS hostnames to instances with public IPs
              </p>
            </div>
            <Switch
              id="dns-hostnames"
              checked={formState.dnsHostnames}
              onCheckedChange={(checked) =>
                setFormState((prev) => ({ ...prev, dnsHostnames: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-4">
        <Button variant="outline" onClick={() => router.push("/dashboard/networking/vpc")}>
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={!canSubmit}>
          <Network className="mr-2 h-4 w-4" />
          Create VPC
        </Button>
      </div>
    </div>
  )
}

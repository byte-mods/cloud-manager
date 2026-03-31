"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, FolderOpen, Loader2 } from "lucide-react"
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
import { useCloudProvider } from "@/hooks/use-cloud-provider"
import { apiClient } from "@/lib/api-client"

type BucketFormState = {
  name: string
  provider: string
  region: string
  storageClass: string
  versioning: boolean
  encryption: string
  accessControl: string
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
    { value: "asia-east1", label: "Asia East (Taiwan)" },
  ],
  azure: [
    { value: "eastus", label: "East US" },
    { value: "westus2", label: "West US 2" },
    { value: "westeurope", label: "West Europe" },
    { value: "southeastasia", label: "Southeast Asia" },
  ],
}

const storageClasses: Record<string, { value: string; label: string }[]> = {
  aws: [
    { value: "STANDARD", label: "Standard" },
    { value: "STANDARD_IA", label: "Standard-IA" },
    { value: "ONEZONE_IA", label: "One Zone-IA" },
    { value: "INTELLIGENT_TIERING", label: "Intelligent-Tiering" },
    { value: "GLACIER", label: "Glacier" },
    { value: "DEEP_ARCHIVE", label: "Glacier Deep Archive" },
  ],
  gcp: [
    { value: "STANDARD", label: "Standard" },
    { value: "NEARLINE", label: "Nearline" },
    { value: "COLDLINE", label: "Coldline" },
    { value: "ARCHIVE", label: "Archive" },
  ],
  azure: [
    { value: "HOT", label: "Hot" },
    { value: "COOL", label: "Cool" },
    { value: "ARCHIVE", label: "Archive" },
  ],
}

export default function CreateBucketPage() {
  const router = useRouter()
  const { provider: currentProvider, region: currentRegion } = useCloudProvider()
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [formState, setFormState] = useState<BucketFormState>({
    name: "",
    provider: currentProvider || "",
    region: currentRegion || "",
    storageClass: "STANDARD",
    versioning: false,
    encryption: "AES-256",
    accessControl: "private",
  })

  const regions = formState.provider ? regionsByProvider[formState.provider] ?? [] : []
  const classes = formState.provider ? storageClasses[formState.provider] ?? [] : []

  const canSubmit =
    formState.name.length >= 3 &&
    formState.provider !== "" &&
    formState.region !== ""

  const handleCreate = async () => {
    if (!canSubmit) return

    setIsCreating(true)
    setCreateError(null)

    try {
      const bucketData = {
        name: formState.name,
        provider: formState.provider,
        region: formState.region,
        storageClass: formState.storageClass,
        versioning: formState.versioning,
        encryption: formState.encryption,
        accessControl: formState.accessControl,
      }

      await apiClient.post(`/cloud/${formState.provider}/storage/object`, bucketData)
      router.push("/dashboard/storage/object")
    } catch (err: any) {
      setCreateError(err?.message ?? "Failed to create bucket. Please try again.")
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/storage/object")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Buckets
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Bucket</h1>
        <p className="text-muted-foreground mt-1">
          Create a new object storage bucket.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Configuration</CardTitle>
          <CardDescription>
            Set the basic properties for your new bucket
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="bucket-name">Bucket Name</Label>
            <Input
              id="bucket-name"
              placeholder="my-bucket-name"
              value={formState.name}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, name: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Must be globally unique. Only lowercase letters, numbers, and hyphens.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="provider">Cloud Provider</Label>
              <Select
                value={formState.provider}
                onValueChange={(v) =>
                  setFormState((prev) => ({
                    ...prev,
                    provider: v,
                    region: "",
                    storageClass: "STANDARD",
                  }))
                }
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aws">AWS (S3)</SelectItem>
                  <SelectItem value="gcp">GCP (Cloud Storage)</SelectItem>
                  <SelectItem value="azure">Azure (Blob Storage)</SelectItem>
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
            <Label htmlFor="storage-class">Storage Class</Label>
            <Select
              value={formState.storageClass}
              onValueChange={(v) =>
                setFormState((prev) => ({ ...prev, storageClass: v }))
              }
              disabled={!formState.provider}
            >
              <SelectTrigger id="storage-class">
                <SelectValue placeholder="Select storage class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bucket Settings</CardTitle>
          <CardDescription>
            Configure versioning, encryption, and access control
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="versioning">Bucket Versioning</Label>
              <p className="text-sm text-muted-foreground">
                Keep multiple variants of an object in the same bucket
              </p>
            </div>
            <Switch
              id="versioning"
              checked={formState.versioning}
              onCheckedChange={(checked) =>
                setFormState((prev) => ({ ...prev, versioning: checked }))
              }
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="encryption">Encryption</Label>
            <Select
              value={formState.encryption}
              onValueChange={(v) =>
                setFormState((prev) => ({ ...prev, encryption: v }))
              }
            >
              <SelectTrigger id="encryption">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AES-256">SSE-S3 (AES-256)</SelectItem>
                <SelectItem value="aws:kms">SSE-KMS (AWS KMS)</SelectItem>
                <SelectItem value="customer-managed">Customer-managed key</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="access-control">Access Control</Label>
            <Select
              value={formState.accessControl}
              onValueChange={(v) =>
                setFormState((prev) => ({ ...prev, accessControl: v }))
              }
            >
              <SelectTrigger id="access-control">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="public-read">Public Read</SelectItem>
              </SelectContent>
            </Select>
            {formState.accessControl === "public-read" && (
              <p className="text-xs text-destructive">
                Warning: Public read access allows anyone on the internet to read objects in this bucket.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {createError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {createError}
        </div>
      )}

      <div className="flex items-center justify-end gap-4">
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/storage/object")}
        >
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={!canSubmit || isCreating}>
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <FolderOpen className="mr-2 h-4 w-4" />
              Create Bucket
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

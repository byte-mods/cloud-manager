"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  Plus,
  Trash2,
  Monitor,
  Loader2,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
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

const STEPS = [
  { key: "os", label: "Operating System" },
  { key: "type", label: "Instance Type" },
  { key: "networking", label: "Networking" },
  { key: "storage", label: "Storage" },
  { key: "review", label: "Review & Launch" },
] as const

type StepKey = (typeof STEPS)[number]["key"]

type OsImage = {
  id: string
  name: string
  description: string
  arch: string
  provider: string
}

type InstanceType = {
  id: string
  name: string
  vCPUs: number
  memory: number
  pricePerHour: number
  category: string
}

type Volume = {
  name: string
  size: number
  type: string
}

type FormState = {
  os: OsImage | null
  instanceType: InstanceType | null
  vpc: string
  subnet: string
  securityGroup: string
  publicIp: boolean
  rootVolumeSize: number
  rootVolumeType: string
  additionalVolumes: Volume[]
}

const osImages: OsImage[] = [
  { id: "ami-ubuntu-22", name: "Ubuntu 22.04 LTS", description: "Canonical Ubuntu Server", arch: "x86_64", provider: "aws" },
  { id: "ami-ubuntu-24", name: "Ubuntu 24.04 LTS", description: "Canonical Ubuntu Server", arch: "x86_64", provider: "aws" },
  { id: "ami-amazon-linux", name: "Amazon Linux 2023", description: "Amazon Linux", arch: "x86_64", provider: "aws" },
  { id: "ami-debian-12", name: "Debian 12", description: "Debian Bookworm", arch: "x86_64", provider: "aws" },
  { id: "ami-rhel-9", name: "Red Hat Enterprise Linux 9", description: "RHEL 9", arch: "x86_64", provider: "aws" },
  { id: "ami-windows-2022", name: "Windows Server 2022", description: "Microsoft Windows Server", arch: "x86_64", provider: "aws" },
  { id: "img-ubuntu-22-gcp", name: "Ubuntu 22.04 LTS", description: "Canonical Ubuntu", arch: "x86_64", provider: "gcp" },
  { id: "img-cos", name: "Container-Optimized OS", description: "Google COS", arch: "x86_64", provider: "gcp" },
]

const instanceTypes: InstanceType[] = [
  { id: "t3.micro", name: "t3.micro", vCPUs: 2, memory: 1, pricePerHour: 0.0104, category: "General Purpose" },
  { id: "t3.small", name: "t3.small", vCPUs: 2, memory: 2, pricePerHour: 0.0208, category: "General Purpose" },
  { id: "t3.medium", name: "t3.medium", vCPUs: 2, memory: 4, pricePerHour: 0.0416, category: "General Purpose" },
  { id: "t3.large", name: "t3.large", vCPUs: 2, memory: 8, pricePerHour: 0.0832, category: "General Purpose" },
  { id: "m5.large", name: "m5.large", vCPUs: 2, memory: 8, pricePerHour: 0.096, category: "General Purpose" },
  { id: "m5.xlarge", name: "m5.xlarge", vCPUs: 4, memory: 16, pricePerHour: 0.192, category: "General Purpose" },
  { id: "c5.large", name: "c5.large", vCPUs: 2, memory: 4, pricePerHour: 0.085, category: "Compute Optimized" },
  { id: "c5.xlarge", name: "c5.xlarge", vCPUs: 4, memory: 8, pricePerHour: 0.17, category: "Compute Optimized" },
  { id: "r5.large", name: "r5.large", vCPUs: 2, memory: 16, pricePerHour: 0.126, category: "Memory Optimized" },
  { id: "r5.xlarge", name: "r5.xlarge", vCPUs: 4, memory: 32, pricePerHour: 0.252, category: "Memory Optimized" },
  { id: "g4dn.xlarge", name: "g4dn.xlarge", vCPUs: 4, memory: 16, pricePerHour: 0.526, category: "GPU" },
]

function Stepper({ currentStep, steps }: { currentStep: number; steps: typeof STEPS }) {
  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <div className="space-y-4">
      <Progress value={progress} className="h-2" />
      <div className="flex justify-between">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                index < currentStep
                  ? "border-primary bg-primary text-primary-foreground"
                  : index === currentStep
                  ? "border-primary text-primary"
                  : "border-muted text-muted-foreground"
              }`}
            >
              {index < currentStep ? (
                <Check className="h-4 w-4" />
              ) : (
                index + 1
              )}
            </div>
            <span
              className={`text-sm hidden md:inline ${
                index === currentStep
                  ? "font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepOS({
  formState,
  setFormState,
}: {
  formState: FormState
  setFormState: React.Dispatch<React.SetStateAction<FormState>>
}) {
  const [search, setSearch] = useState("")
  const filtered = osImages.filter(
    (img) =>
      img.name.toLowerCase().includes(search.toLowerCase()) ||
      img.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Operating System</CardTitle>
        <CardDescription>
          Choose an AMI or image for your instance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search images..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((image) => (
            <div
              key={image.id}
              className={`cursor-pointer rounded-lg border-2 p-4 transition-colors hover:border-primary/50 ${
                formState.os?.id === image.id
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
              onClick={() =>
                setFormState((prev) => ({ ...prev, os: image }))
              }
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{image.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {image.description}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Badge variant="outline" className="text-xs">
                    {image.arch}
                  </Badge>
                  <Badge variant="secondary" className="text-xs uppercase">
                    {image.provider}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No images found matching your search.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function StepInstanceType({
  formState,
  setFormState,
}: {
  formState: FormState
  setFormState: React.Dispatch<React.SetStateAction<FormState>>
}) {
  const [categoryFilter, setCategoryFilter] = useState("all")
  const categories = [...new Set(instanceTypes.map((t) => t.category))]
  const filtered =
    categoryFilter === "all"
      ? instanceTypes
      : instanceTypes.filter((t) => t.category === categoryFilter)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Instance Type</CardTitle>
        <CardDescription>
          Choose the size and computing power for your instance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="rounded-md border">
          <div className="grid grid-cols-6 gap-4 p-3 bg-muted text-sm font-medium">
            <span>Name</span>
            <span>Category</span>
            <span className="text-right">vCPUs</span>
            <span className="text-right">Memory (GB)</span>
            <span className="text-right">Price/hr</span>
            <span className="text-right">Est. Monthly</span>
          </div>
          {filtered.map((type) => (
            <div
              key={type.id}
              className={`grid grid-cols-6 gap-4 p-3 text-sm cursor-pointer border-t transition-colors hover:bg-muted/50 ${
                formState.instanceType?.id === type.id
                  ? "bg-primary/5 border-l-2 border-l-primary"
                  : ""
              }`}
              onClick={() =>
                setFormState((prev) => ({
                  ...prev,
                  instanceType: type,
                }))
              }
            >
              <span className="font-medium font-mono">{type.name}</span>
              <span className="text-muted-foreground">{type.category}</span>
              <span className="text-right">{type.vCPUs}</span>
              <span className="text-right">{type.memory}</span>
              <span className="text-right">${type.pricePerHour.toFixed(4)}</span>
              <span className="text-right font-medium">
                ${(type.pricePerHour * 730).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function StepNetworking({
  formState,
  setFormState,
}: {
  formState: FormState
  setFormState: React.Dispatch<React.SetStateAction<FormState>>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure Networking</CardTitle>
        <CardDescription>
          Set up VPC, subnet, and security group settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="vpc">VPC</Label>
            <Select
              value={formState.vpc}
              onValueChange={(v) =>
                setFormState((prev) => ({ ...prev, vpc: v }))
              }
            >
              <SelectTrigger id="vpc">
                <SelectValue placeholder="Select VPC" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vpc-default">Default VPC (vpc-0abc123)</SelectItem>
                <SelectItem value="vpc-prod">Production VPC (vpc-0def456)</SelectItem>
                <SelectItem value="vpc-staging">Staging VPC (vpc-0ghi789)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subnet">Subnet</Label>
            <Select
              value={formState.subnet}
              onValueChange={(v) =>
                setFormState((prev) => ({ ...prev, subnet: v }))
              }
            >
              <SelectTrigger id="subnet">
                <SelectValue placeholder="Select Subnet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="subnet-public-1a">Public Subnet (us-east-1a)</SelectItem>
                <SelectItem value="subnet-public-1b">Public Subnet (us-east-1b)</SelectItem>
                <SelectItem value="subnet-private-1a">Private Subnet (us-east-1a)</SelectItem>
                <SelectItem value="subnet-private-1b">Private Subnet (us-east-1b)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sg">Security Group</Label>
          <Select
            value={formState.securityGroup}
            onValueChange={(v) =>
              setFormState((prev) => ({ ...prev, securityGroup: v }))
            }
          >
            <SelectTrigger id="sg">
              <SelectValue placeholder="Select Security Group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sg-default">Default (sg-0abc123)</SelectItem>
              <SelectItem value="sg-web">Web Server (sg-0def456)</SelectItem>
              <SelectItem value="sg-app">Application (sg-0ghi789)</SelectItem>
              <SelectItem value="sg-db">Database (sg-0jkl012)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <Label htmlFor="public-ip">Auto-assign Public IP</Label>
            <p className="text-sm text-muted-foreground">
              Enable to assign a public IPv4 address to this instance
            </p>
          </div>
          <Switch
            id="public-ip"
            checked={formState.publicIp}
            onCheckedChange={(checked) =>
              setFormState((prev) => ({ ...prev, publicIp: checked }))
            }
          />
        </div>
      </CardContent>
    </Card>
  )
}

function StepStorage({
  formState,
  setFormState,
}: {
  formState: FormState
  setFormState: React.Dispatch<React.SetStateAction<FormState>>
}) {
  const addVolume = () => {
    setFormState((prev) => ({
      ...prev,
      additionalVolumes: [
        ...prev.additionalVolumes,
        { name: `/dev/sd${String.fromCharCode(98 + prev.additionalVolumes.length)}`, size: 100, type: "gp3" },
      ],
    }))
  }

  const removeVolume = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      additionalVolumes: prev.additionalVolumes.filter((_, i) => i !== index),
    }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure Storage</CardTitle>
        <CardDescription>
          Set up root and additional volumes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-3">Root Volume</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="root-size">Size (GB)</Label>
              <Input
                id="root-size"
                type="number"
                min={8}
                max={16384}
                value={formState.rootVolumeSize}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    rootVolumeSize: parseInt(e.target.value) || 8,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="root-type">Volume Type</Label>
              <Select
                value={formState.rootVolumeType}
                onValueChange={(v) =>
                  setFormState((prev) => ({ ...prev, rootVolumeType: v }))
                }
              >
                <SelectTrigger id="root-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gp3">General Purpose SSD (gp3)</SelectItem>
                  <SelectItem value="gp2">General Purpose SSD (gp2)</SelectItem>
                  <SelectItem value="io1">Provisioned IOPS SSD (io1)</SelectItem>
                  <SelectItem value="io2">Provisioned IOPS SSD (io2)</SelectItem>
                  <SelectItem value="st1">Throughput Optimized HDD (st1)</SelectItem>
                  <SelectItem value="sc1">Cold HDD (sc1)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Additional Volumes</h3>
            <Button variant="outline" size="sm" onClick={addVolume}>
              <Plus className="mr-1 h-3 w-3" />
              Add Volume
            </Button>
          </div>
          {formState.additionalVolumes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No additional volumes configured.
            </p>
          ) : (
            <div className="space-y-3">
              {formState.additionalVolumes.map((vol, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-md border p-3"
                >
                  <div className="flex-1 grid gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Device</Label>
                      <Input
                        value={vol.name}
                        onChange={(e) => {
                          const updated = [...formState.additionalVolumes]
                          updated[index] = { ...vol, name: e.target.value }
                          setFormState((prev) => ({
                            ...prev,
                            additionalVolumes: updated,
                          }))
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Size (GB)</Label>
                      <Input
                        type="number"
                        value={vol.size}
                        onChange={(e) => {
                          const updated = [...formState.additionalVolumes]
                          updated[index] = {
                            ...vol,
                            size: parseInt(e.target.value) || 1,
                          }
                          setFormState((prev) => ({
                            ...prev,
                            additionalVolumes: updated,
                          }))
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={vol.type}
                        onValueChange={(v) => {
                          const updated = [...formState.additionalVolumes]
                          updated[index] = { ...vol, type: v }
                          setFormState((prev) => ({
                            ...prev,
                            additionalVolumes: updated,
                          }))
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gp3">gp3</SelectItem>
                          <SelectItem value="gp2">gp2</SelectItem>
                          <SelectItem value="io1">io1</SelectItem>
                          <SelectItem value="io2">io2</SelectItem>
                          <SelectItem value="st1">st1</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => removeVolume(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function StepReview({ formState, error }: { formState: FormState; error: string | null }) {
  const monthlyEstimate = formState.instanceType
    ? formState.instanceType.pricePerHour * 730
    : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review & Launch</CardTitle>
        <CardDescription>
          Review your configuration before launching
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="rounded-lg border p-4 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              Operating System
            </h4>
            <p className="text-sm font-medium">
              {formState.os?.name ?? "Not selected"}
            </p>
            {formState.os && (
              <p className="text-xs text-muted-foreground">
                {formState.os.description} - {formState.os.arch}
              </p>
            )}
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              Instance Type
            </h4>
            <p className="text-sm font-medium">
              {formState.instanceType?.name ?? "Not selected"}
            </p>
            {formState.instanceType && (
              <p className="text-xs text-muted-foreground">
                {formState.instanceType.vCPUs} vCPUs, {formState.instanceType.memory} GB RAM
                - {formState.instanceType.category}
              </p>
            )}
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              Networking
            </h4>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">VPC</span>
                <span>{formState.vpc || "Not selected"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subnet</span>
                <span>{formState.subnet || "Not selected"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Security Group</span>
                <span>{formState.securityGroup || "Not selected"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Public IP</span>
                <span>{formState.publicIp ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              Storage
            </h4>
            <div className="text-sm">
              <p>
                Root: {formState.rootVolumeSize} GB ({formState.rootVolumeType})
              </p>
              {formState.additionalVolumes.map((vol, i) => (
                <p key={i}>
                  {vol.name}: {vol.size} GB ({vol.type})
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Estimated Monthly Cost</h4>
              <p className="text-xs text-muted-foreground">
                Based on 730 hours/month (on-demand pricing)
              </p>
            </div>
            <span className="text-2xl font-bold">
              ${monthlyEstimate.toFixed(2)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CreateInstancePage() {
  const router = useRouter()
  const { provider, region } = useCloudProvider()
  const [currentStep, setCurrentStep] = useState(0)
  const [isLaunching, setIsLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [formState, setFormState] = useState<FormState>({
    os: null,
    instanceType: null,
    vpc: "",
    subnet: "",
    securityGroup: "",
    publicIp: true,
    rootVolumeSize: 30,
    rootVolumeType: "gp3",
    additionalVolumes: [],
  })

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0:
        return formState.os !== null
      case 1:
        return formState.instanceType !== null
      case 2:
        return formState.vpc !== "" && formState.subnet !== "" && formState.securityGroup !== ""
      case 3:
        return formState.rootVolumeSize >= 8
      case 4:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleLaunch = async () => {
    if (!formState.os || !formState.instanceType) return

    setIsLaunching(true)
    setLaunchError(null)

    try {
      const instanceData = {
        name: `instance-${Date.now()}`,
        os: formState.os.id,
        instanceType: formState.instanceType.id,
        provider,
        region,
        vpc: formState.vpc,
        subnet: formState.subnet,
        securityGroup: formState.securityGroup,
        publicIp: formState.publicIp,
        rootVolume: {
          size: formState.rootVolumeSize,
          type: formState.rootVolumeType,
        },
        additionalVolumes: formState.additionalVolumes,
      }

      await apiClient.post(`/cloud/${provider}/compute/instances`, instanceData)
      router.push("/dashboard/compute/instances")
    } catch (err: any) {
      setLaunchError(err?.message ?? "Failed to launch instance. Please try again.")
      setIsLaunching(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <StepOS formState={formState} setFormState={setFormState} />
      case 1:
        return (
          <StepInstanceType formState={formState} setFormState={setFormState} />
        )
      case 2:
        return (
          <StepNetworking formState={formState} setFormState={setFormState} />
        )
      case 3:
        return (
          <StepStorage formState={formState} setFormState={setFormState} />
        )
      case 4:
        return <StepReview formState={formState} error={launchError} />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/compute/instances")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Instances
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Instance</h1>
        <p className="text-muted-foreground mt-1">
          Launch a new compute instance with a step-by-step wizard.
        </p>
      </div>

      <Stepper currentStep={currentStep} steps={STEPS} />

      {renderStep()}

      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        {currentStep < STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleLaunch} disabled={!canProceed() || isLaunching}>
            {isLaunching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Monitor className="mr-2 h-4 w-4" />
                Launch Instance
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
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
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

const STEPS = [
  { key: "engine", label: "Engine" },
  { key: "instance", label: "Instance Class" },
  { key: "storage", label: "Storage" },
  { key: "network", label: "Network" },
  { key: "auth", label: "Authentication" },
  { key: "review", label: "Review" },
] as const

type Engine = {
  id: string
  name: string
  description: string
  versions: string[]
}

type InstanceClass = {
  id: string
  name: string
  vCPUs: number
  memory: number
  pricePerHour: number
  category: string
}

type FormState = {
  engine: string
  engineVersion: string
  instanceClass: string
  storageType: string
  storageSize: number
  multiAz: boolean
  vpc: string
  subnetGroup: string
  publicAccess: boolean
  masterUsername: string
  masterPassword: string
  databaseName: string
}

const engines: Engine[] = [
  { id: "mysql", name: "MySQL", description: "Popular open-source relational database", versions: ["8.0.35", "8.0.33", "5.7.44"] },
  { id: "postgresql", name: "PostgreSQL", description: "Advanced open-source relational database", versions: ["16.1", "15.4", "14.9", "13.13"] },
  { id: "sql-server", name: "SQL Server", description: "Microsoft SQL Server", versions: ["2022", "2019", "2017"] },
  { id: "mariadb", name: "MariaDB", description: "Community fork of MySQL", versions: ["10.11.6", "10.6.16", "10.5.23"] },
]

const instanceClasses: InstanceClass[] = [
  { id: "db.t3.micro", name: "db.t3.micro", vCPUs: 2, memory: 1, pricePerHour: 0.017, category: "Burstable" },
  { id: "db.t3.small", name: "db.t3.small", vCPUs: 2, memory: 2, pricePerHour: 0.034, category: "Burstable" },
  { id: "db.t3.medium", name: "db.t3.medium", vCPUs: 2, memory: 4, pricePerHour: 0.068, category: "Burstable" },
  { id: "db.r5.large", name: "db.r5.large", vCPUs: 2, memory: 16, pricePerHour: 0.25, category: "Memory Optimized" },
  { id: "db.r5.xlarge", name: "db.r5.xlarge", vCPUs: 4, memory: 32, pricePerHour: 0.50, category: "Memory Optimized" },
  { id: "db.r5.2xlarge", name: "db.r5.2xlarge", vCPUs: 8, memory: 64, pricePerHour: 1.00, category: "Memory Optimized" },
  { id: "db.m5.large", name: "db.m5.large", vCPUs: 2, memory: 8, pricePerHour: 0.171, category: "General Purpose" },
  { id: "db.m5.xlarge", name: "db.m5.xlarge", vCPUs: 4, memory: 16, pricePerHour: 0.342, category: "General Purpose" },
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
              className={`text-sm hidden lg:inline ${
                index === currentStep ? "font-medium" : "text-muted-foreground"
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

function StepEngine({
  formState,
  setFormState,
}: {
  formState: FormState
  setFormState: React.Dispatch<React.SetStateAction<FormState>>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Database Engine</CardTitle>
        <CardDescription>Choose the database engine for your instance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {engines.map((engine) => (
            <div
              key={engine.id}
              className={`cursor-pointer rounded-lg border-2 p-4 transition-colors hover:border-primary/50 ${
                formState.engine === engine.id
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
              onClick={() =>
                setFormState((prev) => ({
                  ...prev,
                  engine: engine.id,
                  engineVersion: engine.versions[0],
                }))
              }
            >
              <p className="font-medium">{engine.name}</p>
              <p className="text-xs text-muted-foreground">{engine.description}</p>
            </div>
          ))}
        </div>
        {formState.engine && (
          <div className="space-y-2">
            <Label>Engine Version</Label>
            <Select
              value={formState.engineVersion}
              onValueChange={(v) =>
                setFormState((prev) => ({ ...prev, engineVersion: v }))
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {engines
                  .find((e) => e.id === formState.engine)
                  ?.versions.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StepInstance({
  formState,
  setFormState,
}: {
  formState: FormState
  setFormState: React.Dispatch<React.SetStateAction<FormState>>
}) {
  const [categoryFilter, setCategoryFilter] = useState("all")
  const categories = [...new Set(instanceClasses.map((t) => t.category))]
  const filtered =
    categoryFilter === "all"
      ? instanceClasses
      : instanceClasses.filter((t) => t.category === categoryFilter)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Instance Class</CardTitle>
        <CardDescription>Choose the computing power for your database</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
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
          {filtered.map((cls) => (
            <div
              key={cls.id}
              className={`grid grid-cols-6 gap-4 p-3 text-sm cursor-pointer border-t transition-colors hover:bg-muted/50 ${
                formState.instanceClass === cls.id
                  ? "bg-primary/5 border-l-2 border-l-primary"
                  : ""
              }`}
              onClick={() =>
                setFormState((prev) => ({ ...prev, instanceClass: cls.id }))
              }
            >
              <span className="font-medium font-mono">{cls.name}</span>
              <span className="text-muted-foreground">{cls.category}</span>
              <span className="text-right">{cls.vCPUs}</span>
              <span className="text-right">{cls.memory}</span>
              <span className="text-right">${cls.pricePerHour.toFixed(3)}</span>
              <span className="text-right font-medium">
                ${(cls.pricePerHour * 730).toFixed(2)}
              </span>
            </div>
          ))}
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure Storage</CardTitle>
        <CardDescription>Set storage type, size, and availability</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="storage-type">Storage Type</Label>
            <Select
              value={formState.storageType}
              onValueChange={(v) =>
                setFormState((prev) => ({ ...prev, storageType: v }))
              }
            >
              <SelectTrigger id="storage-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gp3">General Purpose SSD (gp3)</SelectItem>
                <SelectItem value="gp2">General Purpose SSD (gp2)</SelectItem>
                <SelectItem value="io1">Provisioned IOPS SSD (io1)</SelectItem>
                <SelectItem value="magnetic">Magnetic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="storage-size">Allocated Storage (GB)</Label>
            <Input
              id="storage-size"
              type="number"
              min={20}
              max={65536}
              value={formState.storageSize}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  storageSize: parseInt(e.target.value) || 20,
                }))
              }
            />
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <Label htmlFor="multi-az">Multi-AZ Deployment</Label>
            <p className="text-sm text-muted-foreground">
              Create a standby instance in a different availability zone for high availability
            </p>
          </div>
          <Switch
            id="multi-az"
            checked={formState.multiAz}
            onCheckedChange={(checked) =>
              setFormState((prev) => ({ ...prev, multiAz: checked }))
            }
          />
        </div>
      </CardContent>
    </Card>
  )
}

function StepNetwork({
  formState,
  setFormState,
}: {
  formState: FormState
  setFormState: React.Dispatch<React.SetStateAction<FormState>>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure Network</CardTitle>
        <CardDescription>Set VPC, subnet group, and access settings</CardDescription>
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
            <Label htmlFor="subnet-group">DB Subnet Group</Label>
            <Select
              value={formState.subnetGroup}
              onValueChange={(v) =>
                setFormState((prev) => ({ ...prev, subnetGroup: v }))
              }
            >
              <SelectTrigger id="subnet-group">
                <SelectValue placeholder="Select subnet group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default subnet group</SelectItem>
                <SelectItem value="private-subnets">Private subnets</SelectItem>
                <SelectItem value="public-subnets">Public subnets</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <Label htmlFor="public-access">Public Access</Label>
            <p className="text-sm text-muted-foreground">
              Allow connections from outside the VPC
            </p>
          </div>
          <Switch
            id="public-access"
            checked={formState.publicAccess}
            onCheckedChange={(checked) =>
              setFormState((prev) => ({ ...prev, publicAccess: checked }))
            }
          />
        </div>
        {formState.publicAccess && (
          <p className="text-xs text-destructive">
            Warning: Enabling public access exposes the database to the internet. Ensure proper security group rules.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function StepAuth({
  formState,
  setFormState,
}: {
  formState: FormState
  setFormState: React.Dispatch<React.SetStateAction<FormState>>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Authentication</CardTitle>
        <CardDescription>Set master user credentials</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="db-name">Database Name</Label>
          <Input
            id="db-name"
            placeholder="myapp_production"
            value={formState.databaseName}
            onChange={(e) =>
              setFormState((prev) => ({ ...prev, databaseName: e.target.value }))
            }
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="master-user">Master Username</Label>
            <Input
              id="master-user"
              placeholder="admin"
              value={formState.masterUsername}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, masterUsername: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="master-pass">Master Password</Label>
            <Input
              id="master-pass"
              type="password"
              placeholder="Enter a strong password"
              value={formState.masterPassword}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, masterPassword: e.target.value }))
              }
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Password must be at least 8 characters and include uppercase, lowercase, and numbers.
        </p>
      </CardContent>
    </Card>
  )
}

function StepReview({ formState }: { formState: FormState }) {
  const selectedEngine = engines.find((e) => e.id === formState.engine)
  const selectedInstance = instanceClasses.find((c) => c.id === formState.instanceClass)
  const monthlyEstimate = selectedInstance ? selectedInstance.pricePerHour * 730 : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review & Create</CardTitle>
        <CardDescription>Review your database configuration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border p-4 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Engine</h4>
            <p className="text-sm font-medium">
              {selectedEngine?.name ?? "Not selected"} {formState.engineVersion}
            </p>
          </div>
          <Separator />
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Instance Class</h4>
            <p className="text-sm font-medium">{selectedInstance?.name ?? "Not selected"}</p>
            {selectedInstance && (
              <p className="text-xs text-muted-foreground">
                {selectedInstance.vCPUs} vCPUs, {selectedInstance.memory} GB RAM - {selectedInstance.category}
              </p>
            )}
          </div>
          <Separator />
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Storage</h4>
            <p className="text-sm font-medium">{formState.storageSize} GB ({formState.storageType})</p>
            <p className="text-xs text-muted-foreground">
              Multi-AZ: {formState.multiAz ? "Enabled" : "Disabled"}
            </p>
          </div>
          <Separator />
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Network</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">VPC</span>
                <span>{formState.vpc || "Not selected"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subnet Group</span>
                <span>{formState.subnetGroup || "Not selected"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Public Access</span>
                <span>{formState.publicAccess ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
          </div>
          <Separator />
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Authentication</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Database Name</span>
                <span>{formState.databaseName || "Not set"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Master Username</span>
                <span>{formState.masterUsername || "Not set"}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Estimated Monthly Cost</h4>
              <p className="text-xs text-muted-foreground">
                Based on 730 hours/month (on-demand pricing, compute only)
              </p>
            </div>
            <span className="text-2xl font-bold">${monthlyEstimate.toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CreateDatabasePage() {
  const { data: regions } = useQuery({ queryKey: ['regions'], queryFn: () => apiClient.get('/v1/cloud/aws/compute/instances'), enabled: false })
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [formState, setFormState] = useState<FormState>({
    engine: "",
    engineVersion: "",
    instanceClass: "",
    storageType: "gp3",
    storageSize: 100,
    multiAz: false,
    vpc: "",
    subnetGroup: "",
    publicAccess: false,
    masterUsername: "",
    masterPassword: "",
    databaseName: "",
  })

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0: return formState.engine !== "" && formState.engineVersion !== ""
      case 1: return formState.instanceClass !== ""
      case 2: return formState.storageSize >= 20
      case 3: return formState.vpc !== "" && formState.subnetGroup !== ""
      case 4: return formState.masterUsername.length >= 1 && formState.masterPassword.length >= 8
      case 5: return true
      default: return false
    }
  }

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep((prev) => prev + 1)
  }
  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1)
  }
  const handleCreate = () => {
    router.push("/dashboard/databases/relational")
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <StepEngine formState={formState} setFormState={setFormState} />
      case 1: return <StepInstance formState={formState} setFormState={setFormState} />
      case 2: return <StepStorage formState={formState} setFormState={setFormState} />
      case 3: return <StepNetwork formState={formState} setFormState={setFormState} />
      case 4: return <StepAuth formState={formState} setFormState={setFormState} />
      case 5: return <StepReview formState={formState} />
      default: return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/databases/relational")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Databases
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Database</h1>
        <p className="text-muted-foreground mt-1">
          Launch a new relational database with a step-by-step wizard.
        </p>
      </div>

      <Stepper currentStep={currentStep} steps={STEPS} />

      {renderStep()}

      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        {currentStep < STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={!canProceed()}>
            <Database className="mr-2 h-4 w-4" />
            Create Database
          </Button>
        )}
      </div>
    </div>
  )
}

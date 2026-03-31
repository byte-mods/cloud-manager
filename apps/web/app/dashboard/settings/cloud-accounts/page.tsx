"use client"

import { useCloudAccounts } from "@/hooks/use-settings"
import { useState, useEffect, useCallback } from "react"
import { Plus, Cloud, RefreshCw, Check, AlertCircle, Trash2 } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

type ProviderStatus = {
  provider: string
  configured: boolean
  status: string
}

type CredentialStatusResponse = {
  providers: ProviderStatus[]
  mock_mode: boolean
}

const providerInfo: Record<string, { name: string; color: string; icon: string }> = {
  aws: { name: "Amazon Web Services", color: "bg-orange-500/10 text-orange-500 border-orange-500/20", icon: "AWS" },
  gcp: { name: "Google Cloud Platform", color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: "GCP" },
  azure: { name: "Microsoft Azure", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20", icon: "Azure" },
}

export default function CloudAccountsPage() {
  const { data: accounts } = useCloudAccounts()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState("aws")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusData, setStatusData] = useState<CredentialStatusResponse | null>(null)
  const [successMsg, setSuccessMsg] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  // Form state
  const [accountName, setAccountName] = useState("")
  const [awsAccessKey, setAwsAccessKey] = useState("")
  const [awsSecretKey, setAwsSecretKey] = useState("")
  const [awsRegion, setAwsRegion] = useState("us-east-1")
  const [gcpProjectId, setGcpProjectId] = useState("")
  const [gcpServiceAccountJson, setGcpServiceAccountJson] = useState("")
  const [azureTenantId, setAzureTenantId] = useState("")
  const [azureClientId, setAzureClientId] = useState("")
  const [azureClientSecret, setAzureClientSecret] = useState("")
  const [azureSubscriptionId, setAzureSubscriptionId] = useState("")

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetch("/api/v1/cloud/credentials/status")
      if (resp.ok) {
        const data = await resp.json()
        setStatusData(data)
      }
    } catch {
      // Backend may not be running
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const resetForm = () => {
    setAccountName("")
    setAwsAccessKey("")
    setAwsSecretKey("")
    setAwsRegion("us-east-1")
    setGcpProjectId("")
    setGcpServiceAccountJson("")
    setAzureTenantId("")
    setAzureClientId("")
    setAzureClientSecret("")
    setAzureSubscriptionId("")
    setErrorMsg("")
  }

  const handleSave = async () => {
    setSaving(true)
    setErrorMsg("")
    setSuccessMsg("")

    let credentials: Record<string, unknown> = {}

    if (selectedProvider === "aws") {
      if (!awsAccessKey || !awsSecretKey) {
        setErrorMsg("Access Key ID and Secret Access Key are required")
        setSaving(false)
        return
      }
      credentials = {
        type: "aws",
        access_key_id: awsAccessKey,
        secret_access_key: awsSecretKey,
        region: awsRegion || null,
      }
    } else if (selectedProvider === "gcp") {
      if (!gcpProjectId || !gcpServiceAccountJson) {
        setErrorMsg("Project ID and Service Account JSON are required")
        setSaving(false)
        return
      }
      credentials = {
        type: "gcp",
        project_id: gcpProjectId,
        service_account_json: gcpServiceAccountJson,
      }
    } else if (selectedProvider === "azure") {
      if (!azureTenantId || !azureClientId || !azureClientSecret || !azureSubscriptionId) {
        setErrorMsg("All Azure fields are required")
        setSaving(false)
        return
      }
      credentials = {
        type: "azure",
        tenant_id: azureTenantId,
        client_id: azureClientId,
        client_secret: azureClientSecret,
        subscription_id: azureSubscriptionId,
      }
    }

    try {
      const resp = await fetch("/api/v1/cloud/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          name: accountName || `${providerInfo[selectedProvider].name} Account`,
          credentials,
        }),
      })

      const data = await resp.json()

      if (resp.ok) {
        setSuccessMsg(data.message || "Credentials saved successfully!")
        setIsDialogOpen(false)
        resetForm()
        fetchStatus()
      } else {
        setErrorMsg(data.message || data.error || "Failed to save credentials")
      }
    } catch (err) {
      setErrorMsg("Failed to connect to backend. Make sure services are running.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (provider: string) => {
    try {
      const resp = await fetch(`/api/v1/cloud/credentials/${provider}`, { method: "DELETE" })
      if (resp.ok) {
        setSuccessMsg(`${providerInfo[provider].name} credentials removed. Restart to apply.`)
        fetchStatus()
      }
    } catch {
      setErrorMsg("Failed to remove credentials")
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cloud Accounts</h1>
          <p className="text-muted-foreground mt-1">Connect and manage cloud provider credentials.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Connect Account</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Connect Cloud Account</DialogTitle>
                <DialogDescription>
                  Provide credentials to connect a cloud provider. Credentials are saved to .env.cloud and applied on service restart.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aws">Amazon Web Services</SelectItem>
                      <SelectItem value="gcp">Google Cloud Platform</SelectItem>
                      <SelectItem value="azure">Microsoft Azure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Account Name</Label>
                  <Input
                    placeholder="e.g., Production AWS"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                  />
                </div>

                {selectedProvider === "aws" && (
                  <>
                    <div className="space-y-2">
                      <Label>Access Key ID <span className="text-red-500">*</span></Label>
                      <Input
                        placeholder="AKIAIOSFODNN7EXAMPLE"
                        value={awsAccessKey}
                        onChange={(e) => setAwsAccessKey(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Secret Access Key <span className="text-red-500">*</span></Label>
                      <Input
                        type="password"
                        placeholder="Enter secret access key"
                        value={awsSecretKey}
                        onChange={(e) => setAwsSecretKey(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Default Region</Label>
                      <Select value={awsRegion} onValueChange={setAwsRegion}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                          <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                          <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                          <SelectItem value="eu-central-1">EU (Frankfurt)</SelectItem>
                          <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                          <SelectItem value="ap-northeast-1">Asia Pacific (Tokyo)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {selectedProvider === "gcp" && (
                  <>
                    <div className="space-y-2">
                      <Label>Project ID <span className="text-red-500">*</span></Label>
                      <Input
                        placeholder="my-project-id"
                        value={gcpProjectId}
                        onChange={(e) => setGcpProjectId(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Service Account Key (JSON) <span className="text-red-500">*</span></Label>
                      <Textarea
                        placeholder='Paste your service account JSON key here...'
                        rows={6}
                        className="font-mono text-xs"
                        value={gcpServiceAccountJson}
                        onChange={(e) => setGcpServiceAccountJson(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Download from GCP Console &gt; IAM &gt; Service Accounts &gt; Keys
                      </p>
                    </div>
                  </>
                )}

                {selectedProvider === "azure" && (
                  <>
                    <div className="space-y-2">
                      <Label>Tenant ID <span className="text-red-500">*</span></Label>
                      <Input
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        value={azureTenantId}
                        onChange={(e) => setAzureTenantId(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Client ID <span className="text-red-500">*</span></Label>
                      <Input
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        value={azureClientId}
                        onChange={(e) => setAzureClientId(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Client Secret <span className="text-red-500">*</span></Label>
                      <Input
                        type="password"
                        placeholder="Enter client secret"
                        value={azureClientSecret}
                        onChange={(e) => setAzureClientSecret(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subscription ID <span className="text-red-500">*</span></Label>
                      <Input
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        value={azureSubscriptionId}
                        onChange={(e) => setAzureSubscriptionId(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                  </>
                )}

                {errorMsg && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMsg}</AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save & Connect"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {successMsg && (
        <Alert className="border-green-500/20 bg-green-500/5">
          <Check className="h-4 w-4 text-green-500" />
          <AlertTitle className="text-green-600">Success</AlertTitle>
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* Provider Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {["aws", "gcp", "azure"].map((provider) => {
          const info = providerInfo[provider]
          const status = statusData?.providers?.find((p) => p.provider === provider)
          const isConfigured = status?.configured ?? false
          const statusText = status?.status ?? "not_configured"

          return (
            <Card key={provider} className={isConfigured ? "border-green-500/30" : ""}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{info.name}</CardTitle>
                <Badge className={info.color}>{info.icon}</Badge>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {isConfigured ? (
                        <Badge className="bg-green-500/10 text-green-500">
                          <Check className="h-3 w-3 mr-1" />
                          {statusText === "connected" ? "Connected" : "Configured"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Not Configured</Badge>
                      )}
                    </div>
                    {statusData?.mock_mode && (
                      <p className="text-xs text-muted-foreground">Mock mode active</p>
                    )}
                  </div>
                  {isConfigured && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(provider)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            How it works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p><strong>1. Add credentials</strong> — Click &quot;Connect Account&quot; and enter your cloud provider credentials.</p>
          <p><strong>2. Credentials are saved</strong> — Stored in <code className="text-xs bg-muted px-1 py-0.5 rounded">.env.cloud</code> file at the project root.</p>
          <p><strong>3. Restart services</strong> — Run <code className="text-xs bg-muted px-1 py-0.5 rounded">./start.sh</code> to restart with real cloud APIs.</p>
          <p><strong>4. Mock mode</strong> — Set <code className="text-xs bg-muted px-1 py-0.5 rounded">CLOUD_USE_MOCK_DATA=true</code> to switch back to simulated data.</p>
          <p className="text-xs pt-2 border-t">
            Credentials are never sent to external servers. They are stored locally and used only for direct cloud API calls.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

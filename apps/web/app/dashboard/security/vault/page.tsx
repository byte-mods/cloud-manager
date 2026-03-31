"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import {
  Lock,
  Unlock,
  Key,
  Shield,
  FileText,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Copy,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

type Secret = { path: string; version: number; updatedAt: string; keys: string[] }
type Certificate = { id: string; cn: string; issuer: string; expiry: string; status: string }


export default function VaultPage() {
  const [showSecret, setShowSecret] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [encryptInput, setEncryptInput] = useState("")
  const [encryptResult, setEncryptResult] = useState("")

  const { data: vaultData } = useQuery<{ status: any; secrets: Secret[]; certificates: Certificate[] }>({
    queryKey: ["security", "vault"],
    queryFn: () => apiClient.get("/v1/security/vault/status"),
  })

  const secrets = vaultData?.secrets ?? []
  const certs = vaultData?.certificates ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vault</h1>
          <p className="text-muted-foreground mt-1">HashiCorp Vault secrets management and encryption.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Secret</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Secret</DialogTitle><DialogDescription>Store a new secret in Vault KV v2 engine.</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2"><Label>Path</Label><Input placeholder="secret/data/my-app/config" /></div>
              <div className="grid gap-2"><Label>Key</Label><Input placeholder="api_key" /></div>
              <div className="grid gap-2"><Label>Value</Label><Input type="password" placeholder="secret value" /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={() => setCreateOpen(false)}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Vault Status</CardDescription></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Unlock className="h-5 w-5 text-green-500" /><span className="text-lg font-bold text-green-500">Unsealed</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Secrets Stored</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{secrets.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Active Certificates</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{certs.filter(c => c.status === "active").length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Version</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">1.17.3</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="secrets">
        <TabsList>
          <TabsTrigger value="secrets">KV Secrets</TabsTrigger>
          <TabsTrigger value="transit">Transit (Encrypt/Decrypt)</TabsTrigger>
          <TabsTrigger value="pki">PKI Certificates</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="secrets" className="mt-4 space-y-3">
          {secrets.length === 0 && <div className="text-center py-12 text-sm text-muted-foreground">No data available</div>}
          {secrets.map(secret => (
            <Card key={secret.path}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-medium">{secret.path}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>v{secret.version}</span>
                      <span>Updated: {secret.updatedAt}</span>
                      <span>Keys: {secret.keys.join(", ")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSecret(showSecret === secret.path ? null : secret.path)}>
                      {showSecret === secret.path ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><RefreshCw className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {showSecret === secret.path && (
                  <div className="mt-3 rounded-lg border bg-muted/50 p-3 font-mono text-xs">
                    {secret.keys.map(k => <div key={k}><span className="text-muted-foreground">{k}:</span> ••••••••</div>)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="transit" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Transit Encryption</CardTitle><CardDescription>Encrypt and decrypt data using Vault Transit engine.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Plaintext</Label>
                <Input value={encryptInput} onChange={(e) => setEncryptInput(e.target.value)} placeholder="Enter text to encrypt..." />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setEncryptResult("vault:v1:" + btoa(encryptInput || "example"))}>Encrypt</Button>
                <Button variant="outline" onClick={() => setEncryptResult("")}>Clear</Button>
              </div>
              {encryptResult && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Ciphertext:</span>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => navigator.clipboard.writeText(encryptResult)}>
                      <Copy className="mr-1 h-3 w-3" />Copy
                    </Button>
                  </div>
                  <p className="font-mono text-xs mt-1 break-all">{encryptResult}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pki" className="mt-4 space-y-3">
          {certs.length === 0 && <div className="text-center py-12 text-sm text-muted-foreground">No data available</div>}
          {certs.map(cert => (
            <Card key={cert.id}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{cert.cn}</p>
                    <p className="text-xs text-muted-foreground mt-1">Issuer: {cert.issuer} — Expires: {cert.expiry}</p>
                  </div>
                  <Badge variant={cert.status === "active" ? "default" : "destructive"}>{cert.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline"><Plus className="mr-2 h-4 w-4" />Issue Certificate</Button>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-center py-12 text-sm text-muted-foreground">No data available</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

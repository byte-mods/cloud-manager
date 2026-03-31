"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Upload,
  Download,
  Trash2,
  FolderOpen,
  File,
  ChevronRight,
  Settings,
  Shield,
  RotateCcw,
  Copy,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { useResources, type Resource } from "@/hooks/use-resources"

type BucketDetail = Resource & {
  metadata?: {
    objectsCount?: number
    size?: string
    accessLevel?: string
    storageClass?: string
    versioning?: boolean
    encryption?: string
    region?: string
    endpoint?: string
  }
}

type StorageObject = {
  key: string
  name: string
  size: string
  type: "file" | "folder"
  lastModified: string
  storageClass: string
  contentType: string
}


function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">Bucket not found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        The requested bucket could not be found or has been deleted.
      </p>
      <Button asChild>
        <Link href="/dashboard/storage/object">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Buckets
        </Link>
      </Button>
    </div>
  )
}

export default function BucketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const bucketId = params.id as string
  const { data, isLoading } = useResources("storage/object")
  const [currentPath, setCurrentPath] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedObjects, setSelectedObjects] = useState<Set<string>>(new Set())

  const bucket = (data?.resources ?? []).find(
    (r) => r.id === bucketId
  ) as BucketDetail | undefined

  const pathSegments = currentPath

  const displayObjects = ([] as StorageObject[]).filter((obj) => {
    if (currentPath.length === 0) return true
    const prefix = currentPath.join("/") + "/"
    return obj.key.startsWith(prefix)
  })

  const handleUpload = () => {
    setUploading(true)
    setUploadProgress(0)
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setUploading(false)
          return 0
        }
        return prev + 10
      })
    }, 300)
  }

  const toggleSelection = (key: string) => {
    setSelectedObjects((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  if (isLoading) return <LoadingSkeleton />
  if (!bucket) return <EmptyState />

  const meta = bucket.metadata ?? {}

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/storage/object")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {bucket.name}
            </h1>
            <Badge variant={meta.accessLevel === "public-read" ? "destructive" : "default"}>
              {meta.accessLevel ?? "private"}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            {bucket.id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleUpload}>
            <Upload className="mr-1 h-4 w-4" /> Upload
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedObjects.size === 0}
          >
            <Download className="mr-1 h-4 w-4" /> Download
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedObjects.size === 0}
          >
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {uploading && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Uploading files...</span>
              <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="objects">
        <TabsList>
          <TabsTrigger value="objects">Objects</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
          <TabsTrigger value="replication">Replication</TabsTrigger>
          <TabsTrigger value="cors">CORS</TabsTrigger>
          <TabsTrigger value="presigned">Pre-signed URLs</TabsTrigger>
        </TabsList>

        <TabsContent value="objects" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-sm">
                <button
                  className="text-primary hover:underline font-medium"
                  onClick={() => setCurrentPath([])}
                >
                  {bucket.name}
                </button>
                {pathSegments.map((segment, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <button
                      className="text-primary hover:underline font-medium"
                      onClick={() => setCurrentPath(pathSegments.slice(0, index + 1))}
                    >
                      {segment}
                    </button>
                  </div>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <div className="grid grid-cols-6 gap-4 p-3 bg-muted text-sm font-medium">
                  <span className="col-span-2">Name</span>
                  <span>Size</span>
                  <span>Type</span>
                  <span>Last Modified</span>
                  <span>Storage Class</span>
                </div>
                {displayObjects.map((obj) => (
                  <div
                    key={obj.key}
                    className={`grid grid-cols-6 gap-4 p-3 text-sm border-t transition-colors hover:bg-muted/50 cursor-pointer ${
                      selectedObjects.has(obj.key) ? "bg-primary/5" : ""
                    }`}
                    onClick={() => {
                      if (obj.type === "folder") {
                        setCurrentPath([...currentPath, obj.name])
                      } else {
                        toggleSelection(obj.key)
                      }
                    }}
                  >
                    <div className="col-span-2 flex items-center gap-2">
                      {obj.type === "folder" ? (
                        <FolderOpen className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <File className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">{obj.name}</span>
                    </div>
                    <span className="text-muted-foreground">{obj.size}</span>
                    <span className="text-muted-foreground">{obj.contentType}</span>
                    <span className="text-muted-foreground">{obj.lastModified}</span>
                    <span className="text-muted-foreground">{obj.storageClass}</span>
                  </div>
                ))}
                {displayObjects.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    This folder is empty.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="properties" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bucket Properties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Bucket Name</p>
                  <p className="text-sm font-medium">{bucket.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Provider</p>
                  <p className="text-sm font-medium uppercase">{bucket.provider}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Region</p>
                  <p className="text-sm font-medium">{bucket.region}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Storage Class</p>
                  <p className="text-sm font-medium">{meta.storageClass ?? "STANDARD"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Versioning</p>
                  <Badge variant={meta.versioning ? "default" : "secondary"}>
                    {meta.versioning ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Encryption</p>
                  <p className="text-sm font-medium">{meta.encryption ?? "AES-256"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Objects</p>
                  <p className="text-sm font-medium">{meta.objectsCount?.toLocaleString() ?? "0"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Size</p>
                  <p className="text-sm font-medium">{meta.size ?? "0 bytes"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-sm font-medium">{bucket.createdAt}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Access Control
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="text-sm font-medium">Block Public Access</p>
                    <p className="text-xs text-muted-foreground">
                      Prevent public access to objects in this bucket
                    </p>
                  </div>
                  <Badge variant={meta.accessLevel === "private" ? "default" : "destructive"}>
                    {meta.accessLevel === "private" ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="text-sm font-medium">Bucket Policy</p>
                    <p className="text-xs text-muted-foreground">
                      JSON-based access policy for this bucket
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Settings className="mr-1 h-3 w-3" /> Edit Policy
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="text-sm font-medium">CORS Configuration</p>
                    <p className="text-xs text-muted-foreground">
                      Cross-origin resource sharing rules
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Settings className="mr-1 h-3 w-3" /> Configure
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lifecycle" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Lifecycle Rules
              </CardTitle>
              <CardDescription>
                Automatically transition or expire objects based on rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Move to IA after 30 days</p>
                    <p className="text-xs text-muted-foreground">
                      Prefix: logs/ - Transition to STANDARD_IA
                    </p>
                  </div>
                  <Badge>Active</Badge>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Archive after 90 days</p>
                    <p className="text-xs text-muted-foreground">
                      Prefix: data/ - Transition to GLACIER
                    </p>
                  </div>
                  <Badge>Active</Badge>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Delete after 365 days</p>
                    <p className="text-xs text-muted-foreground">
                      Prefix: temp/ - Expiration
                    </p>
                  </div>
                  <Badge variant="secondary">Disabled</Badge>
                </div>
              </div>
              <Button variant="outline" className="mt-4">
                Add Lifecycle Rule
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="replication" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Copy className="h-5 w-5" />
                Replication Rules
              </CardTitle>
              <CardDescription>
                Cross-region replication configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Cross-Region Backup</p>
                    <p className="text-xs text-muted-foreground">
                      Replicate to eu-west-1 bucket
                    </p>
                  </div>
                  <Badge>Active</Badge>
                </div>
              </div>
              <Button variant="outline" className="mt-4">
                Add Replication Rule
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>CORS Configuration</CardTitle>
              <CardDescription>Cross-Origin Resource Sharing rules for browser access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="rounded-md border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Rule 1</p>
                    <Badge>Active</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Allowed Origins:</span> <span className="font-mono">https://app.example.com</span></div>
                    <div><span className="text-muted-foreground">Allowed Methods:</span> <span className="font-mono">GET, PUT, POST</span></div>
                    <div><span className="text-muted-foreground">Allowed Headers:</span> <span className="font-mono">*</span></div>
                    <div><span className="text-muted-foreground">Max Age:</span> <span className="font-mono">3600s</span></div>
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Rule 2</p>
                    <Badge>Active</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Allowed Origins:</span> <span className="font-mono">https://cdn.example.com</span></div>
                    <div><span className="text-muted-foreground">Allowed Methods:</span> <span className="font-mono">GET</span></div>
                    <div><span className="text-muted-foreground">Allowed Headers:</span> <span className="font-mono">Authorization, Content-Type</span></div>
                    <div><span className="text-muted-foreground">Expose Headers:</span> <span className="font-mono">ETag, x-amz-request-id</span></div>
                  </div>
                </div>
              </div>
              <Button variant="outline" className="mt-4">Add CORS Rule</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="presigned" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pre-signed URL Generator</CardTitle>
              <CardDescription>Generate temporary URLs for secure access to objects without credentials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Object Key</label>
                  <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="path/to/object.jpg" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Expiration</label>
                  <select className="w-full rounded-md border px-3 py-2 text-sm">
                    <option>15 minutes</option>
                    <option>1 hour</option>
                    <option>6 hours</option>
                    <option>24 hours</option>
                    <option>7 days</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">HTTP Method</label>
                  <select className="w-full rounded-md border px-3 py-2 text-sm">
                    <option>GET (Download)</option>
                    <option>PUT (Upload)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Content Type (PUT only)</label>
                  <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="application/octet-stream" />
                </div>
              </div>
              <Button>Generate URL</Button>
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Generated URL:</p>
                <p className="text-xs font-mono break-all">https://my-bucket.s3.amazonaws.com/path/to/object.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...&X-Amz-Expires=3600&X-Amz-Signature=...</p>
                <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs"><Copy className="mr-1 h-3 w-3" />Copy URL</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

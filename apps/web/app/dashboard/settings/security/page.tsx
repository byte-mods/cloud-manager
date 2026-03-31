"use client"

import { useProfile } from "@/hooks/use-settings"
import { useState } from "react"
import { Shield, Key, Monitor, MapPin, Clock, Fingerprint, Smartphone } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

const loginHistory = [
  { id: "1", time: "2026-03-31 10:15 AM", ip: "203.0.113.45", location: "San Francisco, CA", device: "Chrome on macOS", status: "success" },
  { id: "2", time: "2026-03-30 03:22 PM", ip: "203.0.113.45", location: "San Francisco, CA", device: "Chrome on macOS", status: "success" },
  { id: "3", time: "2026-03-29 09:10 AM", ip: "198.51.100.20", location: "New York, NY", device: "Firefox on Windows", status: "success" },
  { id: "4", time: "2026-03-28 11:45 PM", ip: "192.0.2.100", location: "Unknown", device: "Unknown Browser", status: "failed" },
  { id: "5", time: "2026-03-28 06:30 AM", ip: "203.0.113.45", location: "San Francisco, CA", device: "Safari on iPhone", status: "success" },
]

const trustedDevices = [
  { id: "1", name: "MacBook Pro — Chrome", lastUsed: "2 hours ago", trusted: true },
  { id: "2", name: "iPhone 15 — Safari", lastUsed: "3 days ago", trusted: true },
  { id: "3", name: "Windows PC — Firefox", lastUsed: "2 days ago", trusted: false },
]

export default function SecuritySettingsPage() {
  const { data: profile } = useProfile()
  const [mfaEnabled, setMfaEnabled] = useState(true)
  const [sessionTimeout, setSessionTimeout] = useState("15")

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security</h1>
        <p className="text-muted-foreground mt-1">Manage your account security settings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Key className="h-4 w-4" />Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2"><Label htmlFor="current">Current Password</Label><Input id="current" type="password" /></div>
          <div className="grid gap-2"><Label htmlFor="new">New Password</Label><Input id="new" type="password" /></div>
          <div className="grid gap-2"><Label htmlFor="confirm">Confirm New Password</Label><Input id="confirm" type="password" /></div>
          <Button>Update Password</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Smartphone className="h-4 w-4" />Multi-Factor Authentication</CardTitle>
          <CardDescription>Add an extra layer of security to your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">TOTP Authenticator</p>
              <p className="text-sm text-muted-foreground">Use an authenticator app like Google Authenticator or Authy</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={mfaEnabled ? "default" : "secondary"}>{mfaEnabled ? "Enabled" : "Disabled"}</Badge>
              <Switch checked={mfaEnabled} onCheckedChange={setMfaEnabled} />
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">WebAuthn / Security Keys</p>
              <p className="text-sm text-muted-foreground">Use a hardware security key (YubiKey, etc.)</p>
            </div>
            <Button variant="outline" size="sm"><Fingerprint className="mr-2 h-4 w-4" />Register Key</Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Backup Codes</p>
              <p className="text-sm text-muted-foreground">8 backup codes remaining</p>
            </div>
            <Button variant="outline" size="sm">Regenerate</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" />Session Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Session Timeout</p>
              <p className="text-sm text-muted-foreground">Automatically log out after inactivity</p>
            </div>
            <div className="flex items-center gap-2">
              <Input type="number" value={sessionTimeout} onChange={(e) => setSessionTimeout(e.target.value)} className="w-20 text-center" />
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Monitor className="h-4 w-4" />Trusted Devices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trustedDevices.map(device => (
            <div key={device.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="text-sm font-medium">{device.name}</p>
                <p className="text-xs text-muted-foreground">Last used: {device.lastUsed}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={device.trusted ? "default" : "outline"}>{device.trusted ? "Trusted" : "Untrusted"}</Badge>
                <Button variant="ghost" size="sm">Revoke</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" />Login History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loginHistory.map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm">{entry.time}</p>
                  <p className="text-xs text-muted-foreground">{entry.ip} — {entry.location} — {entry.device}</p>
                </div>
                <Badge variant={entry.status === "success" ? "default" : "destructive"}>{entry.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

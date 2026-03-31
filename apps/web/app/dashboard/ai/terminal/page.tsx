"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { Plus, X, Edit2, Check, Terminal, Power, PowerOff } from "lucide-react"
import { Terminal as XTerminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import { WebLinksAddon } from "@xterm/addon-web-links"
import { AttachAddon } from "@xterm/addon-attach"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useTerminalStore } from "@/stores/terminal-store"
import "@xterm/xterm/css/xterm.css"

function SessionTab({
  session,
  isActive,
  onSelect,
  onClose,
  isConnected,
}: {
  session: { id: string; name: string }
  isActive: boolean
  isConnected?: boolean
  onSelect: () => void
  onClose: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(session.name)

  const handleSave = () => {
    setIsEditing(false)
  }

  return (
    <div
      className={`group flex items-center gap-1 px-3 py-1.5 rounded-t-md cursor-pointer border border-b-0 text-sm transition-colors ${
        isActive
          ? "bg-background border-border"
          : "bg-muted/50 border-transparent hover:bg-muted"
      }`}
      onClick={onSelect}
    >
      <div className="relative">
        <Terminal className="h-3 w-3 text-muted-foreground" />
        {isConnected && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full" />
        )}
      </div>
      {isEditing ? (
        <div className="flex items-center gap-1">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="h-5 w-24 text-xs px-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave()
              if (e.key === "Escape") setIsEditing(false)
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={(e) => {
              e.stopPropagation()
              handleSave()
            }}
          >
            <Check className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <>
          <span className="truncate max-w-[100px]">{session.name}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              setIsEditing(true)
            }}
          >
            <Edit2 className="h-2.5 w-2.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 ml-1 hover:text-destructive opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
          >
            <X className="h-2.5 w-2.5" />
          </Button>
        </>
      )}
    </div>
  )
}

export default function AITerminalPage() {
  const { data: termConfig } = useQuery({ queryKey: ['terminal-config'], queryFn: () => apiClient.get('/v1/ai-ml/models'), enabled: false })
  const sessions = useTerminalStore((s) => s.sessions)
  const activeSessionId = useTerminalStore((s) => s.activeSessionId)
  const createSession = useTerminalStore((s) => s.createSession)
  const closeSession = useTerminalStore((s) => s.closeSession)
  const setActiveSession = useTerminalStore((s) => s.setActiveSession)
  const [mounted, setMounted] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const terminalRefs = useRef<Map<string, { terminal: XTerminal; fitAddon: FitAddon; ws?: WebSocket }>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)

  const connectTerminal = useCallback(async (sessionId: string) => {
    const existing = terminalRefs.current.get(sessionId)
    if (existing?.ws) {
      existing.ws.close()
    }

    setIsConnecting(true)
    setConnectionError(null)

    try {
      // Connect to real PTY WebSocket on gateway
      const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8080"
      const wsUrl = gatewayUrl.replace("http://", "ws://").replace("https://", "wss://") + "/ws/terminal"

      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        setIsConnected(true)
        setIsConnecting(false)
      }

      ws.onerror = () => {
        setConnectionError("WebSocket connection failed")
        setIsConnected(false)
        setIsConnecting(false)
      }

      ws.onclose = () => {
        setIsConnected(false)
        setIsConnecting(false)
      }

      // Initialize or reuse terminal
      let entry = terminalRefs.current.get(sessionId)
      if (!entry) {
        const terminal = new XTerminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          theme: {
            background: "#18181b",
            foreground: "#22c55e",
            cursor: "#22c55e",
            cursorAccent: "#18181b",
            selectionBackground: "#22c55e40",
            black: "#18181b",
            brightBlack: "#27272a",
            red: "#ef4444",
            brightRed: "#f87171",
            green: "#22c55e",
            brightGreen: "#4ade80",
            yellow: "#eab308",
            brightYellow: "#facc15",
            blue: "#3b82f6",
            brightBlue: "#60a5fa",
            magenta: "#a855f7",
            brightMagenta: "#c084fc",
            cyan: "#06b6d4",
            brightCyan: "#22d3ee",
            white: "#fafafa",
            brightWhite: "#ffffff",
          },
        })

        const fitAddon = new FitAddon()
        const webLinksAddon = new WebLinksAddon()

        terminal.loadAddon(fitAddon)
        terminal.loadAddon(webLinksAddon)

        entry = { terminal, fitAddon, ws }
        terminalRefs.current.set(sessionId, entry)

        // Write initial message
        terminal.writeln("\x1b[1;32mClaude CLI Terminal\x1b[0m")
        terminal.writeln("\x1b[2;32mAI-powered cloud infrastructure terminal\x1b[0m")
        terminal.writeln("")
        terminal.writeln("Type \x1b[36mhelp\x1b[0m for available commands or \x1b[36mclear\x1b[0m to clear the screen.")
        terminal.writeln("")

        // Attach WebSocket
        const attachAddon = new AttachAddon(ws)
        terminal.loadAddon(attachAddon)

        // Handle AI commands (natural language processing)
        terminal.onData((_data) => {
          // Natural language commands are processed server-side via WebSocket
          // This hook reserved for client-side command preprocessing if needed
        })
      } else {
        entry.ws = ws
      }
    } catch (err: any) {
      setConnectionError(err?.message ?? "Failed to connect")
      setIsConnecting(false)
    }
  }, [])

  const disconnectTerminal = useCallback((sessionId: string) => {
    const entry = terminalRefs.current.get(sessionId)
    if (entry?.ws) {
      entry.ws.close()
      entry.ws = undefined
    }
    setIsConnected(false)
  }, [])

  const initTerminal = useCallback((sessionId: string) => {
    const container = document.getElementById(`terminal-${sessionId}`)
    if (!container) return

    let entry = terminalRefs.current.get(sessionId)
    if (entry) {
      entry.terminal.open(container)
      entry.fitAddon.fit()
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    if (sessions.length === 0) {
      createSession("Session 1")
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize terminal when active session changes
  useEffect(() => {
    if (activeSessionId && mounted) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        initTerminal(activeSessionId)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [activeSessionId, mounted, initTerminal])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      terminalRefs.current.forEach(({ fitAddon }) => {
        fitAddon.fit()
      })
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      terminalRefs.current.forEach(({ terminal, ws }) => {
        terminal.dispose()
        ws?.close()
      })
      terminalRefs.current.clear()
    }
  }, [])

  if (!mounted) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Claude Terminal</h1>
          <p className="text-muted-foreground mt-1">AI-powered cloud CLI terminal.</p>
        </div>
        <Skeleton className="h-[500px] w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Claude Terminal</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered cloud CLI terminal. Manage infrastructure with natural language.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeSessionId && (
            <Button
              variant={isConnected ? "destructive" : "default"}
              size="sm"
              onClick={() => isConnected ? disconnectTerminal(activeSessionId) : connectTerminal(activeSessionId)}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <span className="animate-pulse mr-2">Connecting...</span>
                </>
              ) : isConnected ? (
                <>
                  <PowerOff className="h-4 w-4 mr-2" />
                  Disconnect
                </>
              ) : (
                <>
                  <Power className="h-4 w-4 mr-2" />
                  Connect
                </>
              )}
            </Button>
          )}
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b">
        {sessions.map((session) => (
          <SessionTab
            key={session.id}
            session={session}
            isActive={session.id === activeSessionId}
            isConnected={session.id === activeSessionId && isConnected}
            onSelect={() => setActiveSession(session.id)}
            onClose={() => {
              const entry = terminalRefs.current.get(session.id)
              entry?.ws?.close()
              entry?.terminal.dispose()
              terminalRefs.current.delete(session.id)
              closeSession(session.id)
            }}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 ml-1"
          onClick={() => createSession()}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {connectionError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {connectionError}
        </div>
      )}

      {/* Terminal container */}
      {activeSessionId ? (
        <div
          ref={containerRef}
          className="bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden"
          style={{ minHeight: 520 }}
        >
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <span className="text-xs text-zinc-400 ml-2">
              {sessions.find((s) => s.id === activeSessionId)?.name ?? "Terminal"}
            </span>
          </div>
          <div
            id={`terminal-${activeSessionId}`}
            className="p-2"
            style={{ height: 480 }}
          />
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Terminal className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No active session</p>
            <Button onClick={() => createSession()}>
              <Plus className="h-4 w-4 mr-2" />
              New Session
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick commands */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Quick Commands</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Button variant="outline" size="sm" className="justify-start text-xs">
            <span className="text-muted-foreground mr-2">$</span>
            list instances
          </Button>
          <Button variant="outline" size="sm" className="justify-start text-xs">
            <span className="text-muted-foreground mr-2">$</span>
            create bucket
          </Button>
          <Button variant="outline" size="sm" className="justify-start text-xs">
            <span className="text-muted-foreground mr-2">$</span>
            show costs
          </Button>
          <Button variant="outline" size="sm" className="justify-start text-xs">
            <span className="text-muted-foreground mr-2">$</span>
            help
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import { Terminal, Maximize2, Minimize2, X, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function TerminalPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<any>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fitAddonRef = useRef<any>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

  const connect = async () => {
    setError(null)

    // Dynamic import xterm (client-side only)
    const { Terminal: XTerm } = await import("@xterm/xterm")
    const { FitAddon } = await import("@xterm/addon-fit")
    const { WebLinksAddon } = await import("@xterm/addon-web-links")
    await import("@xterm/xterm/css/xterm.css")

    // Clean up previous
    if (terminalRef.current) {
      terminalRef.current.dispose()
    }
    if (wsRef.current) {
      wsRef.current.close()
    }

    // Create terminal
    const terminal = new XTerm({
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Menlo', monospace",
      theme: {
        background: "#0a0a0a",
        foreground: "#e4e4e7",
        cursor: "#22d3ee",
        cursorAccent: "#0a0a0a",
        selectionBackground: "#3b82f650",
        black: "#18181b",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#22d3ee",
        white: "#e4e4e7",
        brightBlack: "#52525b",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#facc15",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#67e8f9",
        brightWhite: "#fafafa",
      },
      allowProposedApi: true,
      scrollback: 10000,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)

    if (containerRef.current) {
      terminal.open(containerRef.current)
      fitAddon.fit()
    }

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Connect WebSocket to real PTY
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8080"
    const wsUrl = gatewayUrl.replace("http://", "ws://").replace("https://", "wss://") + "/ws/terminal"

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.binaryType = "arraybuffer"

    ws.onopen = () => {
      setConnected(true)
      setError(null)
      terminal.focus()

      // Send initial resize
      const dims = fitAddon.proposeDimensions()
      if (dims) {
        ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }))
      }
    }

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        terminal.write(new Uint8Array(event.data))
      } else {
        terminal.write(event.data)
      }
    }

    ws.onerror = () => {
      setError("Failed to connect to terminal server. Is the gateway running?")
      setConnected(false)
    }

    ws.onclose = () => {
      setConnected(false)
      terminal.write("\r\n\x1b[1;31m[Disconnected]\x1b[0m\r\n")
    }

    // Forward keystrokes to WebSocket
    terminal.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    // Handle terminal resize
    terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }))
      }
    })

    // Window resize handler
    const handleResize = () => fitAddon.fit()
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
      terminalRef.current?.dispose()
    }
  }, [])

  // Refit on fullscreen toggle
  useEffect(() => {
    setTimeout(() => fitAddonRef.current?.fit(), 100)
  }, [fullscreen])

  return (
    <div className={`${fullscreen ? "fixed inset-0 z-50 bg-background p-4" : "space-y-4"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Terminal className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Terminal</h1>
          <Badge variant={connected ? "default" : "destructive"}>
            {connected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={connect}>
            <RefreshCw className="h-4 w-4 mr-1" />Reconnect
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFullscreen(!fullscreen)}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500">
          {error}
        </div>
      )}

      <div
        ref={containerRef}
        className="rounded-lg border overflow-hidden"
        style={{
          height: fullscreen ? "calc(100vh - 100px)" : "calc(100vh - 220px)",
          minHeight: 400,
          backgroundColor: "#0a0a0a",
        }}
      />
    </div>
  )
}

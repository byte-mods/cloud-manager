"use client"

import { useState, useRef, useEffect } from "react"
import {
  Send,
  Trash2,
  Sparkles,
  User,
  Bot,
  Loader2,
  Tag,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { useClaudeChat, type ChatMessage } from "@/hooks/use-claude-chat"

const suggestionChips = [
  "Analyze my current cloud costs",
  "Show security vulnerabilities",
  "Generate a Terraform config for EC2",
  "Explain my network topology",
  "Optimize my database performance",
  "Compare AWS vs GCP pricing",
]

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-primary text-primary-foreground" : "bg-purple-500/10"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-purple-500" />}
      </div>
      <div
        className={`max-w-[75%] rounded-lg px-4 py-2.5 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p className={`text-[10px] mt-1 ${isUser ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {message.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-purple-500/10">
        <Bot className="h-4 w-4 text-purple-500" />
      </div>
      <div className="bg-muted rounded-lg px-4 py-3">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  )
}

export default function AIChatPage() {
  const { messages, sendMessage, isStreaming, error, clearHistory } = useClaudeChat()
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [currentContext] = useState("Dashboard")

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isStreaming])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput("")
    await sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChipClick = async (chip: string) => {
    if (isStreaming) return
    setInput("")
    await sendMessage(chip)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Chat</h1>
          <p className="text-muted-foreground mt-1">
            Chat with Claude about your cloud infrastructure.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Tag className="h-3 w-3" />
            Context: {currentContext}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={clearHistory}
            disabled={messages.length === 0}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
              <Sparkles className="h-12 w-12 text-purple-500 mb-4" />
              <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                Ask Claude anything about your cloud infrastructure, costs, security, or architecture.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {suggestionChips.map((chip) => (
                  <Button
                    key={chip}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleChipClick(chip)}
                  >
                    {chip}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isStreaming && messages[messages.length - 1]?.content === "" && (
                <TypingIndicator />
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
              {error}
            </div>
          )}
        </ScrollArea>

        {/* Suggestion chips when chat is active */}
        {messages.length > 0 && !isStreaming && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {suggestionChips.slice(0, 3).map((chip) => (
              <Button
                key={chip}
                variant="outline"
                size="sm"
                className="text-[11px] h-7"
                onClick={() => handleChipClick(chip)}
              >
                {chip}
              </Button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Claude about your infrastructure..."
              className="min-h-[44px] max-h-[120px] resize-none"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="h-11 w-11 flex-shrink-0"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

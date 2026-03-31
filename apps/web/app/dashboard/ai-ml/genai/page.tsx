"use client"

import { useState } from "react"
import { Sparkles, Send, Loader2, RotateCcw } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAIModels } from "@/hooks/use-ai-ml"

export default function GenAIPage() {
  const { data: modelsData } = useAIModels()
  const [selectedModel, setSelectedModel] = useState("claude-3.5-sonnet")
  const [prompt, setPrompt] = useState("")
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1024)
  const [response, setResponse] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  const models = (modelsData?.models ?? []).map(m => ({
    value: m.id,
    label: m.name,
    provider: m.provider,
  }))

  const displayModels = models

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setIsGenerating(true)
    setResponse("")

    const mockResponse = `Based on your prompt, here is the generated response using ${displayModels.find((m) => m.value === selectedModel)?.label}:\n\nThis is a simulated response from the LLM playground. In a production environment, this would connect to the selected model's API endpoint (AWS Bedrock, Azure OpenAI, or GCP Vertex AI) and stream the response in real-time.\n\nThe response would be generated with:\n- Temperature: ${temperature}\n- Max Tokens: ${maxTokens}\n- Model: ${selectedModel}`

    let current = ""
    for (const char of mockResponse) {
      current += char
      setResponse(current)
      await new Promise((r) => setTimeout(r, 15))
    }
    setIsGenerating(false)
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-pink-500" />
          <h1 className="text-3xl font-bold tracking-tight">Generative AI Playground</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Experiment with large language models across providers.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Parameters panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {displayModels.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex items-center gap-2">
                        <span>{m.label}</span>
                        <Badge variant="outline" className="text-[10px]">{m.provider}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Temperature: {temperature}</Label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1024)}
                min={1}
                max={4096}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setTemperature(0.7)
                setMaxTokens(1024)
              }}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset Defaults
            </Button>
          </CardContent>
        </Card>

        {/* Prompt and response */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Prompt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt here. For example: 'Generate a Terraform configuration for a highly available web application on AWS...'"
                rows={6}
                className="font-mono text-sm"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {prompt.length} characters
                </span>
                <Button onClick={handleGenerate} disabled={!prompt.trim() || isGenerating}>
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Generate
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Response</CardTitle>
                {response && (
                  <Badge variant="secondary" className="text-xs">
                    {displayModels.find((m) => m.value === selectedModel)?.label}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {response ? (
                <div className="bg-muted/30 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap min-h-[200px]">
                  {response}
                  {isGenerating && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />}
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                  Response will appear here after generation.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

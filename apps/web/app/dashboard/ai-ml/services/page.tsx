"use client"

import { useState } from "react"
import { Eye, MessageSquare, Mic, Languages, ArrowRight } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useAIProductServices } from "@/hooks/use-ai-ml"

type AIService = {
  title: string
  description: string
  icon: typeof Eye
  color: string
  bgColor: string
  providers: string[]
  tryItLabel: string
}

const services: AIService[] = [
  {
    title: "Computer Vision",
    description: "Object detection, image classification, OCR, and facial analysis across AWS Rekognition, GCP Vision AI, and Azure Computer Vision.",
    icon: Eye,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    providers: ["AWS Rekognition", "GCP Vision AI", "Azure Computer Vision"],
    tryItLabel: "Upload an image to analyze",
  },
  {
    title: "Natural Language",
    description: "Sentiment analysis, entity recognition, text classification, and summarization using AWS Comprehend, GCP Natural Language, and Azure Text Analytics.",
    icon: MessageSquare,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    providers: ["AWS Comprehend", "GCP NL API", "Azure Text Analytics"],
    tryItLabel: "Enter text to analyze",
  },
  {
    title: "Speech",
    description: "Speech-to-text, text-to-speech, and real-time transcription using AWS Transcribe/Polly, GCP Speech API, and Azure Speech Services.",
    icon: Mic,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    providers: ["AWS Transcribe", "GCP Speech API", "Azure Speech"],
    tryItLabel: "Upload audio or record",
  },
  {
    title: "Translation",
    description: "Neural machine translation supporting 75+ languages using AWS Translate, GCP Translation, and Azure Translator.",
    icon: Languages,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    providers: ["AWS Translate", "GCP Translation", "Azure Translator"],
    tryItLabel: "Enter text to translate",
  },
]

function ServiceCard({ service, serviceData }: { service: AIService; serviceData?: { callsToday: number; avgLatency: number; status: string } }) {
  const [inputValue, setInputValue] = useState("")

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className={`rounded-lg p-3 ${service.bgColor}`}>
            <service.icon className={`h-6 w-6 ${service.color}`} />
          </div>
          <div className="flex gap-1">
            {service.providers.map((p) => (
              <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
            ))}
          </div>
        </div>
        <CardTitle className="mt-3">{service.title}</CardTitle>
        <CardDescription>{service.description}</CardDescription>
        {serviceData && (
          <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
            <span>{serviceData.callsToday.toLocaleString()} calls today</span>
            <span>{serviceData.avgLatency}ms avg latency</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="border rounded-lg p-4 bg-muted/30">
          <p className="text-xs text-muted-foreground mb-2">{service.tryItLabel}</p>
          {service.title === "Computer Vision" || service.title === "Speech" ? (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground text-sm">
              <service.icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Drop a file here or click to upload</p>
              <Input type="file" className="mt-2 max-w-xs mx-auto" />
            </div>
          ) : (
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`Enter ${service.title === "Translation" ? "text to translate" : "text to analyze"}...`}
              rows={3}
            />
          )}
          <Button size="sm" className="mt-3">
            Analyze
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AIServicesPage() {
  const { data } = useAIProductServices()
  const apiServices = data?.services ?? []

  // Map API services to UI services
  const serviceTypeMap: Record<string, typeof apiServices[0] | undefined> = {
    "Computer Vision": apiServices.find(s => s.type === "vision"),
    "Natural Language": apiServices.find(s => s.type === "nlp"),
    "Speech": apiServices.find(s => s.type === "audio"),
    "Translation": apiServices.find(s => s.type === "nlp"), // reuse NLP
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Services</h1>
        <p className="text-muted-foreground mt-1">
          Pre-built AI capabilities across Vision, Language, Speech, and Translation.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {services.map((service) => (
          <ServiceCard key={service.title} service={service} serviceData={serviceTypeMap[service.title]} />
        ))}
      </div>
    </div>
  )
}

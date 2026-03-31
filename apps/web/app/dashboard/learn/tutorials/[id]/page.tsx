"use client"

import { use, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Circle,
  MessageSquare,
  Play,
  HelpCircle,
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
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { useTutorialProgress } from "@/hooks/use-tutorial-progress"

type QuizQuestion = {
  question: string
  options: string[]
  correctIndex: number
}

type TutorialStep = {
  id: string
  title: string
  content: string
  codeBlock?: { language: string; code: string }
  quiz?: QuizQuestion
}

const tutorialSteps: TutorialStep[] = []

export default function TutorialPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({})
  const [showQuizResult, setShowQuizResult] = useState<Record<string, boolean>>({})
  const [showAITutor, setShowAITutor] = useState(false)
  const { progress, completionPercentage, advanceStep, completeStep } = useTutorialProgress(id)

  const steps = tutorialSteps
  const step = steps[currentStep]
  const stepProgress = steps.length > 0
    ? Math.round(((currentStep + 1) / steps.length) * 100)
    : 0

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleQuizAnswer = (stepId: string, answerIndex: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [stepId]: answerIndex }))
    setShowQuizResult((prev) => ({ ...prev, [stepId]: true }))
  }

  if (steps.length === 0) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/learn">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Learning Center
          </Link>
        </Button>
        <div className="text-center py-12 text-muted-foreground">No data available</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/learn">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Learning Center
          </Link>
        </Button>
        <Badge variant="outline">Tutorial: {id}</Badge>
      </div>

      {/* Step progress bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </span>
          <span className="text-sm font-medium">{stepProgress}%</span>
        </div>
        <Progress value={stepProgress} className="h-2" />
        <div className="flex gap-1 mt-2">
          {steps.map((s, i) => (
            <button
              key={s.id}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                i <= currentStep ? "bg-primary" : "bg-muted"
              }`}
              onClick={() => setCurrentStep(i)}
            />
          ))}
        </div>
      </div>

      {/* Content area */}
      <Card>
        <CardHeader>
          <CardTitle>{step.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Rendered content */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {step.content.split("\n\n").map((paragraph, i) => {
              if (paragraph.startsWith("- ")) {
                const items = paragraph.split("\n").filter((line) => line.startsWith("- "))
                return (
                  <ul key={i} className="list-disc pl-6 space-y-1">
                    {items.map((item, j) => (
                      <li key={j} className="text-sm text-muted-foreground">{item.slice(2)}</li>
                    ))}
                  </ul>
                )
              }
              return (
                <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                  {paragraph}
                </p>
              )
            })}
          </div>

          {/* Code block */}
          {step.codeBlock && (
            <div className="rounded-lg overflow-hidden border">
              <div className="bg-zinc-900 px-4 py-2 flex items-center justify-between">
                <span className="text-xs text-zinc-400">{step.codeBlock.language}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-zinc-400 hover:text-zinc-200"
                  onClick={() => navigator.clipboard.writeText(step.codeBlock!.code)}
                >
                  Copy
                </Button>
              </div>
              <pre className="bg-zinc-950 p-4 overflow-x-auto">
                <code className="text-sm text-zinc-300 font-mono leading-relaxed">
                  {step.codeBlock.code}
                </code>
              </pre>
            </div>
          )}

          {/* Try it now button */}
          {step.codeBlock && (
            <Button variant="outline" asChild>
              <Link href="/dashboard/learn/sandbox">
                <Play className="h-4 w-4 mr-2" />
                Try it now in Sandbox
              </Link>
            </Button>
          )}

          {/* Quiz section */}
          {step.quiz && (
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  Knowledge Check
                </CardTitle>
                <CardDescription>{step.quiz.question}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {step.quiz.options.map((option, i) => {
                  const selected = selectedAnswers[step.id] === i
                  const showResult = showQuizResult[step.id]
                  const isCorrect = i === step.quiz!.correctIndex

                  let optionClass = "border-border hover:bg-muted/50"
                  if (showResult && selected && isCorrect) optionClass = "border-green-500 bg-green-500/10"
                  else if (showResult && selected && !isCorrect) optionClass = "border-red-500 bg-red-500/10"
                  else if (showResult && isCorrect) optionClass = "border-green-500/50"

                  return (
                    <button
                      key={i}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left text-sm transition-colors ${optionClass}`}
                      onClick={() => handleQuizAnswer(step.id, i)}
                      disabled={showResult}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        selected ? "border-primary bg-primary" : "border-muted-foreground"
                      }`}>
                        {selected && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                      {option}
                    </button>
                  )
                })}
                {showQuizResult[step.id] && (
                  <p className={`text-sm mt-2 ${
                    selectedAnswers[step.id] === step.quiz.correctIndex ? "text-green-500" : "text-red-500"
                  }`}>
                    {selectedAnswers[step.id] === step.quiz.correctIndex
                      ? "Correct! Well done."
                      : `Incorrect. The correct answer is: ${step.quiz.options[step.quiz.correctIndex]}`}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          {currentStep + 1} / {steps.length}
        </span>
        <Button
          onClick={handleNext}
          disabled={currentStep === steps.length - 1}
        >
          Next
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {/* AI Tutor floating button */}
      <div className="fixed bottom-6 right-6">
        <Button
          size="lg"
          className="rounded-full h-14 w-14 shadow-lg"
          onClick={() => setShowAITutor(!showAITutor)}
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
        {showAITutor && (
          <Card className="absolute bottom-16 right-0 w-80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">AI Tutor</CardTitle>
              <CardDescription className="text-xs">Ask questions about this tutorial</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Need help understanding this step? Ask me anything about the concepts covered here.
              </p>
              <Button size="sm" className="mt-3 w-full" asChild>
                <Link href="/dashboard/ai/chat">Open AI Chat</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

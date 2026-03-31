import * as React from "react"

interface CodeBlockProps {
  code: string
  language?: string
  showLineNumbers?: boolean
  maxHeight?: string
}

export function CodeBlock({ code, language, showLineNumbers = false, maxHeight = "400px" }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lines = code.split("\n")

  return (
    <div className="relative group rounded-lg border bg-muted/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
        {language && <span className="text-xs text-muted-foreground font-mono">{language}</span>}
        <button onClick={handleCopy} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-auto p-3 text-xs font-mono leading-relaxed" style={{ maxHeight }}>
        <code>
          {showLineNumbers
            ? lines.map((line, i) => (
                <div key={i} className="flex">
                  <span className="select-none text-muted-foreground w-8 text-right mr-3 shrink-0">{i + 1}</span>
                  <span>{line}</span>
                </div>
              ))
            : code}
        </code>
      </pre>
    </div>
  )
}

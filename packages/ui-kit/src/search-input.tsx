import * as React from "react"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
  className?: string
}

export function SearchInput({ value, onChange, placeholder = "Search...", debounceMs = 300, className }: SearchInputProps) {
  const [local, setLocal] = React.useState(value)
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>()

  React.useEffect(() => { setLocal(value) }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setLocal(v)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChange(v), debounceMs)
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="text"
        value={local}
        onChange={handleChange}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border bg-transparent pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  )
}

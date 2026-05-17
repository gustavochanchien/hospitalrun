import { useEffect, useReducer, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ensureCodeSystemLoaded } from '@/lib/code-systems/loader'
import { searchCodes } from '@/lib/code-systems/search'
import type { CodeSystem } from '@/lib/db/schema'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

interface CodeSearchComboboxProps {
  system: 'icd10' | 'snomed' | 'vaccine'
  value: string | null
  displayValue?: string
  onChange: (code: string | null, display: string) => void
  disabled?: boolean
  placeholder?: string
  noResultsLabel?: string
  useAsIsLabel?: string
  id?: string
}

export function CodeSearchCombobox({
  system,
  value,
  displayValue,
  onChange,
  disabled = false,
  placeholder = 'Search codes…',
  noResultsLabel = 'No codes found',
  useAsIsLabel,
  id,
}: CodeSearchComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CodeSystem[]>([])
  const [loadState, setLoadState] = useReducer(
    (_: LoadState, next: LoadState) => next,
    'idle' as LoadState,
  )
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load code system data on first open
  useEffect(() => {
    if (!open || loadState === 'ready') return
    let cancelled = false
    setLoadState('loading')
    ensureCodeSystemLoaded(system)
      .then(() => { if (!cancelled) setLoadState('ready') })
      .catch(() => { if (!cancelled) setLoadState('error') })
    return () => { cancelled = true }
  }, [open, system]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search — runs after code system is ready
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim() || loadState !== 'ready') {
      debounceRef.current = setTimeout(() => setResults([]), 0)
      return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    }
    debounceRef.current = setTimeout(() => {
      searchCodes(system, query).then(setResults)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, system, loadState])

  function handleSelect(code: string, display: string) {
    onChange(code, display)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const showUseAsIs = query.trim() && !results.some((r) => r.code === query.trim())
  const useAsIs = useAsIsLabel ?? `Use "${query.trim()}" as-is`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="w-full justify-start font-normal"
          disabled={disabled}
        >
          {value ? (
            <span>
              <span className="font-medium">{value}</span>
              {displayValue && displayValue !== value && (
                <span className="ml-2 text-muted-foreground">{displayValue}</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <div className="p-2">
          <Input
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {loadState === 'loading' && (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading code list…
          </div>
        )}

        {loadState === 'error' && (
          <p className="px-3 py-3 text-sm text-destructive">Failed to load code list.</p>
        )}

        {loadState === 'ready' && (
          <div className="max-h-64 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                className="flex w-full items-baseline gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                onClick={() => handleSelect(r.code, r.display)}
              >
                <span className="font-mono font-semibold shrink-0">{r.code}</span>
                <span className="text-muted-foreground truncate">{r.display}</span>
              </button>
            ))}

            {showUseAsIs && (
              <button
                type="button"
                className="flex w-full items-center px-3 py-2 text-sm italic hover:bg-accent text-muted-foreground border-t"
                onClick={() => handleSelect(query.trim(), query.trim())}
              >
                {useAsIs}
              </button>
            )}

            {!query.trim() && (
              <p className="px-3 py-4 text-sm text-center text-muted-foreground">
                {placeholder}
              </p>
            )}

            {query.trim() && results.length === 0 && !showUseAsIs && (
              <p className="px-3 py-4 text-sm text-center text-muted-foreground">
                {noResultsLabel}
              </p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

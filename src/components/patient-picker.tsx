import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { db } from '@/lib/db'
import type { Patient } from '@/lib/db/schema'

interface PatientPickerProps {
  value: string | null | undefined
  onChange: (patient: Patient | null) => void
  excludePatientId?: string
  placeholder: string
  searchPlaceholder: string
  noResultsLabel: string
  clearable?: boolean
  clearLabel?: string
  id?: string
}

export function PatientPicker({
  value,
  onChange,
  excludePatientId,
  placeholder,
  searchPlaceholder,
  noResultsLabel,
  clearable = false,
  clearLabel,
  id,
}: PatientPickerProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const allPatients = useLiveQuery(
    () => db.patients.filter((p) => !p._deleted).toArray(),
    [],
  )

  const selected = useLiveQuery(
    async () => (value ? await db.patients.get(value) : undefined),
    [value],
  )
  const displayName = selected
    ? `${selected.givenName} ${selected.familyName}`
    : ''

  const filtered = useMemo(() => {
    if (!allPatients) return []
    const candidates = excludePatientId
      ? allPatients.filter((p) => p.id !== excludePatientId)
      : allPatients
    if (!search) return candidates.slice(0, 10)
    const lower = search.toLowerCase()
    return candidates
      .filter((p) =>
        `${p.givenName} ${p.familyName}`.toLowerCase().includes(lower),
      )
      .slice(0, 10)
  }, [allPatients, search, excludePatientId])

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className="w-full justify-start font-normal"
            onClick={() => setOpen(true)}
          >
            {displayName || placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-2">
            <Input
              ref={inputRef}
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                {noResultsLabel}
              </p>
            ) : (
              filtered.map((p) => {
                const name = `${p.givenName} ${p.familyName}`
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                    onClick={() => {
                      onChange(p)
                      setSearch('')
                      setOpen(false)
                    }}
                  >
                    <span className="font-medium">{name}</span>
                    {p.mrn && (
                      <span className="text-muted-foreground">
                        MRN: {p.mrn}
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
      {clearable && value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={clearLabel ?? 'Clear'}
          onClick={() => onChange(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

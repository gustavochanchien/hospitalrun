import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { db } from '@/lib/db'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PatientHistoryProps {
  patientId: string
  defaultField?: string
}

const PAGE_SIZE = 25

export function PatientHistory({
  patientId,
  defaultField,
}: PatientHistoryProps) {
  const history = useLiveQuery(
    () =>
      db.patientHistory
        .where('patientId')
        .equals(patientId)
        .reverse()
        .sortBy('changedAt'),
    [patientId],
  )

  const [fieldFilter, setFieldFilter] = useState<string>(defaultField ?? 'all')
  const [actorFilter, setActorFilter] = useState<string>('')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [page, setPage] = useState(0)

  const fieldOptions = useMemo(() => {
    if (!history) return [] as string[]
    const set = new Set<string>()
    for (const h of history) set.add(h.fieldName)
    return Array.from(set).sort()
  }, [history])

  if (history === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading...</p>
  }

  const actorLower = actorFilter.trim().toLowerCase()
  const filtered = history.filter((entry) => {
    if (fieldFilter !== 'all' && entry.fieldName !== fieldFilter) return false
    if (actorLower) {
      if (!(entry.changedBy ?? '').toLowerCase().includes(actorLower)) {
        return false
      }
    }
    if (fromDate && entry.changedAt < `${fromDate}T00:00:00.000Z`) return false
    if (toDate && entry.changedAt > `${toDate}T23:59:59.999Z`) return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function resetFilters() {
    setFieldFilter('all')
    setActorFilter('')
    setFromDate('')
    setToDate('')
    setPage(0)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">History</h3>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px] space-y-1">
          <Label htmlFor="history-field">Field</Label>
          <Select
            value={fieldFilter}
            onValueChange={(v) => {
              setFieldFilter(v)
              setPage(0)
            }}
          >
            <SelectTrigger id="history-field">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All fields</SelectItem>
              {fieldOptions.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px] space-y-1">
          <Label htmlFor="history-actor">Actor</Label>
          <Input
            id="history-actor"
            placeholder="Filter by user ID"
            value={actorFilter}
            onChange={(e) => {
              setActorFilter(e.target.value)
              setPage(0)
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="history-from">From</Label>
          <Input
            id="history-from"
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value)
              setPage(0)
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="history-to">To</Label>
          <Input
            id="history-to"
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value)
              setPage(0)
            }}
          />
        </div>
        <Button variant="outline" size="sm" onClick={resetFilters}>
          Reset
        </Button>
        <p className="ml-auto text-sm text-muted-foreground">
          {filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No history entries match these filters.
        </p>
      ) : (
        <>
          <div className="relative space-y-0">
            {paginated.map((entry) => (
              <div
                key={entry.id}
                className="relative flex gap-4 border-l-2 border-muted pb-6 pl-6 last:pb-0"
              >
                <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-muted-foreground" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">
                    <button
                      type="button"
                      onClick={() => {
                        setFieldFilter(entry.fieldName)
                        setPage(0)
                      }}
                      className="font-semibold text-primary hover:underline"
                    >
                      {entry.fieldName}
                    </button>{' '}
                    changed
                  </p>
                  <div className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                    <span>
                      From:{' '}
                      <span className="font-mono">
                        {entry.oldValue ?? '\u2014'}
                      </span>
                    </span>
                    <span>
                      To:{' '}
                      <span className="font-mono">
                        {entry.newValue ?? '\u2014'}
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                    <span>
                      {format(parseISO(entry.changedAt), 'MMM d, yyyy h:mm a')}
                    </span>
                    {entry.changedBy && <span>by {entry.changedBy}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

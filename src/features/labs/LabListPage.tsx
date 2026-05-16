import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { db } from '@/lib/db'
import type { Patient } from '@/lib/db/schema'
import { ExportButton } from '@/components/export-button'

const PAGE_SIZE = 20

export function LabListPage() {
  const { t } = useTranslation('labs')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(0)

  const labs = useLiveQuery(
    () => db.labs.filter((l) => !l._deleted).toArray(),
    [],
  )

  const patients = useLiveQuery(
    () => db.patients.filter((p) => !p._deleted).toArray(),
    [],
  )

  const patientMap = useMemo(() => {
    if (!patients) return new Map<string, Patient>()
    const map = new Map<string, Patient>()
    for (const p of patients) {
      map.set(p.id, p)
    }
    return map
  }, [patients])

  if (labs === undefined || patients === undefined) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  const searchLower = search.toLowerCase()
  const filtered = labs.filter((lab) => {
    if (statusFilter !== 'all' && lab.status !== statusFilter) return false
    if (search) {
      const patient = patientMap.get(lab.patientId)
      if (!patient) return false
      const fullName = `${patient.givenName} ${patient.familyName}`.toLowerCase()
      if (!fullName.includes(searchLower)) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-4 p-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('list.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v)
            setPage(0)
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('list.allStatuses')}</SelectItem>
            <SelectItem value="requested">{t('status.requested')}</SelectItem>
            <SelectItem value="completed">{t('status.completed')}</SelectItem>
            <SelectItem value="canceled">{t('status.canceled')}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {t('list.count', { count: filtered.length })}
        </p>
        <ExportButton
          filename={t('exportColumns.filename')}
          rows={filtered}
          columns={[
            {
              header: t('exportColumns.patient'),
              accessor: (l) => {
                const p = patientMap.get(l.patientId)
                return p ? `${p.givenName} ${p.familyName}` : ''
              },
            },
            { header: t('exportColumns.type'), accessor: (l) => l.type },
            { header: t('exportColumns.code'), accessor: (l) => l.code ?? '' },
            { header: t('exportColumns.status'), accessor: (l) => l.status },
            {
              header: t('exportColumns.requestedAt'),
              accessor: (l) =>
                l.requestedAt
                  ? format(parseISO(l.requestedAt), 'yyyy-MM-dd HH:mm')
                  : '',
            },
            { header: t('exportColumns.result'), accessor: (l) => l.result ?? '' },
          ]}
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">
            {search || statusFilter !== 'all'
              ? t('list.noMatches')
              : t('list.noLabs')}
          </p>
          {!search && statusFilter === 'all' && (
            <Button asChild className="mt-4">
              <Link to="/labs/new">{t('requestFirst')}</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('list.columns.patient')}</TableHead>
                  <TableHead>{t('list.columns.type')}</TableHead>
                  <TableHead>{t('list.columns.code')}</TableHead>
                  <TableHead>{t('list.columns.status')}</TableHead>
                  <TableHead>{t('list.columns.requestedAt')}</TableHead>
                  <TableHead>{t('list.columns.result')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((lab) => {
                  const patient = patientMap.get(lab.patientId)
                  const patientName = patient
                    ? `${patient.givenName} ${patient.familyName}`
                    : 'Unknown Patient'

                  return (
                    <TableRow key={lab.id}>
                      <TableCell>
                        <Link
                          to="/patients/$patientId"
                          params={{ patientId: lab.patientId }}
                          className="font-medium text-primary hover:underline"
                        >
                          {patientName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          to="/labs/$labId"
                          params={{ labId: lab.id }}
                          className="text-primary hover:underline"
                        >
                          {lab.type}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {lab.code ?? '—'}
                      </TableCell>
                      <TableCell>
                        <LabStatusBadge status={lab.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(parseISO(lab.requestedAt), 'MMM d, yyyy h:mm a')}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {lab.result
                          ? lab.result.length > 50
                            ? `${lab.result.slice(0, 50)}...`
                            : lab.result
                          : '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t('list.pageOf', { current: page + 1, total: totalPages })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t('list.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('list.next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function LabStatusBadge({ status }: { status: string }) {
  const variant =
    status === 'requested'
      ? 'default'
      : status === 'completed'
        ? 'secondary'
        : 'destructive'
  return <Badge variant={variant}>{status}</Badge>
}

import { useState } from 'react'
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
import { ExportButton } from '@/components/export-button'

const PAGE_SIZE = 20

export function IncidentListPage() {
  const { t } = useTranslation('incidents')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(0)

  const incidents = useLiveQuery(
    () => db.incidents.filter((i) => !i._deleted).toArray(),
    [],
  )

  if (incidents === undefined) {
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
  const filtered = incidents.filter((incident) => {
    if (statusFilter !== 'all' && incident.status !== statusFilter) return false
    if (search) {
      const reporter = (incident.reportedBy ?? '').toLowerCase()
      const desc = incident.description.toLowerCase()
      if (!reporter.includes(searchLower) && !desc.includes(searchLower)) {
        return false
      }
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

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
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('list.allStatuses')}</SelectItem>
            <SelectItem value="reported">{t('status.reported')}</SelectItem>
            <SelectItem value="resolved">{t('status.resolved')}</SelectItem>
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
              header: t('exportColumns.date'),
              accessor: (inc) =>
                inc.reportedOn
                  ? format(parseISO(inc.reportedOn), 'yyyy-MM-dd')
                  : '',
            },
            { header: t('exportColumns.reporter'), accessor: (inc) => inc.reportedBy ?? '' },
            { header: t('exportColumns.department'), accessor: (inc) => inc.department ?? '' },
            { header: t('exportColumns.category'), accessor: (inc) => inc.category ?? '' },
            { header: t('exportColumns.status'), accessor: (inc) => inc.status },
          ]}
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">
            {search || statusFilter !== 'all'
              ? t('list.noMatches')
              : t('list.noIncidents')}
          </p>
          {!search && statusFilter === 'all' && (
            <Button asChild className="mt-4">
              <Link to="/incidents/new">{t('reportFirst')}</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('list.columns.date')}</TableHead>
                  <TableHead>{t('list.columns.reporter')}</TableHead>
                  <TableHead>{t('list.columns.department')}</TableHead>
                  <TableHead>{t('list.columns.category')}</TableHead>
                  <TableHead>{t('list.columns.description')}</TableHead>
                  <TableHead>{t('list.columns.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((incident) => (
                  <TableRow key={incident.id}>
                    <TableCell className="text-muted-foreground">
                      <Link
                        to="/incidents/$incidentId"
                        params={{ incidentId: incident.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        {format(parseISO(incident.reportedOn), 'MMM d, yyyy')}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {incident.reportedBy ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {incident.department ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {incident.category ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {truncate(incident.description, 60)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={incident.status} />
                    </TableCell>
                  </TableRow>
                ))}
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

function StatusBadge({ status }: { status: 'reported' | 'resolved' }) {
  const variant = status === 'reported' ? 'default' : 'secondary'
  return <Badge variant={variant}>{status}</Badge>
}

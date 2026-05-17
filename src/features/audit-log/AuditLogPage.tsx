import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { Input } from '@/components/ui/input'
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ExportButton } from '@/components/export-button'
import { PermissionGuard } from '@/components/ui/permission-guard'
import {
  ACCESS_ACTIONS,
  ACCESS_RESOURCE_TYPES,
  type AccessAction,
  type AccessLog,
  type AccessResourceType,
} from '@/lib/db/schema'
import {
  DEFAULT_FILTERS,
  PAGE_SIZE,
  useAccessLogs,
  type AccessLogFilters,
} from './use-access-logs'

export function AuditLogPage() {
  const { t } = useTranslation('audit-log')
  return (
    <PermissionGuard
      permission="read:audit_log"
      fallback={
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <p className="text-lg font-medium">{t('unauthorized.title')}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('unauthorized.description')}
          </p>
        </div>
      }
    >
      <AuditLogPageInner />
    </PermissionGuard>
  )
}

function AuditLogPageInner() {
  const { t } = useTranslation('audit-log')
  const [filters, setFilters] = useState<AccessLogFilters>(DEFAULT_FILTERS)
  const [page, setPage] = useState(0)
  const { rows, total, isLoading, error } = useAccessLogs(filters, page)

  const totalPages = useMemo(
    () => (total === null ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE))),
    [total],
  )

  function patch(p: Partial<AccessLogFilters>) {
    setFilters((prev) => ({ ...prev, ...p }))
    setPage(0)
  }

  return (
    <div className="space-y-4 p-6">
      <p className="text-sm text-muted-foreground">{t('description')}</p>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={t('filters.search')}
          value={filters.search}
          onChange={(e) => patch({ search: e.target.value })}
          className="max-w-sm"
        />
        <Select
          value={filters.action ?? 'all'}
          onValueChange={(v) =>
            patch({ action: v === 'all' ? null : (v as AccessAction) })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t('filters.action')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allActions')}</SelectItem>
            {ACCESS_ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {t(`actions.${a}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.resourceType ?? 'all'}
          onValueChange={(v) =>
            patch({
              resourceType: v === 'all' ? null : (v as AccessResourceType),
            })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('filters.resourceType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allResources')}</SelectItem>
            {ACCESS_RESOURCE_TYPES.map((r) => (
              <SelectItem key={r} value={r}>
                {t(`resources.${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground">{t('filters.from')}</label>
          <Input
            type="date"
            value={filters.from ? filters.from.slice(0, 10) : ''}
            onChange={(e) =>
              patch({
                from: e.target.value
                  ? new Date(`${e.target.value}T00:00:00.000Z`).toISOString()
                  : null,
              })
            }
            className="w-[150px]"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground">{t('filters.to')}</label>
          <Input
            type="date"
            value={filters.to ? filters.to.slice(0, 10) : ''}
            onChange={(e) =>
              patch({
                to: e.target.value
                  ? new Date(`${e.target.value}T23:59:59.999Z`).toISOString()
                  : null,
              })
            }
            className="w-[150px]"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setFilters(DEFAULT_FILTERS)
            setPage(0)
          }}
        >
          {t('filters.clear')}
        </Button>
        <PermissionGuard permission="export:audit_log">
          <ExportButton
            filename={t('list.exportFilename')}
            rows={rows}
            columns={[
              {
                header: t('columns.occurredAt'),
                accessor: (r) =>
                  format(parseISO(r.occurredAt), 'yyyy-MM-dd HH:mm:ss'),
              },
              { header: t('columns.user'), accessor: (r) => r.userEmail ?? r.userId ?? '' },
              { header: 'Role', accessor: (r) => r.userRole },
              { header: t('columns.action'), accessor: (r) => r.action },
              { header: t('columns.resource'), accessor: (r) => r.resourceType },
              { header: 'Resource ID', accessor: (r) => r.resourceId ?? '' },
              { header: t('columns.patient'), accessor: (r) => r.patientId ?? '' },
              {
                header: t('columns.context'),
                accessor: (r) => (r.context ? JSON.stringify(r.context) : ''),
              },
            ]}
          />
        </PermissionGuard>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {t('errors.loadFailed', { message: error })}
        </div>
      )}

      {isLoading && rows.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">{t('list.empty')}</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.occurredAt')}</TableHead>
                  <TableHead>{t('columns.user')}</TableHead>
                  <TableHead>{t('columns.action')}</TableHead>
                  <TableHead>{t('columns.resource')}</TableHead>
                  <TableHead>{t('columns.patient')}</TableHead>
                  <TableHead>{t('columns.context')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <AccessLogRow key={row.id} row={row} />
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {total !== null &&
                  t('list.pageOf', { count: rows.length, total })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t('list.previous', { defaultValue: 'Previous' })}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('list.next', { defaultValue: 'Next' })}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function AccessLogRow({ row }: { row: AccessLog }) {
  const { t } = useTranslation('audit-log')
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {format(parseISO(row.occurredAt), 'MMM d, yyyy HH:mm:ss')}
      </TableCell>
      <TableCell>
        <div className="text-sm">{row.userEmail ?? '—'}</div>
        <div className="text-xs text-muted-foreground">{row.userRole}</div>
      </TableCell>
      <TableCell>
        <Badge variant={badgeVariant(row.action)}>
          {t(`actions.${row.action}`)}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">
        {t(`resources.${row.resourceType}`)}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {row.patientId ? row.patientId.slice(0, 8) : '—'}
      </TableCell>
      <TableCell className="max-w-md truncate font-mono text-xs text-muted-foreground">
        {row.context ? JSON.stringify(row.context) : ''}
      </TableCell>
    </TableRow>
  )
}

function badgeVariant(action: AccessAction): 'default' | 'secondary' | 'destructive' {
  if (action === 'delete') return 'destructive'
  if (action === 'create' || action === 'update') return 'default'
  return 'secondary'
}

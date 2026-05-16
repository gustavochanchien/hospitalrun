import { useMemo, useState } from 'react'
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
import type { Invoice, Patient } from '@/lib/db/schema'
import { ExportButton } from '@/components/export-button'
import { formatMoney } from './invoice-totals'

const PAGE_SIZE = 20

const STATUSES: Array<Invoice['status']> = [
  'draft',
  'issued',
  'partial',
  'paid',
  'void',
]

export function InvoiceListPage() {
  const { t } = useTranslation('billing')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(0)

  const invoices = useLiveQuery(
    () => db.invoices.filter((i) => !i._deleted).toArray(),
    [],
  )

  const patients = useLiveQuery(
    () => db.patients.filter((p) => !p._deleted).toArray(),
    [],
  )

  const patientMap = useMemo(() => {
    if (!patients) return new Map<string, Patient>()
    const map = new Map<string, Patient>()
    for (const p of patients) map.set(p.id, p)
    return map
  }, [patients])

  if (invoices === undefined || patients === undefined) {
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
  const filtered = invoices.filter((invoice) => {
    if (statusFilter !== 'all' && invoice.status !== statusFilter) return false
    if (search) {
      const patient = patientMap.get(invoice.patientId)
      const fullName = patient
        ? `${patient.givenName} ${patient.familyName}`.toLowerCase()
        : ''
      if (
        !invoice.invoiceNumber.toLowerCase().includes(searchLower) &&
        !fullName.includes(searchLower)
      ) {
        return false
      }
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
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
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('list.allStatuses')}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`status.${s}` as 'status.draft')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {t('list.count', { count: filtered.length })}
        </p>
        <ExportButton
          filename={t('list.exportFilename')}
          rows={sorted}
          columns={[
            {
              header: t('list.columns.invoiceNumber'),
              accessor: (i) => i.invoiceNumber,
            },
            {
              header: t('list.columns.patient'),
              accessor: (i) => {
                const p = patientMap.get(i.patientId)
                return p ? `${p.givenName} ${p.familyName}` : ''
              },
            },
            { header: t('list.columns.status'), accessor: (i) => i.status },
            {
              header: t('list.columns.total'),
              accessor: (i) => i.total.toFixed(2),
            },
            {
              header: t('list.columns.balance'),
              accessor: (i) => (i.total - i.amountPaid).toFixed(2),
            },
            {
              header: t('list.columns.createdAt'),
              accessor: (i) =>
                i.createdAt
                  ? format(parseISO(i.createdAt), 'yyyy-MM-dd HH:mm')
                  : '',
            },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">
            {search || statusFilter !== 'all'
              ? t('list.noMatches')
              : t('list.empty')}
          </p>
          {!search && statusFilter === 'all' && (
            <Button asChild className="mt-4">
              <Link to="/billing/new">{t('list.newInvoice')}</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('list.columns.invoiceNumber')}</TableHead>
                  <TableHead>{t('list.columns.patient')}</TableHead>
                  <TableHead>{t('list.columns.status')}</TableHead>
                  <TableHead className="text-right">{t('list.columns.total')}</TableHead>
                  <TableHead className="text-right">{t('list.columns.balance')}</TableHead>
                  <TableHead>{t('list.columns.createdAt')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((invoice) => {
                  const patient = patientMap.get(invoice.patientId)
                  const patientName = patient
                    ? `${patient.givenName} ${patient.familyName}`
                    : t('list.unknownPatient')
                  const balance = invoice.total - invoice.amountPaid

                  return (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Link
                          to="/billing/$invoiceId"
                          params={{ invoiceId: invoice.id }}
                          className="font-medium text-primary hover:underline"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          to="/patients/$patientId"
                          params={{ patientId: invoice.patientId }}
                          className="text-primary hover:underline"
                        >
                          {patientName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={invoice.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(invoice.total, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(balance, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(parseISO(invoice.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

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

function InvoiceStatusBadge({ status }: { status: Invoice['status'] }) {
  const { t } = useTranslation('billing')
  const variant: 'default' | 'secondary' | 'destructive' | 'outline' =
    status === 'paid'
      ? 'secondary'
      : status === 'void'
        ? 'destructive'
        : status === 'partial'
          ? 'default'
          : status === 'issued'
            ? 'default'
            : 'outline'
  return <Badge variant={variant}>{t(`status.${status}` as 'status.draft')}</Badge>
}

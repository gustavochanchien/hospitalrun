import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
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
import type { InventoryItem } from '@/lib/db/schema'
import { ExportButton } from '@/components/export-button'
import { formatMoney } from '@/features/billing/invoice-totals'

const PAGE_SIZE = 20

type Filter = 'all' | 'active' | 'low'

export function InventoryListPage() {
  const { t } = useTranslation('inventory')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('active')
  const [page, setPage] = useState(0)

  const items = useLiveQuery(
    () => db.inventoryItems.filter((i) => !i._deleted).toArray(),
    [],
  )

  if (items === undefined) {
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
  const filtered = items.filter((item) => {
    if (filter === 'active' && !item.active) return false
    if (filter === 'low' && item.onHand > item.reorderLevel) return false
    if (search) {
      const hay = `${item.sku} ${item.name}`.toLowerCase()
      if (!hay.includes(searchLower)) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name))
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
          value={filter}
          onValueChange={(v) => {
            setFilter(v as Filter)
            setPage(0)
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('list.allStatuses')}</SelectItem>
            <SelectItem value="active">{t('list.activeOnly')}</SelectItem>
            <SelectItem value="low">{t('list.lowStockOnly')}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {t('list.count', { count: filtered.length })}
        </p>
        <ExportButton
          filename={t('list.exportFilename')}
          rows={sorted}
          columns={[
            { header: t('list.columns.sku'), accessor: (i) => i.sku },
            { header: t('list.columns.name'), accessor: (i) => i.name },
            { header: t('list.columns.unit'), accessor: (i) => i.unit },
            {
              header: t('list.columns.onHand'),
              accessor: (i) => i.onHand.toFixed(2),
            },
            {
              header: t('list.columns.reorderLevel'),
              accessor: (i) => i.reorderLevel.toFixed(2),
            },
            {
              header: t('list.columns.unitCost'),
              accessor: (i) => i.unitCost.toFixed(2),
            },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">
            {search || filter !== 'all' ? t('list.noMatches') : t('list.empty')}
          </p>
          {!search && filter === 'all' && (
            <Button asChild className="mt-4">
              <Link to="/inventory/new">{t('list.newItem')}</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('list.columns.sku')}</TableHead>
                  <TableHead>{t('list.columns.name')}</TableHead>
                  <TableHead>{t('list.columns.unit')}</TableHead>
                  <TableHead className="text-right">{t('list.columns.onHand')}</TableHead>
                  <TableHead className="text-right">
                    {t('list.columns.reorderLevel')}
                  </TableHead>
                  <TableHead className="text-right">{t('list.columns.unitCost')}</TableHead>
                  <TableHead>{t('list.columns.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((item) => (
                  <InventoryRow key={item.id} item={item} />
                ))}
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

function InventoryRow({ item }: { item: InventoryItem }) {
  const { t } = useTranslation('inventory')
  const isLow = item.onHand <= item.reorderLevel
  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{item.sku}</TableCell>
      <TableCell>
        <Link
          to="/inventory/$itemId"
          params={{ itemId: item.id }}
          className="font-medium text-primary hover:underline"
        >
          {item.name}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground">{item.unit}</TableCell>
      <TableCell className="text-right tabular-nums">
        {item.onHand.toFixed(2)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {item.reorderLevel.toFixed(2)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMoney(item.unitCost, item.currency)}
      </TableCell>
      <TableCell>
        {!item.active ? (
          <Badge variant="outline">{t('list.status.inactive')}</Badge>
        ) : isLow ? (
          <Badge variant="destructive">{t('list.status.low')}</Badge>
        ) : (
          <Badge variant="secondary">{t('list.status.active')}</Badge>
        )}
      </TableCell>
    </TableRow>
  )
}

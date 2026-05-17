import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PermissionGuard } from '@/components/ui/permission-guard'
import { db } from '@/lib/db'
import { dbDelete, dbPut } from '@/lib/db/write'
import { formatMoney } from '@/features/billing/invoice-totals'
import { InventoryItemForm } from './InventoryItemForm'
import type { InventoryItemFormValues } from './inventory.schema'
import { StockMovementDialog } from './StockMovementDialog'
import type { InventoryTransactionKind } from '@/lib/db/schema'

interface InventoryItemDetailProps {
  itemId: string
}

type DialogMode = Extract<
  InventoryTransactionKind,
  'receive' | 'adjust' | 'waste' | 'transfer'
> | null

export function InventoryItemDetail({ itemId }: InventoryItemDetailProps) {
  const { t } = useTranslation('inventory')
  const navigate = useNavigate()

  const item = useLiveQuery(() => db.inventoryItems.get(itemId), [itemId])
  const transactions = useLiveQuery(
    () =>
      db.inventoryTransactions
        .where('inventoryItemId')
        .equals(itemId)
        .filter((tx) => !tx._deleted)
        .toArray(),
    [itemId],
  )

  const [editing, setEditing] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const sortedTx = useMemo(() => {
    if (!transactions) return []
    return [...transactions].sort((a, b) =>
      b.occurredAt.localeCompare(a.occurredAt),
    )
  }, [transactions])

  if (item === undefined || transactions === undefined) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">{t('detail.notFound')}</p>
      </div>
    )
  }

  const isLow = item.onHand <= item.reorderLevel
  const stockValue = item.onHand * item.unitCost

  async function handleSave(values: InventoryItemFormValues) {
    if (!item) return
    await dbPut(
      'inventoryItems',
      {
        ...item,
        sku: values.sku,
        name: values.name,
        description: values.description ?? null,
        unit: values.unit,
        reorderLevel: values.reorderLevel,
        unitCost: values.unitCost,
        currency: values.currency,
        active: values.active,
      },
      'update',
    )
    toast.success(t('form.updated'))
    setEditing(false)
  }

  async function handleDelete() {
    await dbDelete('inventoryItems', itemId)
    toast.success(t('detail.deleted'))
    setConfirmDelete(false)
    await navigate({ to: '/inventory' })
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <span>{item.name}</span>
                <span className="font-mono text-sm text-muted-foreground">
                  {item.sku}
                </span>
                {!item.active && (
                  <Badge variant="outline">{t('list.status.inactive')}</Badge>
                )}
                {item.active && isLow && (
                  <Badge variant="destructive">{t('list.status.low')}</Badge>
                )}
              </CardTitle>
              {item.description && (
                <CardDescription>{item.description}</CardDescription>
              )}
            </div>
            <div
              className="flex flex-wrap gap-2"
              data-print-actions
            >
              <PermissionGuard permission="receive:stock">
                <Button onClick={() => setDialogMode('receive')}>
                  {t('detail.actions.receive')}
                </Button>
              </PermissionGuard>
              <PermissionGuard permission="adjust:stock">
                <Button variant="outline" onClick={() => setDialogMode('adjust')}>
                  {t('detail.actions.adjust')}
                </Button>
              </PermissionGuard>
              <PermissionGuard permission="adjust:stock">
                <Button variant="outline" onClick={() => setDialogMode('waste')}>
                  {t('detail.actions.waste')}
                </Button>
              </PermissionGuard>
              <PermissionGuard permission="write:inventory">
                <Button variant="outline" onClick={() => setEditing((v) => !v)}>
                  {t('detail.edit')}
                </Button>
              </PermissionGuard>
              <PermissionGuard permission="write:inventory">
                <Button
                  variant="destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  {t('detail.delete')}
                </Button>
              </PermissionGuard>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLow && item.active && (
            <p className="mb-4 flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {t('detail.lowStock')}
            </p>
          )}
          <dl className="grid gap-4 sm:grid-cols-4">
            <SummaryItem
              label={t('detail.summary.onHand')}
              value={`${item.onHand.toFixed(2)} ${item.unit}`}
            />
            <SummaryItem
              label={t('detail.summary.reorderLevel')}
              value={`${item.reorderLevel.toFixed(2)} ${item.unit}`}
            />
            <SummaryItem
              label={t('detail.summary.unitCost')}
              value={formatMoney(item.unitCost, item.currency)}
            />
            <SummaryItem
              label={t('detail.summary.value')}
              value={formatMoney(stockValue, item.currency)}
            />
          </dl>
        </CardContent>
      </Card>

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle>{t('form.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryItemForm
              mode="edit"
              defaultValues={{
                sku: item.sku,
                name: item.name,
                description: item.description,
                unit: item.unit,
                reorderLevel: item.reorderLevel,
                unitCost: item.unitCost,
                currency: item.currency,
                active: item.active,
              }}
              onSubmit={handleSave}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('detail.transactions.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedTx.length === 0 ? (
            <p className="text-muted-foreground">{t('detail.transactions.empty')}</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('detail.transactions.occurredAt')}</TableHead>
                    <TableHead>{t('detail.transactions.kind')}</TableHead>
                    <TableHead className="text-right">
                      {t('detail.transactions.quantity')}
                    </TableHead>
                    <TableHead>{t('detail.transactions.reference')}</TableHead>
                    <TableHead>{t('detail.transactions.notes')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTx.map((tx) => {
                    const signed =
                      tx.kind === 'receive' || tx.kind === 'adjust'
                        ? tx.quantity
                        : -tx.quantity
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-muted-foreground">
                          {format(parseISO(tx.occurredAt), 'yyyy-MM-dd')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {t(`detail.kind.${tx.kind}` as 'detail.kind.receive')}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${signed < 0 ? 'text-destructive' : ''}`}
                        >
                          {signed > 0 ? '+' : ''}
                          {signed.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {tx.reference ?? ''}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {tx.notes ?? ''}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {dialogMode && (
        <StockMovementDialog
          open
          onOpenChange={(open) => !open && setDialogMode(null)}
          item={item}
          mode={dialogMode}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('detail.deleteTitle')}
        description={t('detail.deleteDescription')}
        confirmLabel={t('detail.delete')}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

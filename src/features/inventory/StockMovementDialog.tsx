import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/features/auth/auth.store'
import type { InventoryItem, InventoryTransactionKind } from '@/lib/db/schema'
import {
  adjustStockSchema,
  receiveStockSchema,
  wasteStockSchema,
  type AdjustStockValues,
  type ReceiveStockValues,
  type WasteStockValues,
} from './inventory.schema'
import { recordStockMovement } from './stock-write'

type Mode = Extract<InventoryTransactionKind, 'receive' | 'adjust' | 'waste' | 'transfer'>

interface StockMovementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: InventoryItem
  mode: Mode
}

type FormValues = ReceiveStockValues | AdjustStockValues | WasteStockValues

const TITLE_KEY: Record<Mode, string> = {
  receive: 'dialog.receiveTitle',
  adjust: 'dialog.adjustTitle',
  waste: 'dialog.wasteTitle',
  transfer: 'dialog.transferTitle',
}

export function StockMovementDialog({
  open,
  onOpenChange,
  item,
  mode,
}: StockMovementDialogProps) {
  const { t } = useTranslation('inventory')

  const schema =
    mode === 'receive'
      ? receiveStockSchema
      : mode === 'adjust'
        ? adjustStockSchema
        : wasteStockSchema

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      quantity: 1,
      unitCost: mode === 'receive' ? item.unitCost : null,
      reference: null,
      occurredAt: new Date().toISOString().slice(0, 10),
      notes: null,
    } as FormValues,
  })

  useEffect(() => {
    if (!open) return
    reset({
      quantity: 1,
      unitCost: mode === 'receive' ? item.unitCost : null,
      reference: null,
      occurredAt: new Date().toISOString().slice(0, 10),
      notes: null,
    } as FormValues)
  }, [open, mode, item, reset])

  async function onSubmit(values: FormValues) {
    const orgId = useAuthStore.getState().orgId
    if (!orgId) {
      toast.error(t('dialog.errorNoOrg'))
      return
    }

    await recordStockMovement({
      orgId,
      inventoryItemId: item.id,
      kind: mode,
      quantity: mode === 'adjust' ? values.quantity : Math.abs(values.quantity),
      unitCost:
        mode === 'receive' && 'unitCost' in values
          ? ((values as ReceiveStockValues).unitCost ?? null)
          : null,
      reference: values.reference ?? null,
      occurredAt: new Date(values.occurredAt).toISOString(),
      notes: values.notes ?? null,
    })

    toast.success(t('dialog.recorded'))
    onOpenChange(false)
  }

  const isAdjust = mode === 'adjust'
  const isReceive = mode === 'receive'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(TITLE_KEY[mode] as 'dialog.receiveTitle')}</DialogTitle>
          {isAdjust && <DialogDescription>{t('dialog.adjustHint')}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stock-quantity">{t('dialog.quantity')}</Label>
            <Input
              id="stock-quantity"
              type="number"
              step="0.01"
              {...register('quantity', { valueAsNumber: true })}
            />
            {errors.quantity?.message && (
              <p className="text-sm text-destructive">
                {t(errors.quantity.message as 'validation.quantityPositive')}
              </p>
            )}
          </div>
          {isReceive && (
            <div className="space-y-2">
              <Label htmlFor="stock-unit-cost">{t('dialog.unitCost')}</Label>
              <Input
                id="stock-unit-cost"
                type="number"
                step="0.01"
                min="0"
                {...register('unitCost' as 'quantity', { valueAsNumber: true })}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="stock-reference">{t('dialog.reference')}</Label>
            <Input id="stock-reference" {...register('reference')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stock-occurred-at">{t('dialog.occurredAt')}</Label>
            <Input id="stock-occurred-at" type="date" {...register('occurredAt')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stock-notes">{t('dialog.notes')}</Label>
            <Textarea id="stock-notes" {...register('notes')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('dialog.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('dialog.recording') : t('dialog.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

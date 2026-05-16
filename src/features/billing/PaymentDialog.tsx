import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import type { Invoice } from '@/lib/db/schema'
import { paymentFormSchema, type PaymentFormValues } from './invoice.schema'

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice
}

const METHODS = ['cash', 'card', 'bank-transfer', 'insurance', 'other'] as const

export function PaymentDialog({ open, onOpenChange, invoice }: PaymentDialogProps) {
  const { t } = useTranslation('billing')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: Math.max(invoice.total - invoice.amountPaid, 0),
      method: 'cash',
      receivedAt: new Date().toISOString().slice(0, 10),
      reference: null,
      notes: null,
    },
  })

  useEffect(() => {
    if (!open) return
    reset({
      amount: Math.max(invoice.total - invoice.amountPaid, 0),
      method: 'cash',
      receivedAt: new Date().toISOString().slice(0, 10),
      reference: null,
      notes: null,
    })
  }, [open, invoice, reset])

  const method = watch('method')

  async function onSubmit(values: PaymentFormValues) {
    const orgId = useAuthStore.getState().orgId
    if (!orgId) {
      toast.error(t('payments.errorNoOrg'))
      return
    }
    await dbPut(
      'payments',
      {
        id: crypto.randomUUID(),
        orgId,
        invoiceId: invoice.id,
        patientId: invoice.patientId,
        amount: values.amount,
        method: values.method,
        receivedAt: new Date(values.receivedAt).toISOString(),
        reference: values.reference ?? null,
        notes: values.notes ?? null,
        deletedAt: null,
        createdAt: '',
        updatedAt: '',
        _synced: false,
        _deleted: false,
      },
      'insert',
    )
    toast.success(t('payments.recorded'))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('payments.record')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payment-amount">{t('payments.amount')}</Label>
            <Input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0"
              {...register('amount', { valueAsNumber: true })}
            />
            {errors.amount?.message && (
              <p className="text-sm text-destructive">
                {t(errors.amount.message as 'validation.amountPositive')}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-method">{t('payments.method')}</Label>
            <Select
              value={method}
              onValueChange={(v) => setValue('method', v as PaymentFormValues['method'])}
            >
              <SelectTrigger id="payment-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(`method.${m}` as 'method.cash')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-received-at">{t('payments.receivedAt')}</Label>
            <Input
              id="payment-received-at"
              type="date"
              {...register('receivedAt')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-reference">{t('payments.reference')}</Label>
            <Input id="payment-reference" {...register('reference')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-notes">{t('payments.notes')}</Label>
            <Textarea id="payment-notes" {...register('notes')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('payments.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('payments.recording') : t('payments.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

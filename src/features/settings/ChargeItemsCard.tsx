import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FeatureGate } from '@/components/ui/feature-gate'
import { PermissionGuard } from '@/components/ui/permission-guard'
import { db } from '@/lib/db'
import { dbDelete, dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import type { ChargeItem } from '@/lib/db/schema'
import {
  chargeItemFormSchema,
  type ChargeItemFormValues,
} from '@/features/billing/invoice.schema'
import { formatMoney } from '@/features/billing/invoice-totals'

export function ChargeItemsCard() {
  const { t } = useTranslation('billing')
  const orgId = useAuthStore((s) => s.orgId)
  const [editing, setEditing] = useState<ChargeItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const items = useLiveQuery(
    () =>
      orgId
        ? db.chargeItems
            .where('orgId')
            .equals(orgId)
            .filter((c) => !c._deleted)
            .toArray()
        : [],
    [orgId],
    [],
  )

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(item: ChargeItem) {
    setEditing(item)
    setDialogOpen(true)
  }

  async function handleDelete(id: string) {
    await dbDelete('chargeItems', id)
    toast.success(t('chargeItems.deleted'))
    setPendingDeleteId(null)
  }

  return (
    <FeatureGate feature="billing">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('chargeItems.cardTitle')}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('chargeItems.cardDescription')}
            </p>
          </div>
          <PermissionGuard permission="manage:charge_items">
            <Button size="sm" onClick={openCreate}>
              {t('chargeItems.addItem')}
            </Button>
          </PermissionGuard>
        </CardHeader>
        <CardContent>
          {(items ?? []).length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              {t('chargeItems.noItems')}
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('chargeItems.code')}</TableHead>
                    <TableHead>{t('chargeItems.name')}</TableHead>
                    <TableHead className="text-right">{t('chargeItems.unitAmount')}</TableHead>
                    <TableHead>{t('chargeItems.active')}</TableHead>
                    <TableHead className="w-[160px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(items ?? []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.code}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(item.unitAmount, item.currency)}
                      </TableCell>
                      <TableCell>
                        {item.active ? t('chargeItems.statusActive') : t('chargeItems.statusInactive')}
                      </TableCell>
                      <TableCell>
                        <PermissionGuard permission="manage:charge_items">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(item)}
                            >
                              {t('chargeItems.edit')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPendingDeleteId(item.id)}
                            >
                              {t('chargeItems.delete')}
                            </Button>
                          </div>
                        </PermissionGuard>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ChargeItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDeleteId(null)
        }}
        title={t('chargeItems.deleteTitle')}
        description={t('chargeItems.deleteDescription')}
        confirmLabel={t('chargeItems.delete')}
        onConfirm={() => {
          if (pendingDeleteId) void handleDelete(pendingDeleteId)
        }}
      />
    </FeatureGate>
  )
}

interface ChargeItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: ChargeItem | null
}

function ChargeItemDialog({ open, onOpenChange, editing }: ChargeItemDialogProps) {
  const { t } = useTranslation('billing')
  const orgId = useAuthStore((s) => s.orgId)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChargeItemFormValues>({
    resolver: zodResolver(chargeItemFormSchema),
    defaultValues: {
      code: editing?.code ?? '',
      name: editing?.name ?? '',
      description: editing?.description ?? null,
      unitAmount: editing?.unitAmount ?? 0,
      currency: editing?.currency ?? 'USD',
      active: editing?.active ?? true,
    },
  })

  const active = watch('active')

  function handleOpenChange(next: boolean) {
    if (!next) {
      reset({
        code: '',
        name: '',
        description: null,
        unitAmount: 0,
        currency: 'USD',
        active: true,
      })
    } else if (editing) {
      reset({
        code: editing.code,
        name: editing.name,
        description: editing.description,
        unitAmount: editing.unitAmount,
        currency: editing.currency,
        active: editing.active,
      })
    }
    onOpenChange(next)
  }

  async function onSubmit(values: ChargeItemFormValues) {
    if (!orgId) return
    if (editing) {
      await dbPut(
        'chargeItems',
        {
          ...editing,
          code: values.code,
          name: values.name,
          description: values.description ?? null,
          unitAmount: values.unitAmount,
          currency: values.currency,
          active: values.active,
        },
        'update',
      )
      toast.success(t('chargeItems.updated'))
    } else {
      await dbPut(
        'chargeItems',
        {
          id: crypto.randomUUID(),
          orgId,
          code: values.code,
          name: values.name,
          description: values.description ?? null,
          unitAmount: values.unitAmount,
          currency: values.currency,
          active: values.active,
          deletedAt: null,
          createdAt: '',
          updatedAt: '',
          _synced: false,
          _deleted: false,
        },
        'insert',
      )
      toast.success(t('chargeItems.created'))
    }
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <span hidden />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? t('chargeItems.editTitle') : t('chargeItems.addItem')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="charge-code">{t('chargeItems.code')}</Label>
            <Input id="charge-code" {...register('code')} />
            {errors.code?.message && (
              <p className="text-sm text-destructive">
                {t(errors.code.message as 'validation.codeRequired')}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="charge-name">{t('chargeItems.name')}</Label>
            <Input id="charge-name" {...register('name')} />
            {errors.name?.message && (
              <p className="text-sm text-destructive">
                {t(errors.name.message as 'validation.nameRequired')}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="charge-description">{t('chargeItems.description')}</Label>
            <Textarea id="charge-description" {...register('description')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="charge-unit-amount">{t('chargeItems.unitAmount')}</Label>
              <Input
                id="charge-unit-amount"
                type="number"
                step="0.01"
                min="0"
                {...register('unitAmount', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="charge-currency">{t('chargeItems.currency')}</Label>
              <Input id="charge-currency" {...register('currency')} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="charge-active">{t('chargeItems.active')}</Label>
            <Switch
              id="charge-active"
              checked={active}
              onCheckedChange={(v) => setValue('active', v)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {t('payments.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('chargeItems.saving') : t('chargeItems.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

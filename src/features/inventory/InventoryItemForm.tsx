import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  inventoryItemFormSchema,
  type InventoryItemFormValues,
} from './inventory.schema'

export type { InventoryItemFormValues }

interface InventoryItemFormProps {
  defaultValues?: Partial<InventoryItemFormValues>
  mode: 'create' | 'edit'
  onSubmit: (values: InventoryItemFormValues) => Promise<void> | void
}

export function InventoryItemForm({
  defaultValues,
  mode,
  onSubmit,
}: InventoryItemFormProps) {
  const { t } = useTranslation('inventory')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InventoryItemFormValues>({
    resolver: zodResolver(inventoryItemFormSchema),
    defaultValues: {
      sku: defaultValues?.sku ?? '',
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? null,
      unit: defaultValues?.unit ?? 'each',
      reorderLevel: defaultValues?.reorderLevel ?? 0,
      unitCost: defaultValues?.unitCost ?? 0,
      currency: defaultValues?.currency ?? 'USD',
      active: defaultValues?.active ?? true,
    },
  })

  const active = watch('active')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="inv-sku">{t('form.sku')} *</Label>
          <Input
            id="inv-sku"
            placeholder={t('form.skuPlaceholder')}
            {...register('sku')}
          />
          {errors.sku?.message && (
            <p className="text-sm text-destructive">
              {t(errors.sku.message as 'validation.skuRequired')}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="inv-name">{t('form.name')} *</Label>
          <Input
            id="inv-name"
            placeholder={t('form.namePlaceholder')}
            {...register('name')}
          />
          {errors.name?.message && (
            <p className="text-sm text-destructive">
              {t(errors.name.message as 'validation.nameRequired')}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="inv-description">{t('form.description')}</Label>
        <Textarea id="inv-description" {...register('description')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="inv-unit">{t('form.unit')} *</Label>
          <Input
            id="inv-unit"
            placeholder={t('form.unitPlaceholder')}
            {...register('unit')}
          />
          {errors.unit?.message && (
            <p className="text-sm text-destructive">
              {t(errors.unit.message as 'validation.unitRequired')}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="inv-reorder">{t('form.reorderLevel')}</Label>
          <Input
            id="inv-reorder"
            type="number"
            step="0.01"
            min="0"
            {...register('reorderLevel', { valueAsNumber: true })}
          />
          {errors.reorderLevel?.message && (
            <p className="text-sm text-destructive">
              {t(errors.reorderLevel.message as 'validation.amountNonNegative')}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="inv-cost">{t('form.unitCost')}</Label>
          <Input
            id="inv-cost"
            type="number"
            step="0.01"
            min="0"
            {...register('unitCost', { valueAsNumber: true })}
          />
          {errors.unitCost?.message && (
            <p className="text-sm text-destructive">
              {t(errors.unitCost.message as 'validation.amountNonNegative')}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label htmlFor="inv-active">{t('form.active')}</Label>
        </div>
        <Switch
          id="inv-active"
          checked={active}
          onCheckedChange={(v) => setValue('active', v)}
        />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? t('form.saving')
          : mode === 'create'
            ? t('form.submitCreate')
            : t('form.submitUpdate')}
      </Button>
    </form>
  )
}

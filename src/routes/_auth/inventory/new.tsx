import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/layout/PageHeader'
import { FeatureGate } from '@/components/ui/feature-gate'
import { InventoryItemForm } from '@/features/inventory/InventoryItemForm'
import type { InventoryItemFormValues } from '@/features/inventory/inventory.schema'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'

export const Route = createFileRoute('/_auth/inventory/new')({
  component: NewInventoryItemRoute,
})

function NewInventoryItemRoute() {
  const navigate = useNavigate()
  const { t } = useTranslation('inventory')

  async function handleSubmit(values: InventoryItemFormValues) {
    const orgId = useAuthStore.getState().orgId
    if (!orgId) return
    const id = crypto.randomUUID()
    await dbPut(
      'inventoryItems',
      {
        id,
        orgId,
        sku: values.sku,
        name: values.name,
        description: values.description ?? null,
        unit: values.unit,
        onHand: 0,
        reorderLevel: values.reorderLevel,
        unitCost: values.unitCost,
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
    toast.success(t('form.created'))
    await navigate({ to: '/inventory/$itemId', params: { itemId: id } })
  }

  return (
    <FeatureGate
      feature="inventory"
      fallback={
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <p className="text-lg font-medium">{t('disabled.title')}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t('disabled.description')}</p>
        </div>
      }
    >
      <PageHeader
        title={t('list.newItem')}
        breadcrumbs={[
          { label: t('list.title'), to: '/inventory' },
          { label: t('list.newItem') },
        ]}
      />
      <div className="p-6">
        <InventoryItemForm mode="create" onSubmit={handleSubmit} />
      </div>
    </FeatureGate>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/layout/PageHeader'
import { FeatureGate } from '@/components/ui/feature-gate'
import { InventoryItemDetail } from '@/features/inventory/InventoryItemDetail'
import { db } from '@/lib/db'

export const Route = createFileRoute('/_auth/inventory/$itemId')({
  component: InventoryDetailRoute,
})

function InventoryDetailRoute() {
  const { itemId } = Route.useParams()
  const { t } = useTranslation('inventory')
  const item = useLiveQuery(() => db.inventoryItems.get(itemId), [itemId])

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
        title={item?.name ?? t('detail.title')}
        breadcrumbs={[
          { label: t('list.title'), to: '/inventory' },
          { label: item?.name ?? itemId },
        ]}
      />
      <InventoryItemDetail itemId={itemId} />
    </FeatureGate>
  )
}

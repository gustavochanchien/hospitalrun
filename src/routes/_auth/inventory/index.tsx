import { createFileRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { FeatureGate } from '@/components/ui/feature-gate'
import { PermissionGuard } from '@/components/ui/permission-guard'
import { InventoryListPage } from '@/features/inventory/InventoryListPage'

export const Route = createFileRoute('/_auth/inventory/')({
  component: InventoryListRoute,
})

function InventoryListRoute() {
  const { t } = useTranslation('inventory')

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
        title={t('list.title')}
        breadcrumbs={[{ label: t('list.title') }]}
        actions={
          <PermissionGuard permission="write:inventory">
            <Button asChild>
              <Link to="/inventory/new">{t('list.newItem')}</Link>
            </Button>
          </PermissionGuard>
        }
      />
      <InventoryListPage />
    </FeatureGate>
  )
}

import { createFileRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { FeatureGate } from '@/components/ui/feature-gate'
import { PermissionGuard } from '@/components/ui/permission-guard'
import { InvoiceListPage } from '@/features/billing/InvoiceListPage'

export const Route = createFileRoute('/_auth/billing/')({
  component: BillingListRoute,
})

function BillingListRoute() {
  const { t } = useTranslation('billing')

  return (
    <FeatureGate
      feature="billing"
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
          <PermissionGuard permission="write:billing">
            <Button asChild>
              <Link to="/billing/new">{t('list.newInvoice')}</Link>
            </Button>
          </PermissionGuard>
        }
      />
      <InvoiceListPage />
    </FeatureGate>
  )
}

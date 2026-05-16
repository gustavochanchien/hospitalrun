import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/layout/PageHeader'
import { FeatureGate } from '@/components/ui/feature-gate'
import { InvoiceDetailPage } from '@/features/billing/InvoiceDetailPage'
import { db } from '@/lib/db'

export const Route = createFileRoute('/_auth/billing/$invoiceId')({
  component: BillingDetailRoute,
})

function BillingDetailRoute() {
  const { invoiceId } = Route.useParams()
  const { t } = useTranslation('billing')
  const invoice = useLiveQuery(() => db.invoices.get(invoiceId), [invoiceId])

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
        title={invoice?.invoiceNumber ?? t('detail.title')}
        breadcrumbs={[
          { label: t('list.title'), to: '/billing' },
          { label: invoice?.invoiceNumber ?? invoiceId },
        ]}
      />
      <InvoiceDetailPage invoiceId={invoiceId} />
    </FeatureGate>
  )
}

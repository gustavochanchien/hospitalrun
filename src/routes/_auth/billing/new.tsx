import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/layout/PageHeader'
import { FeatureGate } from '@/components/ui/feature-gate'
import { InvoiceForm } from '@/features/billing/InvoiceForm'
import type { InvoiceFormValues } from '@/features/billing/InvoiceForm'
import { dbPut } from '@/lib/db/write'
import { generateInvoiceNumber } from '@/lib/db/code-generator'
import { useAuthStore } from '@/features/auth/auth.store'

export const Route = createFileRoute('/_auth/billing/new')({
  component: NewInvoicePage,
})

function NewInvoicePage() {
  const navigate = useNavigate()
  const { t } = useTranslation('billing')

  async function handleSubmit(data: InvoiceFormValues) {
    const { orgId } = useAuthStore.getState()
    const id = crypto.randomUUID()
    const invoiceNumber = await generateInvoiceNumber(orgId ?? '')

    await dbPut(
      'invoices',
      {
        id,
        orgId: orgId ?? '',
        patientId: data.patientId,
        visitId: data.visitId ?? null,
        invoiceNumber,
        status: 'draft' as const,
        issuedAt: null,
        dueAt: null,
        currency: 'USD',
        subtotal: 0,
        tax: 0,
        discount: 0,
        total: 0,
        amountPaid: 0,
        notes: data.notes ?? null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _synced: false,
        _deleted: false,
      },
      'insert',
    )

    toast.success(t('list.newInvoice'))
    await navigate({ to: '/billing/$invoiceId', params: { invoiceId: id } })
  }

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
        title={t('list.newInvoice')}
        breadcrumbs={[
          { label: t('list.title'), to: '/billing' },
          { label: t('list.newInvoice') },
        ]}
      />
      <div className="p-6">
        <InvoiceForm onSubmit={handleSubmit} />
      </div>
    </FeatureGate>
  )
}

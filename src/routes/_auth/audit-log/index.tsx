import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/layout/PageHeader'
import { AuditLogPage } from '@/features/audit-log/AuditLogPage'

export const Route = createFileRoute('/_auth/audit-log/')({
  component: AuditLogRoute,
})

function AuditLogRoute() {
  const { t } = useTranslation('audit-log')
  return (
    <>
      <PageHeader
        title={t('title')}
        breadcrumbs={[{ label: t('title') }]}
      />
      <AuditLogPage />
    </>
  )
}

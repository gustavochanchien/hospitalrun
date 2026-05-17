import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/layout/PageHeader'
import { FeatureGate } from '@/components/ui/feature-gate'
import { PharmacyPage } from '@/features/pharmacy/PharmacyPage'

export const Route = createFileRoute('/_auth/pharmacy/')({
  component: PharmacyRoute,
})

function PharmacyRoute() {
  const { t } = useTranslation('pharmacy')

  return (
    <FeatureGate
      feature="pharmacy"
      fallback={
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <p className="text-lg font-medium">{t('disabled.title')}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('disabled.description')}
          </p>
        </div>
      }
    >
      <PageHeader
        title={t('page.title')}
        breadcrumbs={[{ label: t('page.title') }]}
      />
      <PharmacyPage />
    </FeatureGate>
  )
}

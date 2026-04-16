import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { SettingsPage } from '@/features/settings/SettingsPage'

export const Route = createFileRoute('/_auth/settings/')({
  component: SettingsRoute,
})

function SettingsRoute() {
  return (
    <>
      <PageHeader title="Settings" breadcrumbs={[{ label: 'Settings' }]} />
      <SettingsPage />
    </>
  )
}

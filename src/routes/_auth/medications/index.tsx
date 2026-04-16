import { createFileRoute, Link } from '@tanstack/react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { PermissionGuard } from '@/components/ui/permission-guard'
import { MedicationListPage } from '@/features/medications/MedicationListPage'

export const Route = createFileRoute('/_auth/medications/')({
  component: MedicationsPage,
})

function MedicationsPage() {
  return (
    <>
      <PageHeader
        title="Medications"
        breadcrumbs={[{ label: 'Medications' }]}
        actions={
          <PermissionGuard permission="write:medications">
            <Button asChild>
              <Link to="/medications/new">New Medication</Link>
            </Button>
          </PermissionGuard>
        }
      />
      <MedicationListPage />
    </>
  )
}

import { createFileRoute, Link } from '@tanstack/react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { PermissionGuard } from '@/components/ui/permission-guard'
import { PatientListPage } from '@/features/patients/PatientListPage'

export const Route = createFileRoute('/_auth/patients/')({
  component: PatientsPage,
})

function PatientsPage() {
  return (
    <>
      <PageHeader
        title="Patients"
        breadcrumbs={[{ label: 'Patients' }]}
        actions={
          <PermissionGuard permission="write:patients">
            <Button asChild>
              <Link to="/patients/new">New Patient</Link>
            </Button>
          </PermissionGuard>
        }
      />
      <PatientListPage />
    </>
  )
}

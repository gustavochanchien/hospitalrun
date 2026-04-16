import { createFileRoute, Link } from '@tanstack/react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { PermissionGuard } from '@/components/ui/permission-guard'
import { LabListPage } from '@/features/labs/LabListPage'

export const Route = createFileRoute('/_auth/labs/')({
  component: LabListRoute,
})

function LabListRoute() {
  return (
    <>
      <PageHeader
        title="Labs"
        breadcrumbs={[{ label: 'Labs' }]}
        actions={
          <PermissionGuard permission="write:labs">
            <Button asChild>
              <Link to="/labs/new">New Lab</Link>
            </Button>
          </PermissionGuard>
        }
      />
      <LabListPage />
    </>
  )
}

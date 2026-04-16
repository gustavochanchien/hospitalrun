import { createFileRoute, Link } from '@tanstack/react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { PermissionGuard } from '@/components/ui/permission-guard'
import { IncidentListPage } from '@/features/incidents/IncidentListPage'

export const Route = createFileRoute('/_auth/incidents/')({
  component: IncidentListRoute,
})

function IncidentListRoute() {
  return (
    <>
      <PageHeader
        title="Incidents"
        breadcrumbs={[{ label: 'Incidents' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/incidents/visualize">Analytics</Link>
            </Button>
            <PermissionGuard permission="write:incident">
              <Button asChild>
                <Link to="/incidents/new">Report Incident</Link>
              </Button>
            </PermissionGuard>
          </div>
        }
      />
      <IncidentListPage />
    </>
  )
}

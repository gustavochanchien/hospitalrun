import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { IncidentVisualizePage } from '@/features/incidents/IncidentVisualizePage'

export const Route = createFileRoute('/_auth/incidents/visualize')({
  component: IncidentVisualizeRoute,
})

function IncidentVisualizeRoute() {
  return (
    <>
      <PageHeader
        title="Incident Analytics"
        breadcrumbs={[
          { label: 'Incidents', to: '/incidents' },
          { label: 'Analytics' },
        ]}
      />
      <IncidentVisualizePage />
    </>
  )
}

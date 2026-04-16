import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageHeader } from '@/components/layout/PageHeader'
import { IncidentDetailPage } from '@/features/incidents/IncidentDetailPage'
import { db } from '@/lib/db'

export const Route = createFileRoute('/_auth/incidents/$incidentId')({
  component: IncidentDetailRoute,
})

function IncidentDetailRoute() {
  const { incidentId } = Route.useParams()
  const incident = useLiveQuery(
    () => db.incidents.get(incidentId),
    [incidentId],
  )

  const title = incident && !incident._deleted
    ? `Incident - ${incident.description.slice(0, 40)}${incident.description.length > 40 ? '...' : ''}`
    : 'Incident Detail'

  return (
    <>
      <PageHeader
        title={title}
        breadcrumbs={[
          { label: 'Incidents', to: '/incidents' },
          { label: incidentId.slice(0, 8) },
        ]}
      />
      <IncidentDetailPage incidentId={incidentId} />
    </>
  )
}

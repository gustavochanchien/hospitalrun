import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageHeader } from '@/components/layout/PageHeader'
import { VisitDetailPage } from '@/features/visits/VisitDetailPage'
import { db } from '@/lib/db'

export const Route = createFileRoute('/_auth/visits/$visitId')({
  component: VisitDetailRoute,
})

function VisitDetailRoute() {
  const { visitId } = Route.useParams()
  const visit = useLiveQuery(() => db.visits.get(visitId), [visitId])
  const patient = useLiveQuery(
    () => (visit?.patientId ? db.patients.get(visit.patientId) : undefined),
    [visit?.patientId],
  )

  const patientName = patient
    ? `${patient.givenName} ${patient.familyName}`
    : 'Visit'

  return (
    <>
      <PageHeader
        title={patientName}
        breadcrumbs={[
          { label: 'Patients', to: '/patients' },
          { label: patientName },
          { label: visit?.type ?? 'Visit' },
        ]}
      />
      <VisitDetailPage visitId={visitId} />
    </>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageHeader } from '@/components/layout/PageHeader'
import { LabDetailPage } from '@/features/labs/LabDetailPage'
import { db } from '@/lib/db'

export const Route = createFileRoute('/_auth/labs/$labId')({
  component: LabDetailRoute,
})

function LabDetailRoute() {
  const { labId } = Route.useParams()
  const lab = useLiveQuery(() => db.labs.get(labId), [labId])
  const patient = useLiveQuery(
    () => (lab?.patientId ? db.patients.get(lab.patientId) : undefined),
    [lab?.patientId],
  )

  const title = lab
    ? `${lab.type}${patient ? ` - ${patient.givenName} ${patient.familyName}` : ''}`
    : 'Lab Detail'

  return (
    <>
      <PageHeader
        title={title}
        breadcrumbs={[
          { label: 'Labs', to: '/labs' },
          { label: lab?.type ?? labId },
        ]}
      />
      <LabDetailPage labId={labId} />
    </>
  )
}

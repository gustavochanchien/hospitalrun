import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageHeader } from '@/components/layout/PageHeader'
import { ImagingDetailPage } from '@/features/imaging/ImagingDetailPage'
import { db } from '@/lib/db'

export const Route = createFileRoute('/_auth/imaging/$imagingId')({
  component: ImagingDetailRoute,
})

function ImagingDetailRoute() {
  const { imagingId } = Route.useParams()

  const imaging = useLiveQuery(() => db.imaging.get(imagingId), [imagingId])
  const patient = useLiveQuery(
    () => (imaging?.patientId ? db.patients.get(imaging.patientId) : undefined),
    [imaging?.patientId],
  )

  const label = imaging
    ? `${imaging.type}${patient ? ` — ${patient.givenName} ${patient.familyName}` : ''}`
    : imagingId

  return (
    <>
      <PageHeader
        title="Imaging Detail"
        breadcrumbs={[
          { label: 'Imaging', to: '/imaging' },
          { label },
        ]}
      />
      <ImagingDetailPage imagingId={imagingId} />
    </>
  )
}

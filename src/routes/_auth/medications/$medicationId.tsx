import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageHeader } from '@/components/layout/PageHeader'
import { MedicationDetailPage } from '@/features/medications/MedicationDetailPage'
import { db } from '@/lib/db'

export const Route = createFileRoute('/_auth/medications/$medicationId')({
  component: MedicationDetailRoute,
})

function MedicationDetailRoute() {
  const { medicationId } = Route.useParams()
  const medication = useLiveQuery(
    () => db.medications.get(medicationId),
    [medicationId],
  )

  const name = medication?.name ?? medicationId

  return (
    <>
      <PageHeader
        title={name}
        breadcrumbs={[
          { label: 'Medications', to: '/medications' },
          { label: name },
        ]}
      />
      <MedicationDetailPage medicationId={medicationId} />
    </>
  )
}

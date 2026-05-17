import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { MedicationForm } from '@/features/medications/MedicationForm'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import type { MedicationFormValues } from '@/features/medications/medication.schema'

export const Route = createFileRoute('/_auth/medications/new')({
  component: NewMedicationPage,
})

function NewMedicationPage() {
  const navigate = useNavigate()

  async function handleSubmit(data: MedicationFormValues) {
    const orgId = useAuthStore.getState().orgId ?? ''
    const id = crypto.randomUUID()

    await dbPut(
      'medications',
      {
        id,
        orgId,
        patientId: data.patientId,
        visitId: null,
        name: data.name,
        status: data.status,
        intent: data.intent || null,
        priority: data.priority || null,
        quantity: data.quantity || null,
        requestedBy: useAuthStore.getState().user?.email ?? null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        notes: data.notes || null,
        inventoryItemId: null,
        deletedAt: null,
        createdAt: '',
        updatedAt: '',
        _synced: false,
        _deleted: false,
      },
      'insert',
    )

    toast.success('Medication created')
    await navigate({
      to: '/medications/$medicationId',
      params: { medicationId: id },
    })
  }

  return (
    <>
      <PageHeader
        title="New Medication"
        breadcrumbs={[
          { label: 'Medications', to: '/medications' },
          { label: 'New Medication' },
        ]}
      />
      <div className="p-6">
        <MedicationForm onSubmit={handleSubmit} />
      </div>
    </>
  )
}

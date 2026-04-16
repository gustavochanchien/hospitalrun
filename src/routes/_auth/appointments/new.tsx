import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { AppointmentForm } from '@/features/appointments/AppointmentForm'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import type { AppointmentFormValues } from '@/features/appointments/appointment.schema'

export const Route = createFileRoute('/_auth/appointments/new')({
  component: NewAppointmentPage,
})

function NewAppointmentPage() {
  const navigate = useNavigate()

  async function handleSubmit(data: AppointmentFormValues) {
    const orgId = useAuthStore.getState().orgId ?? ''
    const id = crypto.randomUUID()

    await dbPut(
      'appointments',
      {
        id,
        orgId,
        patientId: data.patientId,
        type: data.type || null,
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
        location: data.location || null,
        reason: data.reason || null,
        requestedBy: useAuthStore.getState().user?.email ?? null,
        status: 'scheduled' as const,
        notes: data.notes || null,
        deletedAt: null,
        createdAt: '',
        updatedAt: '',
        _synced: false,
        _deleted: false,
      },
      'insert',
    )

    toast.success('Appointment created')
    await navigate({
      to: '/appointments/$appointmentId',
      params: { appointmentId: id },
    })
  }

  return (
    <>
      <PageHeader
        title="New Appointment"
        breadcrumbs={[
          { label: 'Appointments', to: '/appointments' },
          { label: 'New Appointment' },
        ]}
      />
      <div className="p-6">
        <AppointmentForm onSubmit={handleSubmit} />
      </div>
    </>
  )
}

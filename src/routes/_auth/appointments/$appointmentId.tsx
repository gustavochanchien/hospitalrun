import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageHeader } from '@/components/layout/PageHeader'
import { AppointmentDetailPage } from '@/features/appointments/AppointmentDetailPage'
import { db } from '@/lib/db'

export const Route = createFileRoute('/_auth/appointments/$appointmentId')({
  component: AppointmentDetailRoute,
})

function AppointmentDetailRoute() {
  const { appointmentId } = Route.useParams()
  const appointment = useLiveQuery(
    () => db.appointments.get(appointmentId),
    [appointmentId],
  )
  const patient = useLiveQuery(
    () => {
      if (!appointment?.patientId) return undefined
      return db.patients.get(appointment.patientId)
    },
    [appointment?.patientId],
  )

  const patientName = patient
    ? `${patient.givenName} ${patient.familyName}`
    : 'Appointment'

  return (
    <>
      <PageHeader
        title={patientName}
        breadcrumbs={[
          { label: 'Appointments', to: '/appointments' },
          { label: patientName },
        ]}
      />
      <AppointmentDetailPage appointmentId={appointmentId} />
    </>
  )
}

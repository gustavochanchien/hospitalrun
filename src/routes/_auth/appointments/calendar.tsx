import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { AppointmentCalendarPage } from '@/features/appointments/AppointmentCalendarPage'

export const Route = createFileRoute('/_auth/appointments/calendar')({
  component: CalendarRoute,
})

function CalendarRoute() {
  return (
    <>
      <PageHeader
        title="Appointment Calendar"
        breadcrumbs={[
          { label: 'Appointments', to: '/appointments' },
          { label: 'Calendar' },
        ]}
      />
      <AppointmentCalendarPage />
    </>
  )
}

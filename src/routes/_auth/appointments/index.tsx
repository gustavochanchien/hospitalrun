import { createFileRoute, Link } from '@tanstack/react-router'
import { CalendarDays } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { PermissionGuard } from '@/components/ui/permission-guard'
import { AppointmentListPage } from '@/features/appointments/AppointmentListPage'

export const Route = createFileRoute('/_auth/appointments/')({
  component: AppointmentsPage,
})

function AppointmentsPage() {
  return (
    <>
      <PageHeader
        title="Appointments"
        breadcrumbs={[{ label: 'Appointments' }]}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/appointments/calendar">
                <CalendarDays className="mr-1.5 h-4 w-4" />
                Calendar
              </Link>
            </Button>
            <PermissionGuard permission="write:appointments">
              <Button asChild>
                <Link to="/appointments/new">New Appointment</Link>
              </Button>
            </PermissionGuard>
          </>
        }
      />
      <AppointmentListPage />
    </>
  )
}

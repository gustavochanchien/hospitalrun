import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PermissionGuard } from '@/components/ui/permission-guard'
import { db } from '@/lib/db'
import { dbPut, dbDelete } from '@/lib/db/write'

interface AppointmentDetailPageProps {
  appointmentId: string
}

function statusVariant(status: string) {
  switch (status) {
    case 'scheduled':
      return 'default' as const
    case 'completed':
      return 'secondary' as const
    case 'cancelled':
      return 'destructive' as const
    case 'no-show':
      return 'outline' as const
    default:
      return 'secondary' as const
  }
}

export function AppointmentDetailPage({
  appointmentId,
}: AppointmentDetailPageProps) {
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)

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

  if (appointment === undefined) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!appointment || appointment._deleted) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <p className="text-muted-foreground">Appointment not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/appointments">Back to Appointments</Link>
        </Button>
      </div>
    )
  }

  const patientName = patient
    ? `${patient.givenName} ${patient.familyName}`
    : 'Unknown Patient'

  async function handleStatusChange(
    newStatus: 'completed' | 'cancelled' | 'no-show',
  ) {
    if (!appointment) return
    await dbPut(
      'appointments',
      {
        ...appointment,
        status: newStatus,
      },
      'update',
    )
    toast.success(`Appointment marked as ${newStatus}`)
  }

  async function handleDelete() {
    await dbDelete('appointments', appointmentId)
    toast.success('Appointment deleted')
    await navigate({ to: '/appointments' })
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <CardTitle className="text-xl">Appointment Details</CardTitle>
          <Badge variant={statusVariant(appointment.status)}>
            {appointment.status}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium text-muted-foreground">Patient</p>
              <Link
                to="/patients/$patientId"
                params={{ patientId: appointment.patientId }}
                className="text-primary hover:underline"
              >
                {patientName}
              </Link>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Type</p>
              <p>{appointment.type ?? '\u2014'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Start Time</p>
              <p>{format(parseISO(appointment.startTime), 'MMM d, yyyy h:mm a')}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">End Time</p>
              <p>{format(parseISO(appointment.endTime), 'MMM d, yyyy h:mm a')}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Location</p>
              <p>{appointment.location ?? '\u2014'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Status</p>
              <p className="capitalize">{appointment.status}</p>
            </div>
            {appointment.reason && (
              <div className="sm:col-span-2">
                <p className="font-medium text-muted-foreground">Reason for Visit</p>
                <p className="whitespace-pre-wrap">{appointment.reason}</p>
              </div>
            )}
            {appointment.notes && (
              <div className="sm:col-span-2">
                <p className="font-medium text-muted-foreground">Notes</p>
                <p className="whitespace-pre-wrap">{appointment.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Transition Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        {appointment.status === 'scheduled' && (
          <PermissionGuard permission="write:appointments">
            <Button onClick={() => void handleStatusChange('completed')}>
              Complete
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleStatusChange('cancelled')}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleStatusChange('no-show')}
            >
              No Show
            </Button>
          </PermissionGuard>
        )}
        <PermissionGuard permission="delete:appointment">
          <Button
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            Delete
          </Button>
        </PermissionGuard>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this record?"
        description="This action cannot be undone. The record will be permanently removed."
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}

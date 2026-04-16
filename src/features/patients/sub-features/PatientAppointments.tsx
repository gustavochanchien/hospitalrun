import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { Link } from '@tanstack/react-router'
import { db } from '@/lib/db'
import { dbPut, dbDelete } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface PatientAppointmentsProps {
  patientId: string
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

export function PatientAppointments({ patientId }: PatientAppointmentsProps) {
  const [open, setOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [type, setType] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')

  const appointments = useLiveQuery(
    () =>
      db.appointments
        .where({ patientId })
        .filter((a) => !a._deleted)
        .toArray(),
    [patientId],
  )

  function resetForm() {
    setType('')
    setStartTime('')
    setEndTime('')
    setLocation('')
    setNotes('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!startTime || !endTime) return

    const orgId = useAuthStore.getState().orgId ?? ''
    await dbPut(
      'appointments',
      {
        id: crypto.randomUUID(),
        orgId,
        patientId,
        type: type || null,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        location: location || null,
        requestedBy: null,
        status: 'scheduled' as const,
        notes: notes || null,
        deletedAt: null,
      },
      'insert',
    )
    resetForm()
    setOpen(false)
  }

  async function handleDelete(id: string) {
    await dbDelete('appointments', id)
    setPendingDeleteId(null)
  }

  if (appointments === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Appointments</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">New Appointment</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Appointment</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appt-type">Type</Label>
                <Input
                  id="appt-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="e.g. Follow-up, Consultation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appt-start">Start Time</Label>
                <Input
                  id="appt-start"
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appt-end">End Time</Label>
                <Input
                  id="appt-end"
                  type="datetime-local"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appt-location">Location</Label>
                <Input
                  id="appt-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Room 204"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appt-notes">Notes</Label>
                <Textarea
                  id="appt-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                Create Appointment
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {appointments.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No appointments found.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date / Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((appt) => (
                <TableRow key={appt.id}>
                  <TableCell>
                    <Link
                      to="/appointments/$appointmentId"
                      params={{ appointmentId: appt.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {format(parseISO(appt.startTime), 'MMM d, yyyy h:mm a')}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {appt.type ?? '\u2014'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(appt.status)}>
                      {appt.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {appt.location ?? '\u2014'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDeleteId(appt.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(isOpen) => { if (!isOpen) setPendingDeleteId(null) }}
        onConfirm={() => {
          if (pendingDeleteId) void handleDelete(pendingDeleteId)
        }}
      />
    </div>
  )
}

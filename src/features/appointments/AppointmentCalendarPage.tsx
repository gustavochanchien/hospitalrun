import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg } from '@fullcalendar/core'
import { db } from '@/lib/db'

export function AppointmentCalendarPage() {
  const navigate = useNavigate()

  const appointments = useLiveQuery(
    () => db.appointments.filter((a) => !a._deleted).toArray(),
    [],
  )

  const patients = useLiveQuery(
    () => db.patients.filter((p) => !p._deleted).toArray(),
    [],
  )

  const patientMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of patients ?? []) {
      map.set(p.id, `${p.givenName} ${p.familyName}`)
    }
    return map
  }, [patients])

  const events = useMemo(
    () =>
      (appointments ?? []).map((appt) => ({
        id: appt.id,
        title:
          patientMap.get(appt.patientId) ??
          (appt.type ? `${appt.type}` : 'Appointment'),
        start: appt.startTime,
        end: appt.endTime,
        backgroundColor:
          appt.status === 'scheduled'
            ? 'hsl(var(--primary))'
            : appt.status === 'completed'
              ? 'hsl(var(--muted-foreground))'
              : appt.status === 'cancelled'
                ? 'hsl(var(--destructive))'
                : undefined,
      })),
    [appointments, patientMap],
  )

  return (
    <div className="p-6">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        events={events}
        eventClick={(info: EventClickArg) => {
          void navigate({
            to: '/appointments/$appointmentId',
            params: { appointmentId: info.event.id },
          })
        }}
        height="auto"
      />
    </div>
  )
}

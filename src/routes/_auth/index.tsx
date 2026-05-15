import { createFileRoute, Link } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { isToday, format, parseISO } from 'date-fns'
import { Users, CalendarDays, FlaskConical, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { db } from '@/lib/db'

export const Route = createFileRoute('/_auth/')({
  component: DashboardPage,
})

function DashboardPage() {
  const { t } = useTranslation(['dashboard', 'common', 'patient'])
  const patients = useLiveQuery(() =>
    db.patients.filter((p) => !p._deleted).toArray(),
  )

  const appointments = useLiveQuery(() =>
    db.appointments.filter((a) => !a._deleted).toArray(),
  )

  const labs = useLiveQuery(() =>
    db.labs.filter((l) => !l._deleted).toArray(),
  )

  const incidents = useLiveQuery(() =>
    db.incidents.filter((i) => !i._deleted).toArray(),
  )

  const isLoading =
    patients === undefined ||
    appointments === undefined ||
    labs === undefined ||
    incidents === undefined

  const totalPatients = patients?.length ?? 0
  const todaysAppointments =
    appointments?.filter((a) => {
      try {
        return isToday(parseISO(a.startTime))
      } catch {
        return false
      }
    }) ?? []
  const openLabs = labs?.filter((l) => l.status === 'requested').length ?? 0
  const openIncidents =
    incidents?.filter((i) => i.status === 'reported').length ?? 0

  const recentPatients = patients
    ? [...patients]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .slice(0, 5)
    : []

  const sortedTodayAppointments = [...todaysAppointments].sort(
    (a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  )

  return (
    <>
      <PageHeader title={t('dashboard:title')} breadcrumbs={[{ label: t('dashboard:title') }]} />
      <div className="space-y-6 p-6">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title={t('dashboard:stats.totalPatients')}
            value={totalPatients}
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
            loading={isLoading}
          />
          <StatsCard
            title={t('dashboard:stats.todaysAppointments')}
            value={todaysAppointments.length}
            icon={<CalendarDays className="h-4 w-4 text-muted-foreground" />}
            loading={isLoading}
          />
          <StatsCard
            title={t('dashboard:stats.openLabs')}
            value={openLabs}
            icon={<FlaskConical className="h-4 w-4 text-muted-foreground" />}
            loading={isLoading}
          />
          <StatsCard
            title={t('dashboard:stats.openIncidents')}
            value={openIncidents}
            icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
            loading={isLoading}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Patients */}
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard:recentPatients')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : recentPatients.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('dashboard:noPatients')}{' '}
                  <Link
                    to="/patients/new"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {t('dashboard:addPatient')}
                  </Link>
                </p>
              ) : (
                <div className="space-y-2">
                  {recentPatients.map((patient) => (
                    <Link
                      key={patient.id}
                      to="/patients/$patientId"
                      params={{ patientId: patient.id }}
                      className="flex items-center justify-between rounded-md border px-3 py-2 transition-colors hover:bg-muted/50"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {patient.givenName} {patient.familyName}
                        </p>
                        {patient.mrn && (
                          <p className="text-xs text-muted-foreground">
                            {t('patient:fields.mrn')}: {patient.mrn}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={
                          patient.status === 'active'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {patient.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Today's Appointments */}
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard:todaysAppointments')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : sortedTodayAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('dashboard:noAppointments')}
                </p>
              ) : (
                <div className="space-y-2">
                  {sortedTodayAppointments.map((appt) => (
                    <AppointmentRow key={appt.id} appointment={appt} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

function StatsCard({
  title,
  value,
  icon,
  loading,
}: {
  title: string
  value: number
  icon: React.ReactNode
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-bold">{value}</p>
        )}
      </CardContent>
    </Card>
  )
}

function AppointmentRow({
  appointment,
}: {
  appointment: { id: string; patientId: string; startTime: string; type: string | null; status: string }
}) {
  const { t } = useTranslation('common')
  const patient = useLiveQuery(
    () => db.patients.get(appointment.patientId),
    [appointment.patientId],
  )

  const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    scheduled: 'default',
    completed: 'secondary',
    cancelled: 'destructive',
    'no-show': 'outline',
  }

  return (
    <Link
      to="/appointments/$appointmentId"
      params={{ appointmentId: appointment.id }}
      className="flex items-center justify-between rounded-md border px-3 py-2 transition-colors hover:bg-muted/50"
    >
      <div>
        <p className="text-sm font-medium">
          {patient
            ? `${patient.givenName} ${patient.familyName}`
            : t('actions.loading')}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(parseISO(appointment.startTime), 'h:mm a')}
          {appointment.type && ` \u2014 ${appointment.type}`}
        </p>
      </div>
      <Badge variant={statusColors[appointment.status] ?? 'secondary'}>
        {appointment.status}
      </Badge>
    </Link>
  )
}

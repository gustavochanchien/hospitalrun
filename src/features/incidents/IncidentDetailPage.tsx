import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PermissionGuard } from '@/components/ui/permission-guard'
import { db } from '@/lib/db'
import { dbPut, dbDelete } from '@/lib/db/write'

interface IncidentDetailPageProps {
  incidentId: string
}

export function IncidentDetailPage({ incidentId }: IncidentDetailPageProps) {
  const { t } = useTranslation('incidents')
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const incident = useLiveQuery(
    () => db.incidents.get(incidentId),
    [incidentId],
  )

  const patient = useLiveQuery(
    async () => {
      if (!incident?.patientId) return null
      return db.patients.get(incident.patientId) ?? null
    },
    [incident?.patientId],
  )

  if (incident === undefined) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!incident || incident._deleted) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <p className="text-muted-foreground">{t('notFound')}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/incidents">{t('backToIncidents')}</Link>
        </Button>
      </div>
    )
  }

  async function handleResolve() {
    if (!incident) return
    const now = new Date().toISOString()
    await dbPut(
      'incidents',
      {
        ...incident,
        status: 'resolved' as const,
        resolvedOn: now,
      },
      'update',
    )
    toast.success(t('detail.resolved'))
  }

  async function handleDelete() {
    await dbDelete('incidents', incidentId)
    toast.success(t('detail.deleted'))
    await navigate({ to: '/incidents' })
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <CardTitle className="text-xl">{t('detail.cardTitle')}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant={incident.status === 'reported' ? 'default' : 'secondary'}
            >
              {incident.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium text-muted-foreground">{t('fields.date')}</p>
              <p>{format(parseISO(incident.reportedOn), 'MMM d, yyyy h:mm a')}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">{t('fields.reporter')}</p>
              <p>{incident.reportedBy ?? '—'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">{t('fields.department')}</p>
              <p>{incident.department ?? '—'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">{t('fields.category')}</p>
              <p>{incident.category ?? '—'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">{t('fields.categoryItem')}</p>
              <p>{incident.categoryItem ?? '—'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Patient</p>
              {incident.patientId && patient && !patient._deleted ? (
                <Link
                  to="/patients/$patientId"
                  params={{ patientId: incident.patientId }}
                  className="text-primary hover:underline"
                >
                  {patient.givenName} {patient.familyName}
                </Link>
              ) : incident.patientId ? (
                <p>{incident.patientId}</p>
              ) : (
                <p>{'—'}</p>
              )}
            </div>
            {incident.status === 'resolved' && incident.resolvedOn && (
              <div>
                <p className="font-medium text-muted-foreground">{t('fields.resolvedOn')}</p>
                <p>{format(parseISO(incident.resolvedOn), 'MMM d, yyyy h:mm a')}</p>
              </div>
            )}
          </div>

          <div>
            <p className="font-medium text-muted-foreground text-sm">
              {t('fields.description')}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{incident.description}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        {incident.status === 'reported' && (
          <PermissionGuard permission="resolve:incident">
            <Button onClick={handleResolve}>{t('detail.resolve')}</Button>
          </PermissionGuard>
        )}
        <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
          {t('detail.delete')}
        </Button>
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

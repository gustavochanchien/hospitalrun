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

interface IncidentDetailPageProps {
  incidentId: string
}

export function IncidentDetailPage({ incidentId }: IncidentDetailPageProps) {
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
        <p className="text-muted-foreground">Incident not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/incidents">Back to Incidents</Link>
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
    toast.success('Incident resolved')
  }

  async function handleDelete() {
    await dbDelete('incidents', incidentId)
    toast.success('Incident deleted')
    await navigate({ to: '/incidents' })
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <CardTitle className="text-xl">Incident Details</CardTitle>
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
              <p className="font-medium text-muted-foreground">Date Reported</p>
              <p>{format(parseISO(incident.reportedOn), 'MMM d, yyyy h:mm a')}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Reported By</p>
              <p>{incident.reportedBy ?? '\u2014'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Department</p>
              <p>{incident.department ?? '\u2014'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Category</p>
              <p>{incident.category ?? '\u2014'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Category Item</p>
              <p>{incident.categoryItem ?? '\u2014'}</p>
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
                <p>{'\u2014'}</p>
              )}
            </div>
            {incident.status === 'resolved' && incident.resolvedOn && (
              <div>
                <p className="font-medium text-muted-foreground">Resolved On</p>
                <p>{format(parseISO(incident.resolvedOn), 'MMM d, yyyy h:mm a')}</p>
              </div>
            )}
          </div>

          <div>
            <p className="font-medium text-muted-foreground text-sm">
              Description
            </p>
            <p className="mt-1 whitespace-pre-wrap">{incident.description}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        {incident.status === 'reported' && (
          <PermissionGuard permission="resolve:incident">
            <Button onClick={handleResolve}>Resolve</Button>
          </PermissionGuard>
        )}
        <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
          Delete
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

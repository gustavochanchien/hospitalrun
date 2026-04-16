import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { db } from '@/lib/db'
import { dbPut, dbDelete } from '@/lib/db/write'
import { MEDICATION_STATUSES, type MedicationStatus } from './medication.schema'

interface MedicationDetailPageProps {
  medicationId: string
}

function statusVariant(status: MedicationStatus) {
  switch (status) {
    case 'active':
      return 'default' as const
    case 'completed':
      return 'secondary' as const
    case 'canceled':
    case 'entered in error':
    case 'stopped':
      return 'destructive' as const
    case 'on hold':
      return 'outline' as const
    default:
      return 'secondary' as const
  }
}

export function MedicationDetailPage({
  medicationId,
}: MedicationDetailPageProps) {
  const navigate = useNavigate()
  const [newStatus, setNewStatus] = useState<MedicationStatus | ''>('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const medication = useLiveQuery(
    () => db.medications.get(medicationId),
    [medicationId],
  )

  const patient = useLiveQuery(
    () =>
      medication?.patientId
        ? db.patients.get(medication.patientId)
        : undefined,
    [medication?.patientId],
  )

  if (medication === undefined) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!medication || medication._deleted) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <p className="text-muted-foreground">Medication not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/medications">Back to Medications</Link>
        </Button>
      </div>
    )
  }

  async function handleStatusUpdate() {
    if (!newStatus || !medication) return
    await dbPut(
      'medications',
      {
        ...medication,
        status: newStatus,
      },
      'update',
    )
    toast.success(`Status updated to "${newStatus}"`)
    setNewStatus('')
  }

  async function handleDelete() {
    await dbDelete('medications', medicationId)
    toast.success('Medication deleted')
    await navigate({ to: '/medications' })
  }

  const patientName = patient
    ? `${patient.givenName} ${patient.familyName}`
    : 'Unknown'

  return (
    <div className="space-y-6 p-6">
      {/* Medication Info Card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-xl">{medication.name}</CardTitle>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                Patient:{' '}
                <Link
                  to="/patients/$patientId"
                  params={{ patientId: medication.patientId }}
                  className="text-primary hover:underline"
                >
                  {patientName}
                </Link>
              </span>
            </div>
          </div>
          <Badge variant={statusVariant(medication.status)}>
            {medication.status}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="font-medium text-muted-foreground">Intent</p>
              <p>{medication.intent ?? '\u2014'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Priority</p>
              <p>{medication.priority ?? '\u2014'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Quantity</p>
              <p>{medication.quantity ?? '\u2014'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Start Date</p>
              <p>
                {medication.startDate
                  ? format(parseISO(medication.startDate), 'MMM d, yyyy')
                  : '\u2014'}
              </p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">End Date</p>
              <p>
                {medication.endDate
                  ? format(parseISO(medication.endDate), 'MMM d, yyyy')
                  : '\u2014'}
              </p>
            </div>
            {medication.notes && (
              <div className="sm:col-span-3">
                <p className="font-medium text-muted-foreground">Notes</p>
                <p className="whitespace-pre-wrap">{medication.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Transition */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Update Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Select
              value={newStatus}
              onValueChange={(v) => setNewStatus(v as MedicationStatus)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {MEDICATION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => void handleStatusUpdate()}
              disabled={!newStatus || newStatus === medication.status}
            >
              Update Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete */}
      <div className="flex justify-end">
        <Button
          variant="destructive"
          onClick={() => setConfirmOpen(true)}
        >
          Delete Medication
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

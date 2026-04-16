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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface PatientMedicationsProps {
  patientId: string
  visitId?: string | null
}

type MedicationStatus =
  | 'draft'
  | 'active'
  | 'on hold'
  | 'canceled'
  | 'completed'
  | 'entered in error'
  | 'stopped'
  | 'unknown'

const MEDICATION_STATUSES: MedicationStatus[] = [
  'draft',
  'active',
  'on hold',
  'canceled',
  'completed',
  'entered in error',
  'stopped',
  'unknown',
]

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

export function PatientMedications({ patientId, visitId = null }: PatientMedicationsProps) {
  const [open, setOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [status, setStatus] = useState<MedicationStatus>('draft')
  const [intent, setIntent] = useState('')
  const [priority, setPriority] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')

  const medications = useLiveQuery(
    () =>
      db.medications
        .where({ patientId })
        .filter((m) => !m._deleted && (!visitId || m.visitId === visitId))
        .toArray(),
    [patientId, visitId],
  )

  function resetForm() {
    setName('')
    setStatus('draft')
    setIntent('')
    setPriority('')
    setQuantity('')
    setNotes('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name) return

    const { orgId, user } = useAuthStore.getState()
    await dbPut(
      'medications',
      {
        id: crypto.randomUUID(),
        orgId: orgId ?? '',
        patientId,
        visitId: visitId ?? null,
        name,
        status,
        intent: intent || null,
        priority: priority || null,
        quantity: quantity || null,
        requestedBy: user?.email ?? null,
        startDate: null,
        endDate: null,
        notes: notes || null,
        deletedAt: null,
      },
      'insert',
    )
    resetForm()
    setOpen(false)
  }

  async function handleDelete(id: string) {
    await dbDelete('medications', id)
    setPendingDeleteId(null)
  }

  if (medications === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Medications</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">New Medication</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Medication</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="med-name">Name</Label>
                <Input
                  id="med-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Amoxicillin 500mg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="med-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as MedicationStatus)}
                >
                  <SelectTrigger id="med-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDICATION_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="med-intent">Intent</Label>
                <Input
                  id="med-intent"
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  placeholder="e.g. order, plan, proposal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="med-priority">Priority</Label>
                <Input
                  id="med-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  placeholder="e.g. routine, urgent, stat"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="med-quantity">Quantity</Label>
                <Input
                  id="med-quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 30 tablets"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="med-notes">Notes</Label>
                <Textarea
                  id="med-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                Create Medication
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {medications.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No medications found.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {medications.map((med) => (
                <TableRow key={med.id}>
                  <TableCell>
                    <Link
                      to="/medications/$medicationId"
                      params={{ medicationId: med.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {med.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(med.status)}>
                      {med.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {med.quantity ?? '\u2014'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {med.startDate
                      ? format(parseISO(med.startDate), 'MMM d, yyyy')
                      : '\u2014'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {med.endDate
                      ? format(parseISO(med.endDate), 'MMM d, yyyy')
                      : '\u2014'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDeleteId(med.id)}
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

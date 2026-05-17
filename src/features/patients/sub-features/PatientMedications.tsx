import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { Link } from '@tanstack/react-router'
import { db } from '@/lib/db'
import { dbPut, dbDelete } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { DrugInteractionAlert } from '@/features/medications/drug-interaction-alert'
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

const STATUS_KEY: Record<MedicationStatus, string> = {
  'draft': 'draft',
  'active': 'active',
  'on hold': 'onHold',
  'canceled': 'canceled',
  'completed': 'completed',
  'entered in error': 'enteredInError',
  'stopped': 'stopped',
  'unknown': 'unknown',
}

export function PatientMedications({ patientId, visitId = null }: PatientMedicationsProps) {
  const { t } = useTranslation('patient')
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

  const activeMeds = useMemo(
    () => (medications ?? []).filter((m) => m.status === 'active'),
    [medications],
  )

  if (medications === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">{t('subFeatures.common.loading')}</p>
  }

  return (
    <div className="space-y-4">
      <DrugInteractionAlert activeMedications={activeMeds} />
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{t('subFeatures.medications.title')}</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">{t('subFeatures.medications.newAction')}</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('subFeatures.medications.newAction')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="med-name">{t('subFeatures.medications.fields.name')}</Label>
                <Input
                  id="med-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('subFeatures.medications.placeholders.name')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="med-status">{t('subFeatures.medications.fields.status')}</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as MedicationStatus)}
                >
                  <SelectTrigger id="med-status">
                    <SelectValue placeholder={t('subFeatures.medications.placeholders.status')} />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDICATION_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`subFeatures.medications.statusOption.${STATUS_KEY[s]}` as `subFeatures.medications.statusOption.${string}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="med-intent">{t('subFeatures.medications.fields.intent')}</Label>
                <Input
                  id="med-intent"
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  placeholder={t('subFeatures.medications.placeholders.intent')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="med-priority">{t('subFeatures.medications.fields.priority')}</Label>
                <Input
                  id="med-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  placeholder={t('subFeatures.medications.placeholders.priority')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="med-quantity">{t('subFeatures.medications.fields.quantity')}</Label>
                <Input
                  id="med-quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder={t('subFeatures.medications.placeholders.quantity')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="med-notes">{t('subFeatures.medications.fields.notes')}</Label>
                <Textarea
                  id="med-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                {t('subFeatures.medications.create')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {medications.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('subFeatures.medications.noResults')}
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('subFeatures.medications.fields.name')}</TableHead>
                <TableHead>{t('subFeatures.medications.fields.status')}</TableHead>
                <TableHead>{t('subFeatures.medications.fields.quantity')}</TableHead>
                <TableHead>{t('subFeatures.medications.fields.startDate')}</TableHead>
                <TableHead>{t('subFeatures.medications.fields.endDate')}</TableHead>
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
                    {med.quantity ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {med.startDate
                      ? format(parseISO(med.startDate), 'MMM d, yyyy')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {med.endDate
                      ? format(parseISO(med.endDate), 'MMM d, yyyy')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDeleteId(med.id)}
                    >
                      {t('subFeatures.common.delete')}
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

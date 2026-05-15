import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { db } from '@/lib/db'
import { dbPut, dbDelete } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { Button } from '@/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RichTextEditor } from '@/components/rich-text-editor'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { CarePlan } from '@/lib/db/schema'

type CarePlanStatus = CarePlan['status']

const STATUSES: CarePlanStatus[] = [
  'draft',
  'active',
  'on-hold',
  'revoked',
  'completed',
  'entered-in-error',
  'unknown',
]

interface PatientCarePlansProps {
  patientId: string
}

export function PatientCarePlans({ patientId }: PatientCarePlansProps) {
  const { t } = useTranslation('patient')
  const [open, setOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<CarePlanStatus>('draft')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [intent, setIntent] = useState<string>('')
  const [diagnosisId, setDiagnosisId] = useState('')

  const carePlans = useLiveQuery(
    () =>
      db.carePlans
        .where('patientId')
        .equals(patientId)
        .filter((p) => !p._deleted)
        .toArray(),
    [patientId],
  )

  const diagnoses = useLiveQuery(
    () =>
      db.diagnoses
        .where('patientId')
        .equals(patientId)
        .filter((d) => !d._deleted)
        .toArray(),
    [patientId],
  )

  function resetForm() {
    setTitle('')
    setDescription('')
    setStatus('draft')
    setStartDate('')
    setEndDate('')
    setNotes('')
    setIntent('')
    setDiagnosisId('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    const orgId = useAuthStore.getState().orgId ?? ''
    const record: CarePlan = {
      id: crypto.randomUUID(),
      orgId,
      patientId,
      title: title.trim(),
      description: description.trim() || null,
      diagnosisId: diagnosisId || null,
      status,
      startDate: startDate || null,
      endDate: endDate || null,
      notes: notes.trim() || null,
      intent: (intent as CarePlan['intent']) || null,
      deletedAt: null,
      createdAt: '',
      updatedAt: '',
      _synced: false,
      _deleted: false,
    }

    await dbPut('carePlans', record, 'insert')
    resetForm()
    setOpen(false)
  }

  function statusBadgeVariant(s: CarePlanStatus) {
    switch (s) {
      case 'active':
        return 'default' as const
      case 'completed':
        return 'default' as const
      case 'revoked':
      case 'entered-in-error':
        return 'destructive' as const
      default:
        return 'secondary' as const
    }
  }

  if (carePlans === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">{t('subFeatures.common.loading')}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('subFeatures.carePlans.title')}</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">{t('subFeatures.carePlans.newAction')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('subFeatures.carePlans.newAction')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cp-title">{t('subFeatures.carePlans.fields.titleRequired')}</Label>
                <Input
                  id="cp-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp-description">{t('subFeatures.carePlans.fields.description')}</Label>
                <RichTextEditor
                  id="cp-description"
                  value={description}
                  onChange={setDescription}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp-diagnosis">{t('subFeatures.carePlans.fields.diagnosis')}</Label>
                <Select value={diagnosisId} onValueChange={setDiagnosisId}>
                  <SelectTrigger id="cp-diagnosis">
                    <SelectValue placeholder={t('subFeatures.carePlans.placeholders.diagnosisNone')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('subFeatures.carePlans.none')}</SelectItem>
                    {(diagnoses ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.description}
                        {d.icdCode ? ` (${d.icdCode})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp-status">{t('subFeatures.carePlans.fields.status')}</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as CarePlanStatus)}
                >
                  <SelectTrigger id="cp-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp-intent">{t('subFeatures.carePlans.fields.intent')}</Label>
                <Select value={intent} onValueChange={setIntent}>
                  <SelectTrigger id="cp-intent">
                    <SelectValue placeholder={t('subFeatures.carePlans.placeholders.intent')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('subFeatures.carePlans.none')}</SelectItem>
                    <SelectItem value="proposal">proposal</SelectItem>
                    <SelectItem value="plan">plan</SelectItem>
                    <SelectItem value="order">order</SelectItem>
                    <SelectItem value="option">option</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cp-startDate">{t('subFeatures.carePlans.fields.startDate')}</Label>
                  <Input
                    id="cp-startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cp-endDate">{t('subFeatures.carePlans.fields.endDate')}</Label>
                  <Input
                    id="cp-endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp-notes">{t('subFeatures.carePlans.fields.notes')}</Label>
                <RichTextEditor
                  id="cp-notes"
                  value={notes}
                  onChange={setNotes}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t('subFeatures.carePlans.cancel')}
                </Button>
                <Button type="submit">{t('subFeatures.carePlans.save')}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {carePlans.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('subFeatures.carePlans.noResults')}
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('subFeatures.carePlans.headers.title')}</TableHead>
                <TableHead>{t('subFeatures.carePlans.headers.status')}</TableHead>
                <TableHead>{t('subFeatures.carePlans.headers.intent')}</TableHead>
                <TableHead>{t('subFeatures.carePlans.headers.diagnosis')}</TableHead>
                <TableHead>{t('subFeatures.carePlans.headers.startDate')}</TableHead>
                <TableHead>{t('subFeatures.carePlans.headers.endDate')}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {carePlans.map((plan) => {
                const linkedDiagnosis = diagnoses?.find(
                  (d) => d.id === plan.diagnosisId,
                )
                return (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.title}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(plan.status)}>
                        {plan.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {plan.intent ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {linkedDiagnosis ? linkedDiagnosis.description : '—'}
                    </TableCell>
                    <TableCell>
                      {plan.startDate
                        ? format(parseISO(plan.startDate), 'MMM d, yyyy')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {plan.endDate
                        ? format(parseISO(plan.endDate), 'MMM d, yyyy')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setPendingDeleteId(plan.id)}
                      >
                        {t('subFeatures.common.delete')}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null) }}
        onConfirm={async () => {
          if (pendingDeleteId) {
            await dbDelete('carePlans', pendingDeleteId)
            setPendingDeleteId(null)
          }
        }}
      />
    </div>
  )
}

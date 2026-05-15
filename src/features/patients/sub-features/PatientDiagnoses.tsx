import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { db } from '@/lib/db'
import { dbPut, dbDelete } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface PatientDiagnosesProps {
  patientId: string
  visitId?: string | null
}

export function PatientDiagnoses({ patientId, visitId = null }: PatientDiagnosesProps) {
  const { t } = useTranslation('patient')
  const [open, setOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [icdCode, setIcdCode] = useState('')
  const [description, setDescription] = useState('')
  const [diagnosedBy, setDiagnosedBy] = useState('')
  const [diagnosedAt, setDiagnosedAt] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<string>('')
  const [onsetDate, setOnsetDate] = useState('')
  const [abatementDate, setAbatementDate] = useState('')

  const diagnoses = useLiveQuery(
    () =>
      db.diagnoses
        .where({ patientId })
        .filter((d) => !d._deleted && (!visitId || d.visitId === visitId))
        .toArray(),
    [patientId, visitId],
  )

  function resetForm() {
    setIcdCode('')
    setDescription('')
    setDiagnosedBy('')
    setDiagnosedAt('')
    setNotes('')
    setStatus('')
    setOnsetDate('')
    setAbatementDate('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description) return

    const orgId = useAuthStore.getState().orgId ?? ''
    await dbPut(
      'diagnoses',
      {
        id: crypto.randomUUID(),
        orgId,
        patientId,
        visitId: visitId ?? null,
        icdCode: icdCode || null,
        description,
        diagnosedBy: diagnosedBy || null,
        diagnosedAt: diagnosedAt ? new Date(diagnosedAt).toISOString() : null,
        notes: notes || null,
        status: status || null,
        onsetDate: onsetDate || null,
        abatementDate: abatementDate || null,
        deletedAt: null,
      },
      'insert',
    )
    resetForm()
    setOpen(false)
  }

  async function handleDelete(id: string) {
    await dbDelete('diagnoses', id)
    setPendingDeleteId(null)
  }

  if (diagnoses === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">{t('subFeatures.common.loading')}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{t('subFeatures.diagnoses.title')}</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">{t('subFeatures.diagnoses.newAction')}</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('subFeatures.diagnoses.newAction')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dx-icd">{t('subFeatures.diagnoses.fields.icdCode')}</Label>
                <Input
                  id="dx-icd"
                  value={icdCode}
                  onChange={(e) => setIcdCode(e.target.value)}
                  placeholder={t('subFeatures.diagnoses.placeholders.icdCode')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dx-desc">{t('subFeatures.diagnoses.fields.description')}</Label>
                <Textarea
                  id="dx-desc"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('subFeatures.diagnoses.placeholders.description')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dx-by">{t('subFeatures.diagnoses.fields.diagnosedBy')}</Label>
                <Input
                  id="dx-by"
                  value={diagnosedBy}
                  onChange={(e) => setDiagnosedBy(e.target.value)}
                  placeholder={t('subFeatures.diagnoses.placeholders.diagnosedBy')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dx-date">{t('subFeatures.diagnoses.fields.diagnosedAt')}</Label>
                <Input
                  id="dx-date"
                  type="date"
                  value={diagnosedAt}
                  onChange={(e) => setDiagnosedAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dx-notes">{t('subFeatures.diagnoses.fields.notes')}</Label>
                <Textarea
                  id="dx-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dx-status">{t('subFeatures.diagnoses.fields.status')}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="dx-status">
                    <SelectValue placeholder={t('subFeatures.diagnoses.placeholders.status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="recurrence">recurrence</SelectItem>
                    <SelectItem value="relapse">relapse</SelectItem>
                    <SelectItem value="inactive">inactive</SelectItem>
                    <SelectItem value="remission">remission</SelectItem>
                    <SelectItem value="resolved">resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dx-onset">{t('subFeatures.diagnoses.fields.onsetDate')}</Label>
                <Input
                  id="dx-onset"
                  type="date"
                  value={onsetDate}
                  onChange={(e) => setOnsetDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dx-abatement">{t('subFeatures.diagnoses.fields.abatementDate')}</Label>
                <Input
                  id="dx-abatement"
                  type="date"
                  value={abatementDate}
                  onChange={(e) => setAbatementDate(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                {t('subFeatures.diagnoses.create')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {diagnoses.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('subFeatures.diagnoses.noResults')}
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('subFeatures.diagnoses.fields.icdCode')}</TableHead>
                <TableHead>{t('subFeatures.diagnoses.fields.description')}</TableHead>
                <TableHead>{t('subFeatures.diagnoses.fields.diagnosedBy')}</TableHead>
                <TableHead>{t('subFeatures.diagnoses.fields.date')}</TableHead>
                <TableHead>{t('subFeatures.diagnoses.fields.status')}</TableHead>
                <TableHead>{t('subFeatures.diagnoses.fields.onsetDate')}</TableHead>
                <TableHead>{t('subFeatures.diagnoses.fields.abatementDate')}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {diagnoses.map((dx) => (
                <TableRow key={dx.id}>
                  <TableCell className="font-medium">
                    {dx.icdCode ?? '—'}
                  </TableCell>
                  <TableCell>{dx.description}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {dx.diagnosedBy ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dx.diagnosedAt
                      ? format(parseISO(dx.diagnosedAt), 'MMM d, yyyy')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {dx.status ? (
                      <Badge variant="secondary">{dx.status}</Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dx.onsetDate
                      ? format(parseISO(dx.onsetDate), 'MMM d, yyyy')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dx.abatementDate
                      ? format(parseISO(dx.abatementDate), 'MMM d, yyyy')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDeleteId(dx.id)}
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

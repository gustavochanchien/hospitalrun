import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { db } from '@/lib/db'
import { dbPut, dbDelete } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { usePermission } from '@/hooks/usePermission'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CodeSearchCombobox } from '@/components/code-search-combobox'

interface PatientImmunizationsProps {
  patientId: string
}

interface ImmunizationFormValues {
  vaccineCode: string
  vaccineName: string
  doseNumber: string
  lotNumber: string
  manufacturer: string
  administeredAt: string
  site: string
  route: string
  nextDueAt: string
  notes: string
}

const EMPTY_FORM: ImmunizationFormValues = {
  vaccineCode: '',
  vaccineName: '',
  doseNumber: '',
  lotNumber: '',
  manufacturer: '',
  administeredAt: '',
  site: '',
  route: '',
  nextDueAt: '',
  notes: '',
}

function nowLocalIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseInt10(value: string): number | null {
  if (value === '') return null
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : null
}

interface ValidationError {
  message: string
}

function validate(
  form: ImmunizationFormValues,
  t: (key: string) => string,
): ValidationError | null {
  if (!form.vaccineName.trim()) {
    return { message: t('errors.missingVaccineName') }
  }
  if (!form.administeredAt) {
    return { message: t('errors.missingAdministeredAt') }
  }
  if (form.doseNumber !== '') {
    const n = Number.parseInt(form.doseNumber, 10)
    if (!Number.isFinite(n) || n < 0) {
      return { message: t('errors.invalidDoseNumber') }
    }
  }
  if (form.nextDueAt && form.administeredAt) {
    if (new Date(form.nextDueAt) <= new Date(form.administeredAt)) {
      return { message: t('errors.nextDueBeforeAdministered') }
    }
  }
  return null
}

export function PatientImmunizations({ patientId }: PatientImmunizationsProps) {
  const { t } = useTranslation('immunizations')
  const canRead = usePermission('read:immunizations')
  const canWrite = usePermission('write:immunizations')

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ImmunizationFormValues>({
    ...EMPTY_FORM,
    administeredAt: nowLocalIso(),
  })
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const immunizations = useLiveQuery(
    () =>
      db.immunizations
        .where({ patientId })
        .filter((r) => !r._deleted)
        .toArray()
        .then((rows) => rows.sort((a, b) => b.administeredAt.localeCompare(a.administeredAt))),
    [patientId],
  )

  if (!canRead) {
    return (
      <p className="p-4 text-sm text-muted-foreground" role="status">
        {t('permissionDenied')}
      </p>
    )
  }

  if (immunizations === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">{t('loading')}</p>
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM, administeredAt: nowLocalIso() })
    setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate(form, (k) => t(k))
    if (err) {
      setFormError(err.message)
      return
    }
    const orgId = useAuthStore.getState().orgId ?? ''
    const userId = useAuthStore.getState().user?.id ?? null
    await dbPut(
      'immunizations',
      {
        id: crypto.randomUUID(),
        orgId,
        patientId,
        visitId: null,
        vaccineCode: form.vaccineCode || null,
        vaccineName: form.vaccineName.trim(),
        doseNumber: parseInt10(form.doseNumber),
        lotNumber: form.lotNumber || null,
        manufacturer: form.manufacturer || null,
        administeredAt: new Date(form.administeredAt).toISOString(),
        administeredBy: userId,
        site: form.site || null,
        route: form.route || null,
        nextDueAt: form.nextDueAt ? new Date(form.nextDueAt).toISOString() : null,
        notes: form.notes || null,
        deletedAt: null,
      },
      'insert',
    )
    resetForm()
    setOpen(false)
  }

  async function handleDelete(id: string) {
    await dbDelete('immunizations', id)
    setPendingDeleteId(null)
  }

  function update<K extends keyof ImmunizationFormValues>(
    key: K,
    value: ImmunizationFormValues[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{t('title')}</h3>
        {canWrite ? (
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o)
              if (!o) resetForm()
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">{t('newAction')}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{t('newAction')}</DialogTitle>
              </DialogHeader>
              <form noValidate onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="imm-code">{t('fields.vaccineCode')}</Label>
                  <CodeSearchCombobox
                    id="imm-code"
                    system="vaccine"
                    value={form.vaccineCode || null}
                    displayValue={form.vaccineName || undefined}
                    onChange={(code, display) => {
                      update('vaccineCode', code ?? '')
                      if (display) update('vaccineName', display)
                    }}
                    placeholder={t('codePicker.placeholder')}
                    noResultsLabel={t('codePicker.noResults')}
                    useAsIsLabel={
                      form.vaccineCode
                        ? t('codePicker.useAsIs', { code: form.vaccineCode })
                        : undefined
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imm-name">{t('fields.vaccineName')}</Label>
                  <Input
                    id="imm-name"
                    required
                    value={form.vaccineName}
                    onChange={(e) => update('vaccineName', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="imm-dose" className="text-xs">
                      {t('fields.doseNumber')}
                    </Label>
                    <Input
                      id="imm-dose"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={form.doseNumber}
                      onChange={(e) => update('doseNumber', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="imm-administered-at" className="text-xs">
                      {t('fields.administeredAt')}
                    </Label>
                    <Input
                      id="imm-administered-at"
                      type="datetime-local"
                      required
                      value={form.administeredAt}
                      onChange={(e) => update('administeredAt', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="imm-lot" className="text-xs">
                      {t('fields.lotNumber')}
                    </Label>
                    <Input
                      id="imm-lot"
                      value={form.lotNumber}
                      onChange={(e) => update('lotNumber', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="imm-manufacturer" className="text-xs">
                      {t('fields.manufacturer')}
                    </Label>
                    <Input
                      id="imm-manufacturer"
                      value={form.manufacturer}
                      onChange={(e) => update('manufacturer', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="imm-site" className="text-xs">
                      {t('fields.site')}
                    </Label>
                    <Input
                      id="imm-site"
                      value={form.site}
                      onChange={(e) => update('site', e.target.value)}
                      placeholder={t('placeholders.site')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="imm-route" className="text-xs">
                      {t('fields.route')}
                    </Label>
                    <Input
                      id="imm-route"
                      value={form.route}
                      onChange={(e) => update('route', e.target.value)}
                      placeholder={t('placeholders.route')}
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="imm-next-due" className="text-xs">
                      {t('fields.nextDueAt')}
                    </Label>
                    <Input
                      id="imm-next-due"
                      type="date"
                      value={form.nextDueAt}
                      onChange={(e) => update('nextDueAt', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imm-notes">{t('fields.notes')}</Label>
                  <Textarea
                    id="imm-notes"
                    value={form.notes}
                    onChange={(e) => update('notes', e.target.value)}
                    rows={2}
                  />
                </div>
                {formError && (
                  <p role="alert" className="text-sm text-destructive">
                    {formError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    {t('cancel')}
                  </Button>
                  <Button type="submit">{t('save')}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {immunizations.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('noResults')}</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('fields.vaccine')}</TableHead>
                <TableHead>{t('fields.doseNumber')}</TableHead>
                <TableHead>{t('fields.administeredAt')}</TableHead>
                <TableHead>{t('fields.lotNumber')}</TableHead>
                <TableHead>{t('fields.nextDueAt')}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {immunizations.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.vaccineCode ? (
                      <span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {r.vaccineCode}
                        </span>
                        <span className="ml-2">{r.vaccineName}</span>
                      </span>
                    ) : (
                      r.vaccineName
                    )}
                  </TableCell>
                  <TableCell>{r.doseNumber ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(parseISO(r.administeredAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.lotNumber ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.nextDueAt ? format(parseISO(r.nextDueAt), 'MMM d, yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    {canWrite && (
                      <Button variant="ghost" size="sm" onClick={() => setPendingDeleteId(r.id)}>
                        {t('delete')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingDeleteId(null)
        }}
        title={t('confirmDelete.title')}
        description={t('confirmDelete.description')}
        onConfirm={() => {
          if (pendingDeleteId) void handleDelete(pendingDeleteId)
        }}
      />
    </div>
  )
}

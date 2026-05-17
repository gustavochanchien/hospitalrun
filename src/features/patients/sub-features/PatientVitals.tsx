import { useMemo, useState } from 'react'
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
import type { Vital } from '@/lib/db/schema'
import { GrowthChartCard } from './vitals/GrowthChartCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TrendChart } from '@/components/trend-chart'
import {
  VITAL_FIELD_KEYS,
  VITAL_FIELD_LABEL_KEY,
  vitalSeriesOptionId,
  buildSeriesFromSelection,
  buildSeriesOptions,
  type VitalFieldKey,
} from './trends/trend-data'

interface PatientVitalsProps {
  patientId: string
}

interface VitalsFormValues {
  recordedAt: string
  heightCm: string
  weightKg: string
  temperatureC: string
  heartRate: string
  respiratoryRate: string
  systolic: string
  diastolic: string
  oxygenSat: string
  painScale: string
  headCircumferenceCm: string
  notes: string
}

const EMPTY_FORM: VitalsFormValues = {
  recordedAt: '',
  heightCm: '',
  weightKg: '',
  temperatureC: '',
  heartRate: '',
  respiratoryRate: '',
  systolic: '',
  diastolic: '',
  oxygenSat: '',
  painScale: '',
  headCircumferenceCm: '',
  notes: '',
}

function nowLocalIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseNumeric(value: string): number | null {
  if (value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function parseInt10(value: string): number | null {
  if (value === '') return null
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : null
}

interface ValidationError {
  message: string
}

function validate(form: VitalsFormValues, t: (key: string) => string): ValidationError | null {
  if (!form.recordedAt) {
    return { message: t('errors.missingRecordedAt') }
  }

  const measurementFields = [
    form.heightCm,
    form.weightKg,
    form.temperatureC,
    form.heartRate,
    form.respiratoryRate,
    form.systolic,
    form.diastolic,
    form.oxygenSat,
    form.painScale,
    form.headCircumferenceCm,
  ]
  const filled = measurementFields.filter((v) => v !== '')
  if (filled.length === 0) {
    return { message: t('errors.atLeastOneValue') }
  }

  for (const v of measurementFields) {
    if (v === '') continue
    if (!Number.isFinite(Number(v))) {
      return { message: t('errors.invalidNumber') }
    }
  }

  const oxy = parseNumeric(form.oxygenSat)
  if (oxy !== null && (oxy < 0 || oxy > 100)) {
    return { message: t('errors.outOfRange') }
  }
  const pain = parseNumeric(form.painScale)
  if (pain !== null && (pain < 0 || pain > 10)) {
    return { message: t('errors.outOfRange') }
  }

  const sys = parseNumeric(form.systolic)
  const dia = parseNumeric(form.diastolic)
  if ((sys === null) !== (dia === null)) {
    return { message: t('errors.bloodPressurePartial') }
  }
  if (sys !== null && dia !== null && dia >= sys) {
    return { message: t('errors.diastolicAboveSystolic') }
  }

  return null
}

export function PatientVitals({ patientId }: PatientVitalsProps) {
  const { t } = useTranslation('vitals')
  const canRead = usePermission('read:vitals')
  const canWrite = usePermission('write:vitals')

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<VitalsFormValues>({ ...EMPTY_FORM, recordedAt: nowLocalIso() })
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [view, setView] = useState<'table' | 'chart'>('table')
  const [chartMetric, setChartMetric] = useState<VitalFieldKey>('heartRate')

  const patient = useLiveQuery(() => db.patients.get(patientId), [patientId])
  const vitals = useLiveQuery(
    () =>
      db.vitals
        .where({ patientId })
        .filter((v) => !v._deleted)
        .toArray()
        .then((rows) => rows.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))),
    [patientId],
  )

  const ascendingVitals = useMemo<Vital[]>(() => {
    if (!vitals) return []
    return [...vitals].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
  }, [vitals])

  const chartFieldsAvailable = useMemo<VitalFieldKey[]>(() => {
    if (!vitals) return []
    return VITAL_FIELD_KEYS.filter((field) =>
      vitals.some((v) => {
        const raw = v[field]
        return typeof raw === 'number' && Number.isFinite(raw)
      }),
    )
  }, [vitals])

  const activeChartField: VitalFieldKey | null = useMemo(() => {
    if (chartFieldsAvailable.length === 0) return null
    return chartFieldsAvailable.includes(chartMetric) ? chartMetric : chartFieldsAvailable[0]
  }, [chartFieldsAvailable, chartMetric])

  const chartSeries = useMemo(() => {
    if (!activeChartField) return []
    const options = buildSeriesOptions(ascendingVitals, [], (f) => t(VITAL_FIELD_LABEL_KEY[f]))
    return buildSeriesFromSelection(
      [vitalSeriesOptionId(activeChartField)],
      ascendingVitals,
      [],
      options,
    )
  }, [activeChartField, ascendingVitals, t])

  if (!canRead) {
    return (
      <p className="p-4 text-sm text-muted-foreground" role="status">
        {t('permissionDenied')}
      </p>
    )
  }

  if (vitals === undefined || patient === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">{t('loading')}</p>
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM, recordedAt: nowLocalIso() })
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
      'vitals',
      {
        id: crypto.randomUUID(),
        orgId,
        patientId,
        visitId: null,
        recordedAt: new Date(form.recordedAt).toISOString(),
        recordedBy: userId,
        heightCm: parseNumeric(form.heightCm),
        weightKg: parseNumeric(form.weightKg),
        temperatureC: parseNumeric(form.temperatureC),
        heartRate: parseInt10(form.heartRate),
        respiratoryRate: parseInt10(form.respiratoryRate),
        systolic: parseInt10(form.systolic),
        diastolic: parseInt10(form.diastolic),
        oxygenSat: parseInt10(form.oxygenSat),
        painScale: parseInt10(form.painScale),
        headCircumferenceCm: parseNumeric(form.headCircumferenceCm),
        notes: form.notes || null,
        deletedAt: null,
      },
      'insert',
    )
    resetForm()
    setOpen(false)
  }

  async function handleDelete(id: string) {
    await dbDelete('vitals', id)
    setPendingDeleteId(null)
  }

  function update<K extends keyof VitalsFormValues>(key: K, value: VitalsFormValues[K]) {
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
                  <Label htmlFor="vitals-recorded-at">{t('fields.recordedAt')}</Label>
                  <Input
                    id="vitals-recorded-at"
                    type="datetime-local"
                    required
                    value={form.recordedAt}
                    onChange={(e) => update('recordedAt', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField id="vitals-height" label={`${t('fields.height')} (${t('units.cm')})`} value={form.heightCm} onChange={(v) => update('heightCm', v)} step="0.1" />
                  <NumberField id="vitals-weight" label={`${t('fields.weight')} (${t('units.kg')})`} value={form.weightKg} onChange={(v) => update('weightKg', v)} step="0.01" />
                  <NumberField id="vitals-temp" label={`${t('fields.temperature')} (${t('units.celsius')})`} value={form.temperatureC} onChange={(v) => update('temperatureC', v)} step="0.1" />
                  <NumberField id="vitals-heart" label={`${t('fields.heartRate')} (${t('units.bpm')})`} value={form.heartRate} onChange={(v) => update('heartRate', v)} step="1" />
                  <NumberField id="vitals-resp" label={`${t('fields.respiratoryRate')} (${t('units.rpm')})`} value={form.respiratoryRate} onChange={(v) => update('respiratoryRate', v)} step="1" />
                  <NumberField id="vitals-oxy" label={`${t('fields.oxygenSat')} (${t('units.percent')})`} value={form.oxygenSat} onChange={(v) => update('oxygenSat', v)} step="1" min="0" max="100" />
                  <NumberField id="vitals-systolic" label={`${t('fields.systolic')} (${t('units.mmHg')})`} value={form.systolic} onChange={(v) => update('systolic', v)} step="1" />
                  <NumberField id="vitals-diastolic" label={`${t('fields.diastolic')} (${t('units.mmHg')})`} value={form.diastolic} onChange={(v) => update('diastolic', v)} step="1" />
                  <NumberField id="vitals-pain" label={t('fields.painScale')} value={form.painScale} onChange={(v) => update('painScale', v)} step="1" min="0" max="10" />
                  <NumberField id="vitals-head" label={`${t('fields.headCircumference')} (${t('units.cm')})`} value={form.headCircumferenceCm} onChange={(v) => update('headCircumferenceCm', v)} step="0.1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vitals-notes">{t('fields.notes')}</Label>
                  <Textarea
                    id="vitals-notes"
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

      {patient && <GrowthChartCard patient={patient} vitals={ascendingVitals} />}

      {vitals.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('view.label')}</span>
          <Button
            size="sm"
            variant={view === 'table' ? 'default' : 'outline'}
            onClick={() => setView('table')}
          >
            {t('view.table')}
          </Button>
          <Button
            size="sm"
            variant={view === 'chart' ? 'default' : 'outline'}
            disabled={chartFieldsAvailable.length === 0}
            onClick={() => setView('chart')}
          >
            {t('view.chart')}
          </Button>
          {view === 'chart' && activeChartField && (
            <Select
              value={activeChartField}
              onValueChange={(v) => setChartMetric(v as VitalFieldKey)}
            >
              <SelectTrigger className="ml-auto w-[220px]" aria-label={t('view.chart')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chartFieldsAvailable.map((field) => (
                  <SelectItem key={field} value={field}>
                    {t(VITAL_FIELD_LABEL_KEY[field])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {vitals.length > 0 && view === 'chart' && chartSeries.length > 0 && (
        <Card data-testid="vitals-chart-card">
          <CardHeader>
            <CardTitle className="text-base">
              {activeChartField ? t(VITAL_FIELD_LABEL_KEY[activeChartField]) : t('view.chart')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart series={chartSeries} />
          </CardContent>
        </Card>
      )}

      {vitals.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('noResults')}</p>
      ) : view === 'chart' ? null : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('fields.recordedAt')}</TableHead>
                <TableHead>{t('fields.height')}</TableHead>
                <TableHead>{t('fields.weight')}</TableHead>
                <TableHead>{t('fields.temperature')}</TableHead>
                <TableHead>{t('fields.heartRate')}</TableHead>
                <TableHead>{t('fields.bloodPressure')}</TableHead>
                <TableHead>{t('fields.oxygenSat')}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {vitals.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">
                    {format(parseISO(v.recordedAt), 'MMM d, yyyy h:mm a')}
                  </TableCell>
                  <TableCell>{formatValue(v.heightCm, t('units.cm'))}</TableCell>
                  <TableCell>{formatValue(v.weightKg, t('units.kg'))}</TableCell>
                  <TableCell>{formatValue(v.temperatureC, t('units.celsius'))}</TableCell>
                  <TableCell>{formatValue(v.heartRate, t('units.bpm'))}</TableCell>
                  <TableCell>
                    {v.systolic != null && v.diastolic != null
                      ? `${v.systolic}/${v.diastolic} ${t('units.mmHg')}`
                      : '—'}
                  </TableCell>
                  <TableCell>{formatValue(v.oxygenSat, t('units.percent'))}</TableCell>
                  <TableCell>
                    {canWrite && (
                      <Button variant="ghost" size="sm" onClick={() => setPendingDeleteId(v.id)}>
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

function formatValue(value: number | null, unit: string): string {
  if (value === null || value === undefined) return '—'
  return `${value} ${unit}`
}

interface NumberFieldProps {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  step?: string
  min?: string
  max?: string
}

function NumberField({ id, label, value, onChange, step, min, max }: NumberFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={step}
        min={min}
        max={max}
      />
    </div>
  )
}

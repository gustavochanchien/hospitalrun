import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { db } from '@/lib/db'
import { invoiceFormSchema, type InvoiceFormValues } from './invoice.schema'

export type { InvoiceFormValues }

interface InvoiceFormProps {
  defaultValues?: Partial<InvoiceFormValues>
  onSubmit: (data: InvoiceFormValues) => Promise<void> | void
}

export function InvoiceForm({ defaultValues, onSubmit }: InvoiceFormProps) {
  const { t } = useTranslation('billing')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      patientId: defaultValues?.patientId ?? '',
      visitId: defaultValues?.visitId ?? null,
      notes: defaultValues?.notes ?? null,
    },
  })

  const [patientSearch, setPatientSearch] = useState('')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [selectedPatientName, setSelectedPatientName] = useState('')
  const triggerRef = useRef<HTMLDivElement>(null)

  const selectedPatientId = watch('patientId')
  const selectedVisitId = watch('visitId')

  const patients = useLiveQuery(
    () => db.patients.filter((p) => !p._deleted).toArray(),
    [],
  )

  const visits = useLiveQuery(
    () =>
      selectedPatientId
        ? db.visits
            .where('patientId')
            .equals(selectedPatientId)
            .filter((v) => !v._deleted)
            .toArray()
        : [],
    [selectedPatientId],
  )

  useLiveQuery(async () => {
    if (defaultValues?.patientId && !selectedPatientName) {
      const patient = await db.patients.get(defaultValues.patientId)
      if (patient) {
        setSelectedPatientName(`${patient.givenName} ${patient.familyName}`)
      }
    }
    return null
  }, [defaultValues?.patientId])

  const filteredPatients = useMemo(() => {
    if (!patients) return []
    if (!patientSearch) return patients.slice(0, 10)
    const lower = patientSearch.toLowerCase()
    return patients
      .filter((p) => {
        const fullName = `${p.givenName} ${p.familyName}`.toLowerCase()
        return fullName.includes(lower)
      })
      .slice(0, 10)
  }, [patients, patientSearch])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <Label>{t('form.patient')} *</Label>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <div ref={triggerRef}>
              <Input
                placeholder={t('form.searchPatient')}
                value={popoverOpen ? patientSearch : selectedPatientName || patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value)
                  if (!popoverOpen) setPopoverOpen(true)
                  if (selectedPatientId) {
                    setValue('patientId', '', { shouldValidate: true })
                    setSelectedPatientName('')
                  }
                }}
                onFocus={() => setPopoverOpen(true)}
              />
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {filteredPatients.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                {t('form.noPatients')}
              </p>
            ) : (
              <ul className="max-h-60 overflow-y-auto">
                {filteredPatients.map((patient) => (
                  <li key={patient.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                      onClick={() => {
                        const name = `${patient.givenName} ${patient.familyName}`
                        setValue('patientId', patient.id, { shouldValidate: true })
                        setSelectedPatientName(name)
                        setPatientSearch('')
                        setPopoverOpen(false)
                      }}
                    >
                      {patient.givenName} {patient.familyName}
                      {patient.mrn && (
                        <span className="ml-2 text-muted-foreground">
                          MRN: {patient.mrn}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
        <input type="hidden" {...register('patientId')} />
        {errors.patientId?.message && (
          <p className="text-sm text-destructive">
            {t(errors.patientId.message as 'validation.patientRequired')}
          </p>
        )}
      </div>

      {selectedPatientId && visits && visits.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="invoice-visit">{t('form.visit')}</Label>
          <Select
            value={selectedVisitId ?? 'none'}
            onValueChange={(v) => setValue('visitId', v === 'none' ? null : v)}
          >
            <SelectTrigger id="invoice-visit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('form.noVisit')}</SelectItem>
              {visits.map((visit) => (
                <SelectItem key={visit.id} value={visit.id}>
                  {visit.type ?? t('form.visitFallback')}
                  {visit.startDatetime
                    ? ` — ${new Date(visit.startDatetime).toLocaleDateString()}`
                    : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="invoice-notes">{t('form.notes')}</Label>
        <Textarea id="invoice-notes" {...register('notes')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('form.saving') : t('form.submit')}
      </Button>
    </form>
  )
}

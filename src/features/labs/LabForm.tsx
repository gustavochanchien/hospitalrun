import { useState, useMemo, useRef } from 'react'
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
import { db } from '@/lib/db'
import { labFormSchema, type LabFormValues } from './lab.schema'

interface LabFormProps {
  defaultValues?: Partial<LabFormValues>
  onSubmit: (data: LabFormValues) => Promise<void>
}

export function LabForm({ defaultValues, onSubmit }: LabFormProps) {
  const { t } = useTranslation('labs')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LabFormValues>({
    resolver: zodResolver(labFormSchema),
    defaultValues: {
      patientId: '',
      type: '',
      code: '',
      notes: '',
      ...defaultValues,
    },
  })

  const [patientSearch, setPatientSearch] = useState('')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [selectedPatientName, setSelectedPatientName] = useState('')
  const triggerRef = useRef<HTMLDivElement>(null)

  const selectedPatientId = watch('patientId')

  const patients = useLiveQuery(
    () => db.patients.filter((p) => !p._deleted).toArray(),
    [],
  )

  // If we have a default patientId, resolve the name
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
      {/* Patient Picker */}
      <div className="space-y-2">
        <Label>{t('fields.patient')} *</Label>
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

      {/* Type */}
      <div className="space-y-2">
        <Label htmlFor="type">{t('form.labType')} *</Label>
        <Input
          id="type"
          placeholder={t('form.labTypePlaceholder')}
          {...register('type')}
        />
        {errors.type?.message && (
          <p className="text-sm text-destructive">{t(errors.type.message as 'validation.typeRequired')}</p>
        )}
      </div>

      {/* Code */}
      <div className="space-y-2">
        <Label htmlFor="code">{t('fields.code')}</Label>
        <Input
          id="code"
          placeholder={t('form.codePlaceholder')}
          {...register('code')}
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">{t('fields.notes')}</Label>
        <Textarea
          id="notes"
          placeholder={t('form.notesPlaceholder')}
          {...register('notes')}
        />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('form.saving') : t('form.request')}
      </Button>
    </form>
  )
}

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { db } from '@/lib/db'
import { imagingFormSchema, type ImagingFormValues } from './imaging.schema'

interface ImagingFormProps {
  defaultValues?: Partial<ImagingFormValues>
  onSubmit: (data: ImagingFormValues) => Promise<void>
}

export function ImagingForm({ defaultValues, onSubmit }: ImagingFormProps) {
  const { t } = useTranslation('imaging')
  const [patientSearch, setPatientSearch] = useState('')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [selectedPatientName, setSelectedPatientName] = useState('')

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ImagingFormValues>({
    resolver: zodResolver(imagingFormSchema),
    defaultValues: {
      patientId: '',
      type: '',
      code: '',
      notes: '',
      ...defaultValues,
    },
  })

  const patients = useLiveQuery(
    () => db.patients.filter((p) => !p._deleted).toArray(),
    [],
  )

  const filteredPatients = (patients ?? []).filter((p) => {
    if (!patientSearch) return true
    const name = `${p.givenName} ${p.familyName}`.toLowerCase()
    return name.includes(patientSearch.toLowerCase())
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <div className="space-y-4">
        {/* Patient picker */}
        <div className="space-y-2">
          <Label>{t('fields.patient')} *</Label>
          <input type="hidden" {...register('patientId')} />
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start font-normal"
              >
                {selectedPatientName || t('form.selectPatient')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <div className="p-2">
                <Input
                  placeholder={t('form.searchPatients')}
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {filteredPatients.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                    {t('form.noPatients')}
                  </p>
                ) : (
                  filteredPatients.slice(0, 50).map((p) => {
                    const name = `${p.givenName} ${p.familyName}`
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className="flex w-full items-center px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                        onClick={() => {
                          setValue('patientId', p.id, { shouldValidate: true })
                          setSelectedPatientName(name)
                          setPatientSearch('')
                          setPopoverOpen(false)
                        }}
                      >
                        {name}
                      </button>
                    )
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
          {errors.patientId?.message && (
            <p className="text-sm text-destructive">
              {t(errors.patientId.message as 'validation.patientRequired')}
            </p>
          )}
        </div>

        {/* Type */}
        <div className="space-y-2">
          <Label htmlFor="type">{t('fields.type')} *</Label>
          <Input
            id="type"
            placeholder={t('form.typePlaceholder')}
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
            rows={4}
            {...register('notes')}
          />
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('form.saving') : t('form.request')}
      </Button>
    </form>
  )
}

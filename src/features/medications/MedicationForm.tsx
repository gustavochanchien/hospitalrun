import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { db } from '@/lib/db'
import {
  medicationFormSchema,
  MEDICATION_STATUSES,
  MEDICATION_INTENTS,
  MEDICATION_PRIORITIES,
  type MedicationFormValues,
} from './medication.schema'
import type { Medication } from '@/lib/db/schema'

type MedicationStatus = (typeof MEDICATION_STATUSES)[number]
type MedicationIntent = (typeof MEDICATION_INTENTS)[number]
type MedicationPriority = (typeof MEDICATION_PRIORITIES)[number]

const STATUS_KEY: Record<MedicationStatus, string> = {
  draft: 'draft',
  active: 'active',
  'on hold': 'onHold',
  canceled: 'canceled',
  completed: 'completed',
  'entered in error': 'enteredInError',
  stopped: 'stopped',
  unknown: 'unknown',
}

const INTENT_KEY: Record<MedicationIntent, string> = {
  proposal: 'proposal',
  plan: 'plan',
  order: 'order',
  'original order': 'originalOrder',
  'reflex order': 'reflexOrder',
  'filler order': 'fillerOrder',
  'instance order': 'instanceOrder',
  option: 'option',
}

const PRIORITY_KEY: Record<MedicationPriority, string> = {
  routine: 'routine',
  urgent: 'urgent',
  asap: 'asap',
  stat: 'stat',
}

interface MedicationFormProps {
  defaultValues?: Partial<MedicationFormValues>
  onSubmit: (data: MedicationFormValues) => Promise<void>
  medication?: Medication
}

export function MedicationForm({
  defaultValues,
  onSubmit,
  medication,
}: MedicationFormProps) {
  const { t } = useTranslation('medications')
  const [patientSearch, setPatientSearch] = useState('')
  const [patientPopoverOpen, setPatientPopoverOpen] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationFormSchema),
    defaultValues: {
      patientId: '',
      name: '',
      status: 'draft',
      intent: undefined,
      priority: undefined,
      quantity: '',
      startDate: '',
      endDate: '',
      notes: '',
      ...defaultValues,
    },
  })

  const patientId = watch('patientId')
  const status = watch('status')

  const patients = useLiveQuery(
    () => db.patients.filter((p) => !p._deleted).toArray(),
    [],
  )

  const selectedPatient = patients?.find((p) => p.id === patientId)

  const filteredPatients = (patients ?? []).filter((p) => {
    if (!patientSearch) return true
    const fullName = `${p.givenName} ${p.familyName}`.toLowerCase()
    return fullName.includes(patientSearch.toLowerCase())
  })

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data as MedicationFormValues))} className="max-w-2xl space-y-6">
      {/* Patient Picker */}
      <div className="space-y-2">
        <Label>{t('fields.patient')} *</Label>
        <Popover open={patientPopoverOpen} onOpenChange={setPatientPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start font-normal"
            >
              {selectedPatient
                ? `${selectedPatient.givenName} ${selectedPatient.familyName}`
                : t('form.selectPatient')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2" align="start">
            <Input
              placeholder={t('form.searchPatients')}
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-60 overflow-y-auto">
              {filteredPatients.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t('form.noPatients')}
                </p>
              ) : (
                filteredPatients.slice(0, 50).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      setValue('patientId', p.id, { shouldValidate: true })
                      setPatientPopoverOpen(false)
                      setPatientSearch('')
                    }}
                  >
                    {p.givenName} {p.familyName}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
        {errors.patientId?.message && (
          <p className="text-sm text-destructive">{t(errors.patientId.message as 'validation.patientRequired')}</p>
        )}
      </div>

      {/* Medication Name */}
      <div className="space-y-2">
        <Label htmlFor="name">{t('fields.name')} *</Label>
        <Input
          id="name"
          placeholder={t('form.namePlaceholder')}
          {...register('name')}
        />
        {errors.name?.message && (
          <p className="text-sm text-destructive">{t(errors.name.message as 'validation.nameRequired')}</p>
        )}
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label htmlFor="status">{t('fields.status')}</Label>
        <Select
          value={status}
          onValueChange={(v) =>
            setValue('status', v as MedicationFormValues['status'], {
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger id="status">
            <SelectValue placeholder={t('form.selectStatus')} />
          </SelectTrigger>
          <SelectContent>
            {MEDICATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`statusOption.${STATUS_KEY[s]}` as `statusOption.${string}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.status && (
          <p className="text-sm text-destructive">{errors.status.message}</p>
        )}
      </div>

      {/* Intent & Priority */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="intent">{t('fields.intent')}</Label>
          <Select
            value={watch('intent') ?? ''}
            onValueChange={(v) =>
              setValue('intent', v as MedicationFormValues['intent'], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger id="intent">
              <SelectValue placeholder={t('form.selectIntent')} />
            </SelectTrigger>
            <SelectContent>
              {MEDICATION_INTENTS.map((i) => (
                <SelectItem key={i} value={i}>
                  {t(`intentOption.${INTENT_KEY[i]}` as `intentOption.${string}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">{t('fields.priority')}</Label>
          <Select
            value={watch('priority') ?? ''}
            onValueChange={(v) =>
              setValue('priority', v as MedicationFormValues['priority'], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger id="priority">
              <SelectValue placeholder={t('form.selectPriority')} />
            </SelectTrigger>
            <SelectContent>
              {MEDICATION_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`priorityOption.${PRIORITY_KEY[p]}` as `priorityOption.${string}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quantity */}
      <div className="space-y-2">
        <Label htmlFor="quantity">{t('fields.quantity')}</Label>
        <Input
          id="quantity"
          placeholder={t('form.quantityPlaceholder')}
          {...register('quantity')}
        />
      </div>

      {/* Dates */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">{t('fields.startDate')}</Label>
          <Input id="startDate" type="date" {...register('startDate')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">{t('fields.endDate')}</Label>
          <Input id="endDate" type="date" {...register('endDate')} />
        </div>
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
        {isSubmitting
          ? t('form.saving')
          : medication
            ? t('form.update')
            : t('form.create')}
      </Button>
    </form>
  )
}

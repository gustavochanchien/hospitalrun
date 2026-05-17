import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { PatientPicker } from '@/components/patient-picker'
import type { Appointment } from '@/lib/db/schema'
import {
  APPOINTMENT_TYPES,
  appointmentFormSchema,
  type AppointmentFormValues,
} from './appointment.schema'

type AppointmentType = (typeof APPOINTMENT_TYPES)[number]
const TYPE_KEY: Record<AppointmentType, string> = {
  checkup: 'checkup',
  emergency: 'emergency',
  'follow up': 'followUp',
  routine: 'routine',
  'walk in': 'walkIn',
}

interface AppointmentFormProps {
  defaultValues?: Partial<AppointmentFormValues>
  onSubmit: (data: AppointmentFormValues) => Promise<void>
  appointment?: Appointment
}

export function AppointmentForm({
  defaultValues,
  onSubmit,
  appointment,
}: AppointmentFormProps) {
  const { t } = useTranslation('scheduling')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      patientId: '',
      type: undefined,
      startTime: '',
      endTime: '',
      location: '',
      reason: '',
      notes: '',
      ...defaultValues,
    },
  })

  const selectedPatientId = watch('patientId')

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data as AppointmentFormValues))} className="max-w-2xl space-y-6">
      {/* Patient Picker */}
      <div className="space-y-2">
        <Label htmlFor="appointment-patient">{t('fields.patient')} *</Label>
        <input type="hidden" {...register('patientId')} />
        <PatientPicker
          id="appointment-patient"
          value={selectedPatientId}
          onChange={(p) =>
            setValue('patientId', p?.id ?? '', { shouldValidate: true })
          }
          placeholder={t('form.selectPatient')}
          searchPlaceholder={t('form.searchPatients')}
          noResultsLabel={t('form.noPatients')}
        />
        {errors.patientId?.message && (
          <p className="text-sm text-destructive">
            {t(errors.patientId.message as 'validation.patientRequired')}
          </p>
        )}
      </div>

      {/* Type */}
      <div className="space-y-2">
        <Label htmlFor="type">{t('fields.type')}</Label>
        <Select
          value={watch('type') ?? ''}
          onValueChange={(v) =>
            setValue('type', v as (typeof APPOINTMENT_TYPES)[number], {
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger id="type">
            <SelectValue placeholder={t('form.selectType')} />
          </SelectTrigger>
          <SelectContent>
            {APPOINTMENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`types.${TYPE_KEY[type]}` as `types.${string}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Start / End Time */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startTime">{t('fields.startTime')} *</Label>
          <Input
            id="startTime"
            type="datetime-local"
            {...register('startTime')}
          />
          {errors.startTime?.message && (
            <p className="text-sm text-destructive">
              {t(errors.startTime.message as 'validation.startTimeRequired')}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="endTime">{t('fields.endTime')} *</Label>
          <Input
            id="endTime"
            type="datetime-local"
            {...register('endTime')}
          />
          {errors.endTime?.message && (
            <p className="text-sm text-destructive">
              {t(errors.endTime.message as 'validation.endTimeRequired')}
            </p>
          )}
        </div>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label htmlFor="location">{t('fields.location')}</Label>
        <Input
          id="location"
          placeholder={t('form.locationPlaceholder')}
          {...register('location')}
        />
      </div>

      {/* Reason */}
      <div className="space-y-2">
        <Label htmlFor="reason">{t('fields.reasonForVisit')}</Label>
        <Textarea id="reason" {...register('reason')} />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">{t('fields.notes')}</Label>
        <Textarea id="notes" {...register('notes')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? t('form.saving')
          : appointment
            ? t('form.update')
            : t('form.create')}
      </Button>
    </form>
  )
}

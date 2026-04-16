import { useState, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLiveQuery } from 'dexie-react-hooks'
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
import type { Appointment } from '@/lib/db/schema'
import {
  APPOINTMENT_TYPES,
  appointmentFormSchema,
  type AppointmentFormValues,
} from './appointment.schema'

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

  const [patientSearch, setPatientSearch] = useState('')
  const [patientDisplayName, setPatientDisplayName] = useState('')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedPatientId = watch('patientId')

  const allPatients = useLiveQuery(
    () => db.patients.filter((p) => !p._deleted).toArray(),
    [],
  )

  // Set initial display name when editing an existing appointment
  const initialPatient = useLiveQuery(
    () => {
      const id = defaultValues?.patientId
      if (!id) return undefined
      return db.patients.get(id)
    },
    [defaultValues?.patientId],
  )

  if (initialPatient && !patientDisplayName && selectedPatientId) {
    setPatientDisplayName(
      `${initialPatient.givenName} ${initialPatient.familyName}`,
    )
  }

  const filteredPatients = useMemo(() => {
    if (!allPatients) return []
    if (!patientSearch) return allPatients.slice(0, 10)
    const lower = patientSearch.toLowerCase()
    return allPatients
      .filter((p) => {
        const name = `${p.givenName} ${p.familyName}`.toLowerCase()
        return name.includes(lower)
      })
      .slice(0, 10)
  }, [allPatients, patientSearch])

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data as AppointmentFormValues))} className="max-w-2xl space-y-6">
      {/* Patient Picker */}
      <div className="space-y-2">
        <Label>Patient *</Label>
        <input type="hidden" {...register('patientId')} />
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start font-normal"
              onClick={() => setPopoverOpen(true)}
            >
              {patientDisplayName || 'Select a patient...'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-2">
              <Input
                ref={inputRef}
                placeholder="Search patients..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filteredPatients.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No patients found.
                </p>
              ) : (
                filteredPatients.map((p) => {
                  const name = `${p.givenName} ${p.familyName}`
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                      onClick={() => {
                        setValue('patientId', p.id, { shouldValidate: true })
                        setPatientDisplayName(name)
                        setPatientSearch('')
                        setPopoverOpen(false)
                      }}
                    >
                      <span className="font-medium">{name}</span>
                      {p.mrn && (
                        <span className="text-muted-foreground">
                          MRN: {p.mrn}
                        </span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </PopoverContent>
        </Popover>
        {errors.patientId && (
          <p className="text-sm text-destructive">
            {errors.patientId.message}
          </p>
        )}
      </div>

      {/* Type */}
      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <Select
          value={watch('type') ?? ''}
          onValueChange={(v) =>
            setValue('type', v as (typeof APPOINTMENT_TYPES)[number], {
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger id="type">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {APPOINTMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Start / End Time */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startTime">Start Time *</Label>
          <Input
            id="startTime"
            type="datetime-local"
            {...register('startTime')}
          />
          {errors.startTime && (
            <p className="text-sm text-destructive">
              {errors.startTime.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="endTime">End Time *</Label>
          <Input
            id="endTime"
            type="datetime-local"
            {...register('endTime')}
          />
          {errors.endTime && (
            <p className="text-sm text-destructive">
              {errors.endTime.message}
            </p>
          )}
        </div>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          placeholder="e.g. Room 204"
          {...register('location')}
        />
      </div>

      {/* Reason */}
      <div className="space-y-2">
        <Label htmlFor="reason">Reason for Visit</Label>
        <Textarea id="reason" {...register('reason')} />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" {...register('notes')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? 'Saving...'
          : appointment
            ? 'Update Appointment'
            : 'Create Appointment'}
      </Button>
    </form>
  )
}

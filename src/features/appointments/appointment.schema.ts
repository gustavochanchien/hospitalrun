import { z } from 'zod'

export const APPOINTMENT_TYPES = [
  'checkup',
  'emergency',
  'follow up',
  'routine',
  'walk in',
] as const

export const appointmentFormSchema = z
  .object({
    patientId: z.string().min(1, 'validation.patientRequired'),
    type: z.enum(APPOINTMENT_TYPES).optional(),
    startTime: z.string().min(1, 'validation.startTimeRequired'),
    endTime: z.string().min(1, 'validation.endTimeRequired'),
    location: z.string().optional().or(z.literal('')),
    reason: z.string().optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'validation.endTimeAfterStart',
    path: ['endTime'],
  })

export type AppointmentFormValues = z.infer<typeof appointmentFormSchema>

import { z } from 'zod'

export const MEDICATION_STATUSES = [
  'draft',
  'active',
  'on hold',
  'canceled',
  'completed',
  'entered in error',
  'stopped',
  'unknown',
] as const

export type MedicationStatus = (typeof MEDICATION_STATUSES)[number]

export const MEDICATION_INTENTS = [
  'proposal',
  'plan',
  'order',
  'original order',
  'reflex order',
  'filler order',
  'instance order',
  'option',
] as const

export const MEDICATION_PRIORITIES = [
  'routine',
  'urgent',
  'asap',
  'stat',
] as const

export const medicationFormSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  name: z.string().min(1, 'Medication name is required'),
  status: z.enum(MEDICATION_STATUSES),
  intent: z.enum(MEDICATION_INTENTS).optional(),
  priority: z.enum(MEDICATION_PRIORITIES).optional(),
  quantity: z.string().optional().or(z.literal('')),
  startDate: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

export type MedicationFormValues = z.infer<typeof medicationFormSchema>

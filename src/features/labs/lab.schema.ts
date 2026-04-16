import { z } from 'zod'

export const labFormSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  type: z.string().min(1, 'Lab type is required'),
  code: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

export type LabFormValues = z.infer<typeof labFormSchema>

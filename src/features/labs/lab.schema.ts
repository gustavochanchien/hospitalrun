import { z } from 'zod'

export const labFormSchema = z.object({
  patientId: z.string().min(1, 'validation.patientRequired'),
  type: z.string().min(1, 'validation.typeRequired'),
  code: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

export type LabFormValues = z.infer<typeof labFormSchema>

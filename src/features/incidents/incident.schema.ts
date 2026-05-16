import { z } from 'zod'

export const incidentFormSchema = z.object({
  description: z.string().min(1, 'validation.descriptionRequired'),
  department: z.string().optional().or(z.literal('')),
  category: z.string().optional().or(z.literal('')),
  categoryItem: z.string().optional().or(z.literal('')),
  patientId: z.string().optional().or(z.literal('')),
})

export type IncidentFormValues = z.infer<typeof incidentFormSchema>

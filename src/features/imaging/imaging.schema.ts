import { z } from 'zod'

export const imagingFormSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  type: z.string().min(1, 'Imaging type is required'),
  code: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

export type ImagingFormValues = z.infer<typeof imagingFormSchema>

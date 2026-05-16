import { z } from 'zod'

export const invoiceFormSchema = z.object({
  patientId: z.string().min(1, 'validation.patientRequired'),
  visitId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>

export const lineItemFormSchema = z.object({
  chargeItemId: z.string().nullable().optional(),
  description: z.string().min(1, 'validation.descriptionRequired'),
  quantity: z.number().positive('validation.quantityPositive'),
  unitAmount: z.number().min(0, 'validation.amountPositive'),
})

export type LineItemFormValues = z.infer<typeof lineItemFormSchema>

export const paymentFormSchema = z.object({
  amount: z.number().positive('validation.amountPositive'),
  method: z.enum(['cash', 'card', 'bank-transfer', 'insurance', 'other']),
  receivedAt: z.string().min(1, 'validation.receivedAtRequired'),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export type PaymentFormValues = z.infer<typeof paymentFormSchema>

export const chargeItemFormSchema = z.object({
  code: z.string().min(1, 'validation.codeRequired'),
  name: z.string().min(1, 'validation.nameRequired'),
  description: z.string().nullable().optional(),
  unitAmount: z.number().min(0, 'validation.amountPositive'),
  currency: z.string().min(1),
  active: z.boolean(),
})

export type ChargeItemFormValues = z.infer<typeof chargeItemFormSchema>

import { z } from 'zod'

export const inventoryItemFormSchema = z.object({
  sku: z.string().min(1, 'validation.skuRequired'),
  name: z.string().min(1, 'validation.nameRequired'),
  description: z.string().nullable().optional(),
  unit: z.string().min(1, 'validation.unitRequired'),
  reorderLevel: z.number().min(0, 'validation.amountNonNegative'),
  unitCost: z.number().min(0, 'validation.amountNonNegative'),
  currency: z.string().min(1),
  active: z.boolean(),
})

export type InventoryItemFormValues = z.infer<typeof inventoryItemFormSchema>

export const receiveStockSchema = z.object({
  quantity: z.number().positive('validation.quantityPositive'),
  unitCost: z.number().min(0, 'validation.amountNonNegative').nullable().optional(),
  reference: z.string().nullable().optional(),
  occurredAt: z.string().min(1),
  notes: z.string().nullable().optional(),
})

export type ReceiveStockValues = z.infer<typeof receiveStockSchema>

export const adjustStockSchema = z.object({
  quantity: z
    .number()
    .refine((q) => q !== 0, { message: 'validation.quantityNonZero' }),
  reference: z.string().nullable().optional(),
  occurredAt: z.string().min(1),
  notes: z.string().nullable().optional(),
})

export type AdjustStockValues = z.infer<typeof adjustStockSchema>

export const wasteStockSchema = z.object({
  quantity: z.number().positive('validation.quantityPositive'),
  reference: z.string().nullable().optional(),
  occurredAt: z.string().min(1),
  notes: z.string().nullable().optional(),
})

export type WasteStockValues = z.infer<typeof wasteStockSchema>

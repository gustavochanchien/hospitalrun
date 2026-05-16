import { describe, it, expect } from 'vitest'
import {
  invoiceFormSchema,
  paymentFormSchema,
  chargeItemFormSchema,
  lineItemFormSchema,
} from './invoice.schema'

describe('invoiceFormSchema', () => {
  it('accepts a patient id', () => {
    const parsed = invoiceFormSchema.safeParse({ patientId: 'p1' })
    expect(parsed.success).toBe(true)
  })

  it('rejects an empty patient id', () => {
    const parsed = invoiceFormSchema.safeParse({ patientId: '' })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe('validation.patientRequired')
    }
  })
})

describe('paymentFormSchema', () => {
  it('accepts a valid payment', () => {
    const result = paymentFormSchema.safeParse({
      amount: 25.5,
      method: 'cash',
      receivedAt: '2026-05-16',
    })
    expect(result.success).toBe(true)
  })

  it('rejects zero or negative amounts', () => {
    const r1 = paymentFormSchema.safeParse({
      amount: 0,
      method: 'cash',
      receivedAt: '2026-05-16',
    })
    expect(r1.success).toBe(false)
    const r2 = paymentFormSchema.safeParse({
      amount: -1,
      method: 'cash',
      receivedAt: '2026-05-16',
    })
    expect(r2.success).toBe(false)
  })

  it('rejects an unknown method', () => {
    const r = paymentFormSchema.safeParse({
      amount: 10,
      method: 'crypto',
      receivedAt: '2026-05-16',
    })
    expect(r.success).toBe(false)
  })
})

describe('chargeItemFormSchema', () => {
  it('requires code and name', () => {
    const r = chargeItemFormSchema.safeParse({
      code: '',
      name: '',
      unitAmount: 5,
      currency: 'USD',
      active: true,
    })
    expect(r.success).toBe(false)
  })

  it('accepts a full valid item', () => {
    const r = chargeItemFormSchema.safeParse({
      code: 'CONSULT-1',
      name: 'Consultation',
      description: 'General consultation',
      unitAmount: 50,
      currency: 'USD',
      active: true,
    })
    expect(r.success).toBe(true)
  })
})

describe('lineItemFormSchema', () => {
  it('requires positive quantity', () => {
    const r = lineItemFormSchema.safeParse({
      description: 'Item',
      quantity: 0,
      unitAmount: 10,
    })
    expect(r.success).toBe(false)
  })

  it('allows zero unit amount', () => {
    const r = lineItemFormSchema.safeParse({
      description: 'Free item',
      quantity: 1,
      unitAmount: 0,
    })
    expect(r.success).toBe(true)
  })
})

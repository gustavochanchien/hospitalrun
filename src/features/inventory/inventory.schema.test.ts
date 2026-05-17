import { describe, it, expect } from 'vitest'
import {
  inventoryItemFormSchema,
  receiveStockSchema,
  adjustStockSchema,
  wasteStockSchema,
} from './inventory.schema'

describe('inventoryItemFormSchema', () => {
  it('accepts a valid item', () => {
    const result = inventoryItemFormSchema.safeParse({
      sku: 'GLOVE-S',
      name: 'Nitrile gloves',
      description: null,
      unit: 'box',
      reorderLevel: 5,
      unitCost: 10,
      currency: 'USD',
      active: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty sku', () => {
    const result = inventoryItemFormSchema.safeParse({
      sku: '',
      name: 'X',
      unit: 'each',
      reorderLevel: 0,
      unitCost: 0,
      currency: 'USD',
      active: true,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('validation.skuRequired')
    }
  })

  it('rejects negative unit cost', () => {
    const result = inventoryItemFormSchema.safeParse({
      sku: 'X',
      name: 'X',
      unit: 'each',
      reorderLevel: 0,
      unitCost: -1,
      currency: 'USD',
      active: true,
    })
    expect(result.success).toBe(false)
  })
})

describe('receiveStockSchema', () => {
  it('rejects zero quantity', () => {
    expect(
      receiveStockSchema.safeParse({
        quantity: 0,
        occurredAt: '2026-01-01',
      }).success,
    ).toBe(false)
  })

  it('accepts positive quantity', () => {
    expect(
      receiveStockSchema.safeParse({
        quantity: 5,
        occurredAt: '2026-01-01',
      }).success,
    ).toBe(true)
  })
})

describe('adjustStockSchema', () => {
  it('accepts negative quantity (removal)', () => {
    expect(
      adjustStockSchema.safeParse({
        quantity: -3,
        occurredAt: '2026-01-01',
      }).success,
    ).toBe(true)
  })

  it('rejects zero quantity', () => {
    const result = adjustStockSchema.safeParse({
      quantity: 0,
      occurredAt: '2026-01-01',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('validation.quantityNonZero')
    }
  })
})

describe('wasteStockSchema', () => {
  it('rejects negative quantity', () => {
    expect(
      wasteStockSchema.safeParse({
        quantity: -1,
        occurredAt: '2026-01-01',
      }).success,
    ).toBe(false)
  })
})

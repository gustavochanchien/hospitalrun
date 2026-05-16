import { describe, it, expect } from 'vitest'
import { computeInvoiceTotals, inferStatus, formatMoney } from './invoice-totals'
import type { InvoiceLineItem, Payment } from '@/lib/db/schema'

function line(amount: number, deleted = false): InvoiceLineItem {
  return {
    id: crypto.randomUUID(),
    orgId: 'o',
    invoiceId: 'i',
    chargeItemId: null,
    description: 'Line',
    quantity: 1,
    unitAmount: amount,
    amount,
    deletedAt: null,
    createdAt: '',
    updatedAt: '',
    _synced: false,
    _deleted: deleted,
  }
}

function payment(amount: number, deleted = false): Payment {
  return {
    id: crypto.randomUUID(),
    orgId: 'o',
    invoiceId: 'i',
    patientId: 'p',
    amount,
    method: 'cash',
    receivedAt: new Date().toISOString(),
    reference: null,
    notes: null,
    deletedAt: null,
    createdAt: '',
    updatedAt: '',
    _synced: false,
    _deleted: deleted,
  }
}

describe('computeInvoiceTotals', () => {
  it('returns zeros when there are no line items or payments', () => {
    const totals = computeInvoiceTotals({ tax: 0, discount: 0 }, [], [])
    expect(totals).toEqual({
      subtotal: 0,
      tax: 0,
      discount: 0,
      total: 0,
      amountPaid: 0,
      balance: 0,
    })
  })

  it('sums line items into subtotal and applies tax + discount', () => {
    const totals = computeInvoiceTotals(
      { tax: 5, discount: 2 },
      [line(10), line(20)],
      [],
    )
    expect(totals.subtotal).toBe(30)
    expect(totals.tax).toBe(5)
    expect(totals.discount).toBe(2)
    expect(totals.total).toBe(33)
    expect(totals.amountPaid).toBe(0)
    expect(totals.balance).toBe(33)
  })

  it('ignores soft-deleted lines and payments', () => {
    const totals = computeInvoiceTotals(
      { tax: 0, discount: 0 },
      [line(50), line(100, true)],
      [payment(20), payment(80, true)],
    )
    expect(totals.subtotal).toBe(50)
    expect(totals.amountPaid).toBe(20)
    expect(totals.balance).toBe(30)
  })

  it('rounds to 2 decimal places', () => {
    const totals = computeInvoiceTotals(
      { tax: 0, discount: 0 },
      [line(0.1), line(0.2)],
      [],
    )
    expect(totals.subtotal).toBe(0.3)
  })
})

describe('inferStatus', () => {
  const baseTotals = { total: 100, amountPaid: 0 }

  it('never changes a draft invoice', () => {
    expect(inferStatus('draft', { total: 100, amountPaid: 100 })).toBe('draft')
  })

  it('never changes a void invoice', () => {
    expect(inferStatus('void', { total: 100, amountPaid: 100 })).toBe('void')
  })

  it('keeps issued when no payment received', () => {
    expect(inferStatus('issued', baseTotals)).toBe('issued')
  })

  it('flips to partial when payment is less than total', () => {
    expect(inferStatus('issued', { total: 100, amountPaid: 25 })).toBe('partial')
  })

  it('flips to paid when payment meets total', () => {
    expect(inferStatus('partial', { total: 100, amountPaid: 100 })).toBe('paid')
    expect(inferStatus('issued', { total: 100, amountPaid: 150 })).toBe('paid')
  })
})

describe('formatMoney', () => {
  it('formats USD with currency symbol', () => {
    expect(formatMoney(42.5, 'USD')).toMatch(/42\.50/)
    expect(formatMoney(42.5, 'USD')).toMatch(/\$/)
  })

  it('falls back to plain text for invalid currency codes', () => {
    // 'INVALID' is not a valid 3-letter ISO 4217 code — Intl throws and we fall back.
    expect(formatMoney(10, 'INVALID')).toMatch(/INVALID/)
    expect(formatMoney(10, 'INVALID')).toMatch(/10/)
  })
})

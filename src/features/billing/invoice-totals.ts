import type { Invoice, InvoiceLineItem, Payment } from '@/lib/db/schema'

export interface InvoiceTotals {
  subtotal: number
  tax: number
  discount: number
  total: number
  amountPaid: number
  balance: number
}

export function computeInvoiceTotals(
  invoice: Pick<Invoice, 'tax' | 'discount'>,
  lineItems: readonly InvoiceLineItem[],
  payments: readonly Payment[],
): InvoiceTotals {
  const activeLines = lineItems.filter((l) => !l._deleted)
  const activePayments = payments.filter((p) => !p._deleted)
  const subtotal = round2(activeLines.reduce((sum, l) => sum + l.amount, 0))
  const tax = round2(invoice.tax || 0)
  const discount = round2(invoice.discount || 0)
  const total = round2(subtotal + tax - discount)
  const amountPaid = round2(activePayments.reduce((sum, p) => sum + p.amount, 0))
  const balance = round2(total - amountPaid)
  return { subtotal, tax, discount, total, amountPaid, balance }
}

/**
 * Given the current totals, infer the next status of a non-void invoice.
 * Void invoices keep their status — never mutated by this function.
 */
export function inferStatus(
  current: Invoice['status'],
  totals: Pick<InvoiceTotals, 'total' | 'amountPaid'>,
): Invoice['status'] {
  if (current === 'void' || current === 'draft') return current
  if (totals.amountPaid <= 0) return 'issued'
  if (totals.amountPaid >= totals.total) return 'paid'
  return 'partial'
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

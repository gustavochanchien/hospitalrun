import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { useAuthStore } from '@/features/auth/auth.store'
import type { Invoice } from '@/lib/db/schema'
import { PaymentDialog } from './PaymentDialog'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const orgId = 'org-payment-dialog'

const baseInvoice: Invoice = {
  id: 'inv-1',
  orgId,
  patientId: 'p-1',
  visitId: null,
  invoiceNumber: 'INV-00001',
  status: 'issued',
  issuedAt: new Date().toISOString(),
  dueAt: null,
  currency: 'USD',
  subtotal: 100,
  tax: 0,
  discount: 0,
  total: 100,
  amountPaid: 0,
  notes: null,
  deletedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  _synced: true,
  _deleted: false,
}

beforeEach(async () => {
  await db.transaction('rw', db.payments, db.syncQueue, async () => {
    await db.payments.clear()
    await db.syncQueue.clear()
  })
  useAuthStore.setState({
    user: { id: 'u-1', email: 'a@b.com' } as never,
    session: null,
    orgId,
    role: 'doctor',
    isLoading: false,
  })
})

describe('PaymentDialog', () => {
  it('pre-fills the amount with the outstanding balance', () => {
    render(
      <PaymentDialog
        open
        onOpenChange={() => {}}
        invoice={{ ...baseInvoice, total: 100, amountPaid: 30 }}
      />,
    )
    const amount = screen.getByLabelText(/Amount/i) as HTMLInputElement
    expect(amount.value).toBe('70')
  })

  it('writes a payment row and queues a sync entry on submit', async () => {
    render(<PaymentDialog open onOpenChange={() => {}} invoice={baseInvoice} />)
    const submit = screen.getByRole('button', { name: /^record$/i })
    await userEvent.click(submit)

    await waitFor(async () => {
      const payments = await db.payments.toArray()
      expect(payments).toHaveLength(1)
      expect(payments[0]!.amount).toBe(100)
      expect(payments[0]!.method).toBe('cash')
      expect(payments[0]!.invoiceId).toBe(baseInvoice.id)
    })
    const queue = await db.syncQueue.toArray()
    expect(queue.some((q) => q.tableName === 'payments')).toBe(true)
  })

  it('rejects non-positive amounts via the schema', async () => {
    render(<PaymentDialog open onOpenChange={() => {}} invoice={baseInvoice} />)
    const amount = screen.getByLabelText(/Amount/i) as HTMLInputElement
    await userEvent.clear(amount)
    await userEvent.type(amount, '0')
    await userEvent.click(screen.getByRole('button', { name: /^record$/i }))

    expect(await screen.findByText(/Amount must be positive/i)).toBeInTheDocument()
    expect(await db.payments.count()).toBe(0)
  })
})

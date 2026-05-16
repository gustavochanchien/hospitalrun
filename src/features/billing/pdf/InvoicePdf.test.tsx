import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Invoice, InvoiceLineItem, Patient, Payment } from '@/lib/db/schema'

vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pdf-document">{children}</div>
  ),
  Page: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pdf-page">{children}</div>
  ),
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({
    children,
    render: renderProp,
  }: {
    children?: React.ReactNode
    render?: (args: { pageNumber: number; totalPages: number }) => string
  }) =>
    renderProp ? (
      <span>{renderProp({ pageNumber: 1, totalPages: 1 })}</span>
    ) : (
      <span>{children}</span>
    ),
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
}))

vi.mock('@/lib/pdf', () => ({
  PdfHeader: ({ title }: { title: string; subtitle?: string }) => (
    <div data-testid="pdf-header">
      <span>{title}</span>
    </div>
  ),
  PdfFooter: ({ generatedLabel }: { generatedLabel: string }) => (
    <div data-testid="pdf-footer">{generatedLabel}</div>
  ),
  pdfStyles: {
    page: {},
    section: {},
    sectionHeading: {},
    fieldRow: {},
    fieldLabel: {},
    fieldValue: {},
    listItem: {},
    listBullet: {},
    body: {},
    muted: {},
  },
  pdfTheme: {
    colors: { text: '#111827', muted: '#4b5563', border: '#d1d5db', accent: '#0f766e' },
    fontSizes: { title: 18, heading: 13, body: 10, small: 9, footer: 8 },
    spacing: { page: 36, section: 14, row: 4 },
  },
}))

import { InvoicePdf } from './InvoicePdf'

const baseInvoice: Invoice = {
  id: 'inv-1',
  orgId: 'org-1',
  patientId: 'p-1',
  visitId: null,
  invoiceNumber: 'INV-0001',
  status: 'issued',
  issuedAt: '2026-03-01T00:00:00.000Z',
  dueAt: '2026-03-31T00:00:00.000Z',
  currency: 'USD',
  subtotal: 200,
  tax: 20,
  discount: 10,
  total: 210,
  amountPaid: 100,
  notes: 'Please pay promptly.',
  deletedAt: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  _synced: true,
  _deleted: false,
}

const baseLineItems: InvoiceLineItem[] = [
  {
    id: 'li-1',
    orgId: 'org-1',
    invoiceId: 'inv-1',
    chargeItemId: null,
    description: 'Consultation',
    quantity: 1,
    unitAmount: 150,
    amount: 150,
    deletedAt: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    _synced: true,
    _deleted: false,
  },
  {
    id: 'li-2',
    orgId: 'org-1',
    invoiceId: 'inv-1',
    chargeItemId: null,
    description: 'Blood panel',
    quantity: 2,
    unitAmount: 25,
    amount: 50,
    deletedAt: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    _synced: true,
    _deleted: false,
  },
]

const basePayment: Payment = {
  id: 'pay-1',
  orgId: 'org-1',
  invoiceId: 'inv-1',
  patientId: 'p-1',
  amount: 100,
  method: 'cash',
  receivedAt: '2026-03-05T00:00:00.000Z',
  reference: 'REC-001',
  notes: null,
  deletedAt: null,
  createdAt: '2026-03-05T00:00:00.000Z',
  updatedAt: '2026-03-05T00:00:00.000Z',
  _synced: true,
  _deleted: false,
}

const patient: Patient = {
  id: 'p-1',
  orgId: 'org-1',
  mrn: 'M-200',
  prefix: null,
  givenName: 'Jordan',
  familyName: 'Lee',
  suffix: null,
  dateOfBirth: '1985-07-20',
  sex: 'other',
  bloodType: 'A+',
  occupation: null,
  preferredLanguage: null,
  phone: null,
  email: null,
  address: null,
  isApproximateDateOfBirth: null,
  status: 'active',
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  _synced: true,
  _deleted: false,
}

describe('InvoicePdf', () => {
  it('smoke render: invoice number, patient name, line items, and payment appear', () => {
    render(
      <InvoicePdf
        orgName="Demo Clinic"
        invoice={baseInvoice}
        patient={patient}
        lineItems={baseLineItems}
        payments={[basePayment]}
        generatedAt={new Date('2026-04-01T09:00:00.000Z')}
        locale="en"
      />,
    )
    expect(screen.getAllByText(/INV-0001/).length).toBeGreaterThan(0)
    expect(screen.getByText('Jordan Lee')).toBeInTheDocument()
    expect(screen.getByText('Consultation')).toBeInTheDocument()
    expect(screen.getByText('Blood panel')).toBeInTheDocument()
    // payment method label (translated via billing namespace)
    expect(screen.getByText('Cash')).toBeInTheDocument()
    // reference
    expect(screen.getByText('REC-001')).toBeInTheDocument()
    // notes block
    expect(screen.getByText('Please pay promptly.')).toBeInTheDocument()
  })

  it('empty payments: renders without payments section crashing', () => {
    render(
      <InvoicePdf
        orgName="Demo Clinic"
        invoice={baseInvoice}
        patient={patient}
        lineItems={baseLineItems}
        payments={[]}
        generatedAt={new Date('2026-04-01T09:00:00.000Z')}
        locale="en"
      />,
    )
    expect(screen.getAllByText(/INV-0001/).length).toBeGreaterThan(0)
    expect(screen.queryByText('Cash')).not.toBeInTheDocument()
  })

  it('null patient: falls back to "Unknown patient" label without crashing', () => {
    render(
      <InvoicePdf
        orgName="Demo Clinic"
        invoice={baseInvoice}
        patient={null}
        lineItems={baseLineItems}
        payments={[basePayment]}
        generatedAt={new Date('2026-04-01T09:00:00.000Z')}
        locale="en"
      />,
    )
    expect(screen.getByText('Unknown patient')).toBeInTheDocument()
  })
})

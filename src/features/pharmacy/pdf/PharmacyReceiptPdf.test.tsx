import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { InventoryItem, InventoryTransaction, Medication, Patient } from '@/lib/db/schema'

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

import { PharmacyReceiptPdf } from './PharmacyReceiptPdf'

const baseMedication: Medication = {
  id: 'med-1',
  orgId: 'org-1',
  patientId: 'p-1',
  visitId: null,
  name: 'Amoxicillin 500mg',
  status: 'active',
  intent: null,
  priority: null,
  quantity: '21',
  requestedBy: 'Dr. Smith',
  startDate: '2026-05-01',
  endDate: '2026-05-08',
  notes: null,
  inventoryItemId: 'item-1',
  dosageInstructions: '500mg three times daily with food',
  route: 'oral',
  frequency: 'TDS',
  deletedAt: null,
  createdAt: '2026-05-01T08:00:00.000Z',
  updatedAt: '2026-05-01T08:00:00.000Z',
  _synced: true,
  _deleted: false,
}

const basePatient: Patient = {
  id: 'p-1',
  orgId: 'org-1',
  mrn: 'M-500',
  prefix: null,
  givenName: 'Alice',
  familyName: 'Nguyen',
  suffix: null,
  dateOfBirth: '1990-03-15',
  sex: 'female',
  bloodType: 'O+',
  occupation: null,
  preferredLanguage: null,
  phone: null,
  email: null,
  address: null,
  maritalStatus: null,
  educationLevel: null,
  nationalId: null,
  nationalIdType: null,
  numberOfChildren: null,
  numberOfHouseholdMembers: null,
  isHeadOfHousehold: false,
  isApproximateDateOfBirth: null,
  status: 'active',
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  _synced: true,
  _deleted: false,
}

const baseInventoryItem: InventoryItem = {
  id: 'item-1',
  orgId: 'org-1',
  sku: 'AMX-500',
  name: 'Amoxicillin 500mg Capsules',
  description: 'Broad-spectrum antibiotic',
  unit: 'capsules',
  onHand: 200,
  reorderLevel: 50,
  unitCost: 0.5,
  currency: 'USD',
  active: true,
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  _synced: true,
  _deleted: false,
}

const baseTransaction: InventoryTransaction = {
  id: 'txn-abcd1234-xyz',
  orgId: 'org-1',
  inventoryItemId: 'item-1',
  kind: 'dispense',
  quantity: 21,
  unitCost: 0.5,
  reference: null,
  patientId: 'p-1',
  medicationId: 'med-1',
  occurredAt: '2026-05-01T09:30:00.000Z',
  recordedBy: 'Pharmacist Jane',
  notes: null,
  deletedAt: null,
  createdAt: '2026-05-01T09:30:00.000Z',
  updatedAt: '2026-05-01T09:30:00.000Z',
  _synced: true,
  _deleted: false,
}

const sampleProps = {
  orgName: 'Demo Hospital',
  medication: baseMedication,
  patient: basePatient,
  inventoryItem: baseInventoryItem,
  transaction: baseTransaction,
  generatedAt: new Date('2026-05-01T10:00:00.000Z'),
  locale: 'en',
}

describe('PharmacyReceiptPdf', () => {
  it('smoke render: medication name, patient name, item name, quantity, and a localized label appear', () => {
    render(<PharmacyReceiptPdf {...sampleProps} />)

    // Patient name
    expect(screen.getByText('Alice Nguyen')).toBeInTheDocument()
    // MRN
    expect(screen.getByText('M-500')).toBeInTheDocument()
    // Inventory item name
    expect(screen.getByText('Amoxicillin 500mg Capsules')).toBeInTheDocument()
    // Quantity + unit
    expect(screen.getByText(/21/)).toBeInTheDocument()
    expect(screen.getByText(/capsules/)).toBeInTheDocument()
    // Directions
    expect(screen.getByText('500mg three times daily with food')).toBeInTheDocument()
    expect(screen.getByText('oral')).toBeInTheDocument()
    expect(screen.getByText('TDS')).toBeInTheDocument()
    // Dispensed by
    expect(screen.getByText('Pharmacist Jane')).toBeInTheDocument()
    // A localized label from the pdf namespace (appears as section heading and field label)
    expect(screen.getAllByText('Patient').length).toBeGreaterThan(0)
    // Receipt header title
    expect(screen.getByText('Pharmacy Receipt')).toBeInTheDocument()
    // Receipt number (first 8 chars of txn-abcd uppercase)
    expect(screen.getByText(/TXN-ABCD/i)).toBeInTheDocument()
  })

  it('empty directions fallback: renders fallback text when all direction fields are null', () => {
    const noDirectionsMedication: Medication = {
      ...baseMedication,
      dosageInstructions: null,
      route: null,
      frequency: null,
    }

    render(
      <PharmacyReceiptPdf
        {...sampleProps}
        medication={noDirectionsMedication}
      />,
    )

    expect(screen.getByText('No directions recorded.')).toBeInTheDocument()
    // Individual direction fields should not appear
    expect(screen.queryByText('Dosage')).not.toBeInTheDocument()
    expect(screen.queryByText('Route')).not.toBeInTheDocument()
    expect(screen.queryByText('Frequency')).not.toBeInTheDocument()
  })
})

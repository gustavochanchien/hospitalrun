import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Lab, Patient } from '@/lib/db/schema'

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
  PdfHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div data-testid="pdf-header">
      <span>{title}</span>
      {subtitle ? <span>{subtitle}</span> : null}
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
  pdfTheme: { colors: {}, fontSizes: {}, spacing: {} },
}))

import { LabReportPdf } from './LabReportPdf'

const baseLab: Lab = {
  id: 'lab-1',
  orgId: 'org-1',
  patientId: 'p-1',
  visitId: null,
  code: 'L-001',
  type: 'CBC',
  status: 'completed',
  requestedBy: 'Dr. House',
  requestedAt: '2026-01-01T10:00:00.000Z',
  completedAt: '2026-01-02T11:00:00.000Z',
  canceledAt: null,
  result: 'Within normal limits.\n\nFollow-up in 3 months.',
  notes: 'Fasting',
  deletedAt: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-02T11:00:00.000Z',
  _synced: true,
  _deleted: false,
}

const patient: Patient = {
  id: 'p-1',
  orgId: 'org-1',
  mrn: 'M-100',
  prefix: null,
  givenName: 'Alex',
  familyName: 'Garcia',
  suffix: null,
  dateOfBirth: '1990-05-12',
  sex: 'female',
  bloodType: 'O+',
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

describe('LabReportPdf', () => {
  it('renders patient name, MRN, type, and result paragraphs', () => {
    render(
      <LabReportPdf
        orgName="Demo Clinic"
        lab={baseLab}
        patient={patient}
        generatedAt={new Date('2026-02-01T09:00:00.000Z')}
        locale="en"
      />,
    )
    expect(screen.getByText('Alex Garcia')).toBeInTheDocument()
    expect(screen.getByText('M-100')).toBeInTheDocument()
    expect(screen.getAllByText('CBC').length).toBeGreaterThan(0)
    expect(screen.getByText('Within normal limits.')).toBeInTheDocument()
    expect(screen.getByText('Follow-up in 3 months.')).toBeInTheDocument()
  })

  it('falls back to "Unknown patient" when patient is null', () => {
    render(
      <LabReportPdf
        orgName="Demo Clinic"
        lab={baseLab}
        patient={null}
        generatedAt={new Date('2026-02-01T09:00:00.000Z')}
        locale="en"
      />,
    )
    expect(screen.getByText('Unknown patient')).toBeInTheDocument()
  })

  it('shows the empty-result label when result is missing', () => {
    render(
      <LabReportPdf
        orgName="Demo Clinic"
        lab={{ ...baseLab, result: null, status: 'requested', completedAt: null }}
        patient={patient}
        generatedAt={new Date('2026-02-01T09:00:00.000Z')}
        locale="en"
      />,
    )
    expect(
      screen.getByText('No result has been recorded yet.'),
    ).toBeInTheDocument()
  })
})

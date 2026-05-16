import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Imaging, Patient } from '@/lib/db/schema'

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
  Image: ({ src }: { src: string }) => <div data-testid="pdf-image" data-src={src} />,
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
}))

vi.mock('@/lib/pdf', () => ({
  PdfHeader: ({ title }: { title: string }) => <div data-testid="pdf-header">{title}</div>,
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
    body: {},
    muted: {},
  },
  pdfTheme: {
    colors: { text: '#111', muted: '#555' },
    fontSizes: {},
    spacing: { row: 4 },
  },
}))

import { ImagingReportPdf } from './ImagingReportPdf'

const baseImaging: Imaging = {
  id: 'i-1',
  orgId: 'org-1',
  patientId: 'p-1',
  visitId: null,
  code: 'I-001',
  type: 'MRI Brain',
  status: 'completed',
  requestedBy: 'Dr. Strange',
  requestedOn: '2026-01-01T10:00:00.000Z',
  completedOn: '2026-01-02T11:00:00.000Z',
  canceledOn: null,
  notes: null,
  storagePath: 'org-1/i-1/scan.png',
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
  givenName: 'Sam',
  familyName: 'Lee',
  suffix: null,
  dateOfBirth: null,
  sex: 'male',
  bloodType: null,
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

describe('ImagingReportPdf', () => {
  it('embeds the image when a data URL is provided', () => {
    render(
      <ImagingReportPdf
        orgName="Demo"
        imaging={baseImaging}
        patient={patient}
        imageDataUrl="data:image/png;base64,xxxx"
        generatedAt={new Date('2026-02-01T09:00:00.000Z')}
        locale="en"
      />,
    )
    const image = screen.getByTestId('pdf-image')
    expect(image).toHaveAttribute('data-src', 'data:image/png;base64,xxxx')
  })

  it('shows imageUnavailable when storage path exists but no data URL', () => {
    render(
      <ImagingReportPdf
        orgName="Demo"
        imaging={baseImaging}
        patient={patient}
        imageDataUrl={null}
        generatedAt={new Date('2026-02-01T09:00:00.000Z')}
        locale="en"
      />,
    )
    expect(
      screen.getByText('Image could not be embedded.'),
    ).toBeInTheDocument()
  })

  it('shows the no-image label when no storage path is set', () => {
    render(
      <ImagingReportPdf
        orgName="Demo"
        imaging={{ ...baseImaging, storagePath: null }}
        patient={patient}
        imageDataUrl={null}
        generatedAt={new Date('2026-02-01T09:00:00.000Z')}
        locale="en"
      />,
    )
    expect(
      screen.getByText('No image attached to this study.'),
    ).toBeInTheDocument()
  })
})

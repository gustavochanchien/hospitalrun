import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Allergy, Diagnosis, Medication, Patient, Visit } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Mock @react-pdf/renderer — its canvas/font internals don't work in jsdom.
// Replace all primitives with plain HTML so RTL can query text content.
// ---------------------------------------------------------------------------
vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-document">{children}</div>,
  Page: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-page">{children}</div>,
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children, render: renderProp }: { children?: React.ReactNode; render?: (args: { pageNumber: number; totalPages: number }) => string }) => {
    if (renderProp) {
      return <span>{renderProp({ pageNumber: 1, totalPages: 1 })}</span>
    }
    return <span>{children}</span>
  },
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
}))

// Mock the shared pdf lib pieces so we don't need StyleSheet at import time
vi.mock('@/lib/pdf/theme', () => ({
  pdfTheme: {
    colors: { text: '#111', muted: '#555', border: '#ccc', accent: '#0f7', danger: '#b00', background: '#fff' },
    fontSizes: { title: 18, heading: 13, body: 10, small: 9, footer: 8 },
    spacing: { page: 36, section: 14, row: 4 },
  },
  pdfStyles: {
    page: {},
    section: {},
    sectionHeading: {},
    fieldRow: {},
    fieldLabel: {},
    fieldValue: {},
    listItem: {},
    listBullet: {},
    twoColRow: {},
    twoColItem: {},
    body: {},
    muted: {},
  },
}))

vi.mock('@/lib/pdf/Header', () => ({
  PdfHeader: ({ orgName, title, subtitle }: { orgName: string; title: string; subtitle?: string }) => (
    <div data-testid="pdf-header">
      <span>{orgName}</span>
      <span>{title}</span>
      {subtitle ? <span>{subtitle}</span> : null}
    </div>
  ),
}))

vi.mock('@/lib/pdf/Footer', () => ({
  PdfFooter: ({ generatedLabel, pageLabel }: { generatedLabel: string; pageLabel: string }) => (
    <div data-testid="pdf-footer">
      <span>{generatedLabel}</span>
      <span>{pageLabel}</span>
    </div>
  ),
}))

// Mock i18next.getFixedT so we don't need a real i18n init
vi.mock('i18next', () => ({
  default: {
    getFixedT: () => (key: string, vars?: Record<string, string>) => {
      // Return the key with simple variable substitution for test assertions
      if (!vars) return key
      return Object.entries(vars).reduce(
        (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
        key,
      )
    },
  },
}))

import { PatientSummaryPdf } from './PatientSummaryPdf'

// ---------------------------------------------------------------------------
// Shared sample data
// ---------------------------------------------------------------------------

const basePatient: Patient = {
  id: 'pat-1',
  orgId: 'org-1',
  mrn: 'MRN-001',
  prefix: 'Dr.',
  givenName: 'Jane',
  familyName: 'Doe',
  suffix: null,
  dateOfBirth: '1985-06-15',
  sex: 'female',
  bloodType: 'O+',
  occupation: null,
  preferredLanguage: 'English',
  phone: '555-1234',
  email: 'jane.doe@example.com',
  address: { street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701' },
  isApproximateDateOfBirth: false,
  status: 'active',
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  _synced: true,
  _deleted: false,
}

const baseDiagnosis: Diagnosis = {
  id: 'dx-1',
  orgId: 'org-1',
  patientId: 'pat-1',
  visitId: null,
  icdCode: 'J06.9',
  description: 'Acute upper respiratory infection',
  status: 'active',
  diagnosedAt: null,
  diagnosedBy: null,
  onsetDate: null,
  abatementDate: null,
  notes: null,
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  _synced: true,
  _deleted: false,
}

const baseMedication: Medication = {
  id: 'med-1',
  orgId: 'org-1',
  patientId: 'pat-1',
  visitId: null,
  name: 'Amoxicillin',
  status: 'active',
  intent: null,
  priority: 'routine',
  quantity: '500mg',
  requestedBy: null,
  startDate: null,
  endDate: null,
  notes: null,
  inventoryItemId: null,
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  _synced: true,
  _deleted: false,
}

const baseAllergy: Allergy = {
  id: 'al-1',
  orgId: 'org-1',
  patientId: 'pat-1',
  allergen: 'Penicillin',
  reaction: 'Rash',
  severity: 'moderate',
  notedAt: null,
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  _synced: true,
  _deleted: false,
}

const baseVisit: Visit = {
  id: 'vis-1',
  orgId: 'org-1',
  patientId: 'pat-1',
  type: 'Outpatient',
  status: 'finished',
  reason: 'Annual checkup',
  location: 'Clinic A',
  startDatetime: '2024-03-10T09:00:00Z',
  endDatetime: '2024-03-10T09:30:00Z',
  notes: null,
  deletedAt: null,
  createdAt: '2024-03-10T00:00:00Z',
  updatedAt: '2024-03-10T00:00:00Z',
  _synced: true,
  _deleted: false,
}

const defaultProps = {
  orgName: 'General Hospital',
  patient: basePatient,
  diagnoses: [baseDiagnosis],
  medications: [baseMedication],
  allergies: [baseAllergy],
  visits: [baseVisit],
  generatedAt: new Date('2024-06-01T12:00:00Z'),
  locale: 'en',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PatientSummaryPdf', () => {
  it('renders the document and page wrappers', () => {
    render(<PatientSummaryPdf {...defaultProps} />)
    expect(screen.getByTestId('pdf-document')).toBeInTheDocument()
    expect(screen.getByTestId('pdf-page')).toBeInTheDocument()
  })

  it('passes orgName and title to PdfHeader', () => {
    render(<PatientSummaryPdf {...defaultProps} />)
    const header = screen.getByTestId('pdf-header')
    expect(header).toHaveTextContent('General Hospital')
    expect(header).toHaveTextContent('patientSummary.title')
  })

  it('includes the subtitle in the header', () => {
    render(<PatientSummaryPdf {...defaultProps} />)
    const header = screen.getByTestId('pdf-header')
    // Mock translator returns key with substitutions applied; the key itself
    // contains the literal "patientSummary.subtitle" which the mock outputs.
    expect(header).toHaveTextContent('patientSummary.subtitle')
  })

  it('renders the patient full name', () => {
    render(<PatientSummaryPdf {...defaultProps} />)
    expect(screen.getByText('Dr. Jane Doe')).toBeInTheDocument()
  })

  it('renders formatted date of birth', () => {
    render(<PatientSummaryPdf {...defaultProps} />)
    expect(screen.getByText('Jun 15, 1985')).toBeInTheDocument()
  })

  it('renders patient demographic fields', () => {
    render(<PatientSummaryPdf {...defaultProps} />)
    expect(screen.getByText('female')).toBeInTheDocument()
    expect(screen.getByText('O+')).toBeInTheDocument()
    expect(screen.getByText('555-1234')).toBeInTheDocument()
    expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument()
    expect(screen.getByText('123 Main St, Springfield, IL, 62701')).toBeInTheDocument()
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('renders diagnosis with ICD code', () => {
    render(<PatientSummaryPdf {...defaultProps} />)
    // The Text node contains two spaces before the paren; use a regex to
    // match regardless of whitespace normalization by jsdom.
    expect(
      screen.getByText(/Acute upper respiratory infection\s+\(J06\.9\)/),
    ).toBeInTheDocument()
  })

  it('renders medication name with quantity and priority', () => {
    render(<PatientSummaryPdf {...defaultProps} />)
    expect(screen.getByText('Amoxicillin')).toBeInTheDocument()
    expect(screen.getByText('500mg · routine')).toBeInTheDocument()
  })

  it('renders allergy allergen, severity and reaction', () => {
    render(<PatientSummaryPdf {...defaultProps} />)
    expect(screen.getByText('Penicillin')).toBeInTheDocument()
    expect(screen.getByText('moderate · Rash')).toBeInTheDocument()
  })

  it('renders visit reason and metadata', () => {
    render(<PatientSummaryPdf {...defaultProps} />)
    expect(screen.getByText('Annual checkup')).toBeInTheDocument()
    expect(screen.getByText(/Outpatient/)).toBeInTheDocument()
    expect(screen.getByText(/Clinic A/)).toBeInTheDocument()
  })

  it('shows empty state text when diagnoses list is empty', () => {
    render(<PatientSummaryPdf {...defaultProps} diagnoses={[]} />)
    expect(screen.getByText('patientSummary.empty.diagnoses')).toBeInTheDocument()
  })

  it('shows empty state text when medications list is empty', () => {
    render(<PatientSummaryPdf {...defaultProps} medications={[]} />)
    expect(screen.getByText('patientSummary.empty.medications')).toBeInTheDocument()
  })

  it('shows empty state text when allergies list is empty', () => {
    render(<PatientSummaryPdf {...defaultProps} allergies={[]} />)
    expect(screen.getByText('patientSummary.empty.allergies')).toBeInTheDocument()
  })

  it('shows empty state text when visits list is empty', () => {
    render(<PatientSummaryPdf {...defaultProps} visits={[]} />)
    expect(screen.getByText('patientSummary.empty.visits')).toBeInTheDocument()
  })

  it('falls back to noOrgName key when orgName is blank', () => {
    render(<PatientSummaryPdf {...defaultProps} orgName="" />)
    const header = screen.getByTestId('pdf-header')
    expect(header).toHaveTextContent('common.noOrgName')
  })

  it('renders notSpecified fallback for null patient fields', () => {
    const nullPatient: Patient = {
      ...basePatient,
      sex: null,
      bloodType: null,
      phone: null,
      email: null,
      address: null,
      preferredLanguage: null,
    }
    render(<PatientSummaryPdf {...defaultProps} patient={nullPatient} />)
    // common.notSpecified should appear multiple times (sex, bloodType, phone, email, address, lang)
    const fallbacks = screen.getAllByText('common.notSpecified')
    expect(fallbacks.length).toBeGreaterThanOrEqual(6)
  })

  it('renders the PdfFooter with generated label', () => {
    render(<PatientSummaryPdf {...defaultProps} />)
    const footer = screen.getByTestId('pdf-footer')
    expect(footer).toHaveTextContent('footer.generated')
  })

  it('renders a diagnosis without an ICD code', () => {
    const noCodeDx: Diagnosis = { ...baseDiagnosis, icdCode: null }
    render(<PatientSummaryPdf {...defaultProps} diagnoses={[noCodeDx]} />)
    expect(screen.getByText('Acute upper respiratory infection')).toBeInTheDocument()
  })

  it('renders a medication without quantity or priority', () => {
    const simpleMed: Medication = { ...baseMedication, quantity: null, priority: null }
    render(<PatientSummaryPdf {...defaultProps} medications={[simpleMed]} />)
    expect(screen.getByText('Amoxicillin')).toBeInTheDocument()
  })

  it('renders a visit without a reason', () => {
    const noReasonVisit: Visit = { ...baseVisit, reason: null }
    render(<PatientSummaryPdf {...defaultProps} visits={[noReasonVisit]} />)
    // Should still render the sub-line with date/type/location
    expect(screen.getByText(/Outpatient/)).toBeInTheDocument()
  })
})

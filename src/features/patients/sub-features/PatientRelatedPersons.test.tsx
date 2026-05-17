import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, params, children, className }: {
    to: string
    params?: Record<string, string>
    children: React.ReactNode
    className?: string
  }) => {
    const href = Object.entries(params ?? {}).reduce(
      (acc, [k, v]) => acc.replace(`$${k}`, v),
      to,
    )
    return (
      <a href={href} className={className}>
        {children}
      </a>
    )
  },
}))

import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { PatientRelatedPersons } from './PatientRelatedPersons'
import type { Patient, RelatedPerson } from '@/lib/db/schema'

const orgId = 'org-rp'
const patientId = 'patient-rp-1'

function makeRelatedPerson(overrides: Partial<RelatedPerson> = {}): RelatedPerson {
  return {
    id: crypto.randomUUID(),
    orgId,
    patientId,
    givenName: 'Jane',
    familyName: 'Doe',
    relationship: null,
    phone: null,
    email: null,
    address: null,
    linkedPatientId: null,
    isPrimaryContact: false,
    deletedAt: null,
    createdAt: '',
    updatedAt: '',
    _synced: false,
    _deleted: false,
    ...overrides,
  }
}

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: crypto.randomUUID(),
    orgId,
    mrn: null,
    prefix: null,
    givenName: 'A',
    familyName: 'B',
    suffix: null,
    dateOfBirth: null,
    sex: null,
    bloodType: null,
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
    createdAt: '',
    updatedAt: '',
    _synced: false,
    _deleted: false,
    ...overrides,
  }
}

beforeEach(async () => {
  await db.transaction('rw', db.relatedPersons, db.patients, db.syncQueue, async () => {
    await db.relatedPersons.clear()
    await db.patients.clear()
    await db.syncQueue.clear()
  })
  useAuthStore.setState({
    user: null,
    session: null,
    orgId,
    role: 'admin',
    isLoading: false,
  })
})

describe('PatientRelatedPersons', () => {
  it('renders empty state when none exist', async () => {
    render(<PatientRelatedPersons patientId={patientId} />)
    await waitFor(() => {
      expect(screen.getByText(/no related persons recorded/i)).toBeInTheDocument()
    })
  })

  it('lists existing related persons with name and contact info', async () => {
    await dbPut(
      'relatedPersons',
      makeRelatedPerson({
        id: 'rp-1',
        givenName: 'Mary',
        familyName: 'Smith',
        relationship: 'Mother',
        phone: '555-1234',
        email: 'mary@example.com',
      }),
      'insert',
    )

    render(<PatientRelatedPersons patientId={patientId} />)
    await waitFor(() => {
      expect(screen.getByText('Mary Smith')).toBeInTheDocument()
      expect(screen.getByText('Mother')).toBeInTheDocument()
      expect(screen.getByText('555-1234')).toBeInTheDocument()
      expect(screen.getByText('mary@example.com')).toBeInTheDocument()
    })
  })

  it('creates a new related person via the dialog', async () => {
    const user = userEvent.setup()
    render(<PatientRelatedPersons patientId={patientId} />)

    await user.click(await screen.findByRole('button', { name: /new related person/i }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText(/first name/i), 'Bob')
    await user.type(within(dialog).getByLabelText(/last name/i), 'Jones')
    await user.type(within(dialog).getByLabelText(/relationship/i), 'Father')
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByText('Bob Jones')).toBeInTheDocument()
      expect(screen.getByText('Father')).toBeInTheDocument()
    })

    const stored = await db.relatedPersons.toArray()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      givenName: 'Bob',
      familyName: 'Jones',
      relationship: 'Father',
      orgId,
      patientId,
    })
  })

  it('soft-deletes a related person after confirming', async () => {
    await dbPut(
      'relatedPersons',
      makeRelatedPerson({ id: 'rp-del', givenName: 'Old', familyName: 'Contact' }),
      'insert',
    )

    const user = userEvent.setup()
    render(<PatientRelatedPersons patientId={patientId} />)

    await waitFor(() => {
      expect(screen.getByText('Old Contact')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.queryByText('Old Contact')).not.toBeInTheDocument()
    })

    const stored = await db.relatedPersons.get('rp-del')
    expect(stored?._deleted).toBe(true)
  })

  it('renders a router link when linked to another patient', async () => {
    await dbPut(
      'relatedPersons',
      makeRelatedPerson({
        id: 'rp-linked',
        givenName: 'Linked',
        familyName: 'Person',
        linkedPatientId: 'other-patient',
      }),
      'insert',
    )

    render(<PatientRelatedPersons patientId={patientId} />)
    const link = await screen.findByRole('link', { name: /linked person/i })
    expect(link).toHaveAttribute('href', '/patients/other-patient')
  })

  it('renders plain text when not linked', async () => {
    await dbPut(
      'relatedPersons',
      makeRelatedPerson({
        id: 'rp-plain',
        givenName: 'Plain',
        familyName: 'Contact',
        linkedPatientId: null,
      }),
      'insert',
    )

    render(<PatientRelatedPersons patientId={patientId} />)
    await waitFor(() => {
      expect(screen.getByText('Plain Contact')).toBeInTheDocument()
    })
    expect(screen.queryByRole('link', { name: /plain contact/i })).not.toBeInTheDocument()
  })

  it('displays a Primary badge for the primary contact', async () => {
    await dbPut(
      'relatedPersons',
      makeRelatedPerson({
        id: 'rp-primary',
        givenName: 'Top',
        familyName: 'Contact',
        isPrimaryContact: true,
      }),
      'insert',
    )

    render(<PatientRelatedPersons patientId={patientId} />)
    expect(await screen.findByText(/^primary$/i)).toBeInTheDocument()
  })

  it('demotes any existing primary contact when a new one is saved as primary', async () => {
    await dbPut(
      'relatedPersons',
      makeRelatedPerson({
        id: 'rp-old-primary',
        givenName: 'Old',
        familyName: 'Primary',
        isPrimaryContact: true,
      }),
      'insert',
    )

    const user = userEvent.setup()
    render(<PatientRelatedPersons patientId={patientId} />)
    await screen.findByText('Old Primary')

    await user.click(await screen.findByRole('button', { name: /new related person/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/first name/i), 'New')
    await user.type(within(dialog).getByLabelText(/last name/i), 'Primary')
    await user.click(within(dialog).getByLabelText(/mark as primary contact/i))
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await waitFor(async () => {
      const updated = await db.relatedPersons.get('rp-old-primary')
      expect(updated?.isPrimaryContact).toBe(false)
    })

    const newPrimary = (await db.relatedPersons.toArray()).find(
      (r) => r.givenName === 'New' && r.familyName === 'Primary',
    )
    expect(newPrimary?.isPrimaryContact).toBe(true)
  })

  it('does not list the current patient in the link picker', async () => {
    await dbPut('patients', makePatient({ id: patientId, givenName: 'Self', familyName: 'Patient' }), 'insert')
    await dbPut('patients', makePatient({ id: 'other-1', givenName: 'Other', familyName: 'One' }), 'insert')

    const user = userEvent.setup()
    render(<PatientRelatedPersons patientId={patientId} />)

    await user.click(await screen.findByRole('button', { name: /new related person/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByLabelText(/linked patient/i))

    // The picker popover shows in the document; both Self and Other are in Dexie
    // but only "Other One" should appear.
    await waitFor(() => {
      expect(screen.getByText('Other One')).toBeInTheDocument()
    })
    expect(screen.queryByText('Self Patient')).not.toBeInTheDocument()
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { PatientRelatedPersons } from './PatientRelatedPersons'
import type { RelatedPerson } from '@/lib/db/schema'

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
    deletedAt: null,
    createdAt: '',
    updatedAt: '',
    _synced: false,
    _deleted: false,
    ...overrides,
  }
}

beforeEach(async () => {
  await db.transaction('rw', db.relatedPersons, db.syncQueue, async () => {
    await db.relatedPersons.clear()
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
})

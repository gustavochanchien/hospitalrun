import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { PatientAllergies } from './PatientAllergies'

const orgId = 'org-allergies'
const patientId = 'patient-allergies-1'

beforeEach(async () => {
  await db.transaction('rw', db.allergies, db.syncQueue, async () => {
    await db.allergies.clear()
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

describe('PatientAllergies', () => {
  it('renders empty state when no allergies exist', async () => {
    render(<PatientAllergies patientId={patientId} />)
    await waitFor(() => {
      expect(screen.getByText(/no allergies found/i)).toBeInTheDocument()
    })
  })

  it('lists existing allergies for the patient', async () => {
    await dbPut(
      'allergies',
      {
        id: 'a1',
        orgId,
        patientId,
        allergen: 'Penicillin',
        reaction: 'Hives',
        severity: 'severe',
        notedAt: null,
        deletedAt: null,
      },
      'insert',
    )

    render(<PatientAllergies patientId={patientId} />)
    await waitFor(() => {
      expect(screen.getByText('Penicillin')).toBeInTheDocument()
      expect(screen.getByText('Hives')).toBeInTheDocument()
      expect(screen.getByText('severe')).toBeInTheDocument()
    })
  })

  it('hides allergies belonging to other patients', async () => {
    await dbPut(
      'allergies',
      {
        id: 'a-other',
        orgId,
        patientId: 'other-patient',
        allergen: 'Aspirin',
        reaction: null,
        severity: null,
        notedAt: null,
        deletedAt: null,
      },
      'insert',
    )

    render(<PatientAllergies patientId={patientId} />)
    await waitFor(() => {
      expect(screen.getByText(/no allergies found/i)).toBeInTheDocument()
    })
    expect(screen.queryByText('Aspirin')).not.toBeInTheDocument()
  })

  it('hides soft-deleted allergies', async () => {
    await db.allergies.put({
      id: 'a-deleted',
      orgId,
      patientId,
      allergen: 'Latex',
      reaction: null,
      severity: null,
      notedAt: null,
      deletedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _synced: true,
      _deleted: true,
    })

    render(<PatientAllergies patientId={patientId} />)
    await waitFor(() => {
      expect(screen.getByText(/no allergies found/i)).toBeInTheDocument()
    })
  })

  it('creates a new allergy via the dialog', async () => {
    const user = userEvent.setup()
    render(<PatientAllergies patientId={patientId} />)

    await user.click(await screen.findByRole('button', { name: /new allergy/i }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText(/allergen/i), 'Peanuts')
    await user.type(within(dialog).getByLabelText(/reaction/i), 'Anaphylaxis')
    await user.click(within(dialog).getByRole('button', { name: /create allergy/i }))

    await waitFor(() => {
      expect(screen.getByText('Peanuts')).toBeInTheDocument()
      expect(screen.getByText('Anaphylaxis')).toBeInTheDocument()
    })

    const stored = await db.allergies.toArray()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ allergen: 'Peanuts', orgId, patientId })
  })

  it('soft-deletes an allergy after confirming the dialog', async () => {
    await dbPut(
      'allergies',
      {
        id: 'a-del-1',
        orgId,
        patientId,
        allergen: 'Shellfish',
        reaction: null,
        severity: 'mild',
        notedAt: null,
        deletedAt: null,
      },
      'insert',
    )

    const user = userEvent.setup()
    render(<PatientAllergies patientId={patientId} />)

    await waitFor(() => {
      expect(screen.getByText('Shellfish')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    const confirmDialog = await screen.findByRole('alertdialog')
    await user.click(within(confirmDialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.queryByText('Shellfish')).not.toBeInTheDocument()
    })

    const stored = await db.allergies.get('a-del-1')
    expect(stored?._deleted).toBe(true)
  })
})

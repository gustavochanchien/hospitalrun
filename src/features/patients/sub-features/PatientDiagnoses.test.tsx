import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { PatientDiagnoses } from './PatientDiagnoses'

const orgId = 'org-dx'
const patientId = 'patient-dx-1'

beforeEach(async () => {
  await db.transaction('rw', db.diagnoses, db.syncQueue, async () => {
    await db.diagnoses.clear()
    await db.syncQueue.clear()
  })
  useAuthStore.setState({
    user: null,
    session: null,
    orgId,
    role: 'doctor',
    isLoading: false,
  })
})

describe('PatientDiagnoses', () => {
  it('renders empty state when no diagnoses exist', async () => {
    render(<PatientDiagnoses patientId={patientId} />)
    await waitFor(() => {
      expect(screen.getByText(/no diagnoses found/i)).toBeInTheDocument()
    })
  })

  it('lists existing diagnoses with ICD code, description, and status badge', async () => {
    await dbPut(
      'diagnoses',
      {
        id: 'dx-1',
        orgId,
        patientId,
        icdCode: 'J06.9',
        description: 'Acute upper respiratory infection',
        status: 'active',
        diagnosedAt: null,
        diagnosedBy: 'Dr. House',
        onsetDate: null,
        abatementDate: null,
        notes: null,
        deletedAt: null,
      },
      'insert',
    )

    render(<PatientDiagnoses patientId={patientId} />)
    await waitFor(() => {
      expect(screen.getByText('J06.9')).toBeInTheDocument()
      expect(screen.getByText('Acute upper respiratory infection')).toBeInTheDocument()
      expect(screen.getByText('Dr. House')).toBeInTheDocument()
      expect(screen.getByText('active')).toBeInTheDocument()
    })
  })

  it('creates a diagnosis via the dialog (description required)', async () => {
    const user = userEvent.setup()
    render(<PatientDiagnoses patientId={patientId} />)

    await user.click(await screen.findByRole('button', { name: /new diagnosis/i }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText(/icd code/i), 'I10')
    await user.type(within(dialog).getByLabelText(/^description$/i), 'Essential hypertension')
    await user.click(within(dialog).getByRole('button', { name: /create diagnosis/i }))

    await waitFor(() => {
      expect(screen.getByText('I10')).toBeInTheDocument()
      expect(screen.getByText('Essential hypertension')).toBeInTheDocument()
    })

    const stored = await db.diagnoses.toArray()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      icdCode: 'I10',
      description: 'Essential hypertension',
      orgId,
      patientId,
    })
  })

  it('soft-deletes a diagnosis after confirming', async () => {
    await dbPut(
      'diagnoses',
      {
        id: 'dx-del',
        orgId,
        patientId,
        icdCode: 'X1',
        description: 'To delete',
        status: null,
        diagnosedAt: null,
        diagnosedBy: null,
        onsetDate: null,
        abatementDate: null,
        notes: null,
        deletedAt: null,
      },
      'insert',
    )

    const user = userEvent.setup()
    render(<PatientDiagnoses patientId={patientId} />)

    await waitFor(() => expect(screen.getByText('To delete')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.queryByText('To delete')).not.toBeInTheDocument()
    })

    const stored = await db.diagnoses.get('dx-del')
    expect(stored?._deleted).toBe(true)
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { PatientDiagnoses } from './PatientDiagnoses'

vi.mock('@/lib/code-systems/loader', () => ({
  ensureCodeSystemLoaded: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/code-systems/search', () => ({
  searchCodes: vi.fn().mockResolvedValue([
    { id: 'icd10:I10', system: 'icd10', code: 'I10', display: 'Essential hypertension', searchText: 'i10 essential hypertension' },
  ]),
}))

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

  it('renders CodeSearchCombobox for the ICD code field', async () => {
    const user = userEvent.setup()
    render(<PatientDiagnoses patientId={patientId} />)

    await user.click(await screen.findByRole('button', { name: /new diagnosis/i }))
    const dialog = await screen.findByRole('dialog')

    // The ICD code field is a combobox trigger button, not a plain input
    const icdTrigger = within(dialog).getByLabelText(/icd code/i)
    expect(icdTrigger.tagName).toBe('BUTTON')
  })

  it('creates a diagnosis via the dialog — selects ICD code from combobox', async () => {
    const user = userEvent.setup()
    render(<PatientDiagnoses patientId={patientId} />)

    await user.click(await screen.findByRole('button', { name: /new diagnosis/i }))
    const dialog = await screen.findByRole('dialog')

    // Open the ICD combobox and pick the mocked I10 result
    await user.click(within(dialog).getByLabelText(/icd code/i))
    // The combobox popover renders a search input with the ICD placeholder
    const searchInput = await screen.findByPlaceholderText(/search icd-10/i)
    await user.type(searchInput, 'I10')

    await waitFor(() => expect(screen.getByText('I10')).toBeInTheDocument())
    await user.click(screen.getByText('I10').closest('button')!)

    // Description is auto-filled from selected code display; type description if not auto-filled
    const descField = within(dialog).getByLabelText(/^description$/i)
    if (!(descField as HTMLTextAreaElement).value) {
      await user.type(descField, 'Essential hypertension')
    }

    await user.click(within(dialog).getByRole('button', { name: /create diagnosis/i }))

    await waitFor(() => {
      expect(screen.getByText('I10')).toBeInTheDocument()
    })

    const stored = await db.diagnoses.toArray()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      icdCode: 'I10',
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

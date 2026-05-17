import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { PatientMedications } from './PatientMedications'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}))

vi.mock('@/lib/drug-interactions/checker', () => ({
  checkInteractions: vi.fn().mockResolvedValue([]),
  _resetInteractionCache: vi.fn(),
}))
vi.mock('@/lib/drug-interactions/openfda', () => ({
  fetchOpenFdaInteractionText: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn().mockReturnValue(true),
}))

import { checkInteractions } from '@/lib/drug-interactions/checker'

const mockCheck = vi.mocked(checkInteractions)

const orgId = 'org-meds'
const patientId = 'patient-meds-1'

const BASE_MED = {
  visitId: null as null,
  status: 'active' as const,
  intent: null as null,
  priority: null as null,
  quantity: null as null,
  requestedBy: null as null,
  startDate: null as null,
  endDate: null as null,
  notes: null as null,
  inventoryItemId: null as null,
  deletedAt: null as null,
}

beforeEach(async () => {
  await db.transaction('rw', db.medications, db.syncQueue, async () => {
    await db.medications.clear()
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

describe('PatientMedications', () => {
  it('renders empty state when no medications exist', async () => {
    render(<PatientMedications patientId={patientId} />)
    await waitFor(() => {
      expect(screen.getByText(/no medications found/i)).toBeInTheDocument()
    })
  })

  it('lists existing medications with name and status badge', async () => {
    await dbPut('medications', { ...BASE_MED, id: 'med-1', orgId, patientId, name: 'Warfarin 5mg' }, 'insert')

    render(<PatientMedications patientId={patientId} />)
    await waitFor(() => {
      expect(screen.getByText('Warfarin 5mg')).toBeInTheDocument()
    })
  })

  it('mounts DrugInteractionAlert with active medications', async () => {
    await dbPut('medications', { ...BASE_MED, id: 'med-w', orgId, patientId, name: 'Warfarin 5mg' }, 'insert')
    await dbPut('medications', { ...BASE_MED, id: 'med-a', orgId, patientId, name: 'Aspirin 81mg' }, 'insert')

    render(<PatientMedications patientId={patientId} />)

    await waitFor(() => {
      expect(mockCheck).toHaveBeenCalledWith(
        expect.arrayContaining(['Warfarin 5mg', 'Aspirin 81mg']),
      )
    })
  })

  it('shows interaction alert when checkInteractions returns results', async () => {
    mockCheck.mockResolvedValue([
      { drug1: 'Warfarin 5mg', drug2: 'Aspirin 81mg', severity: 'major', description: 'Bleeding risk' },
    ])

    await dbPut('medications', { ...BASE_MED, id: 'med-w2', orgId, patientId, name: 'Warfarin 5mg' }, 'insert')
    await dbPut('medications', { ...BASE_MED, id: 'med-a2', orgId, patientId, name: 'Aspirin 81mg' }, 'insert')

    render(<PatientMedications patientId={patientId} />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Bleeding risk')).toBeInTheDocument()
    })
  })

  it('creates a medication via the dialog', async () => {
    const user = userEvent.setup()
    render(<PatientMedications patientId={patientId} />)

    await user.click(await screen.findByRole('button', { name: /new medication/i }))
    const dialog = await screen.findByRole('dialog')

    const nameInput = dialog.querySelector('input[id="med-name"]') ?? screen.getByRole('textbox')
    await user.type(nameInput, 'Metformin 500mg')
    await user.click(within(dialog).getByRole('button', { name: /create medication/i }))

    await waitFor(() => {
      expect(screen.getByText('Metformin 500mg')).toBeInTheDocument()
    })
  })
})

import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DrugInteractionAlert } from './drug-interaction-alert'
import type { Medication } from '@/lib/db/schema'

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
import { fetchOpenFdaInteractionText } from '@/lib/drug-interactions/openfda'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

const mockCheck = vi.mocked(checkInteractions)
const mockOpenFda = vi.mocked(fetchOpenFdaInteractionText)
const mockOnline = vi.mocked(useOnlineStatus)

function makeMed(name: string, id = name): Medication {
  return {
    id,
    orgId: 'org',
    patientId: 'p1',
    visitId: null,
    name,
    status: 'active',
    intent: null,
    priority: null,
    quantity: null,
    requestedBy: null,
    startDate: null,
    endDate: null,
    notes: null,
    inventoryItemId: null,
    deletedAt: null,
    _synced: true,
    _deleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

beforeEach(() => {
  mockCheck.mockResolvedValue([])
  mockOpenFda.mockResolvedValue(null)
  mockOnline.mockReturnValue(true)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('DrugInteractionAlert', () => {
  it('renders nothing when there are no interactions', async () => {
    mockCheck.mockResolvedValue([])
    const { container } = render(
      <DrugInteractionAlert activeMedications={[makeMed('Warfarin'), makeMed('Aspirin')]} />,
    )
    await waitFor(() => expect(mockCheck).toHaveBeenCalled())
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 2 medications', async () => {
    // checkInteractions returns [] for < 2 meds, so the alert should not render
    mockCheck.mockResolvedValue([])
    const { container } = render(
      <DrugInteractionAlert activeMedications={[makeMed('Warfarin')]} />,
    )
    await waitFor(() => expect(mockCheck).toHaveBeenCalled())
    expect(container.firstChild).toBeNull()
  })

  it('renders a warning alert when an interaction is found', async () => {
    mockCheck.mockResolvedValue([
      { drug1: 'Warfarin 5mg', drug2: 'Aspirin 81mg', severity: 'major', description: 'Bleeding risk' },
    ])

    render(
      <DrugInteractionAlert activeMedications={[makeMed('Warfarin 5mg'), makeMed('Aspirin 81mg')]} />,
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Warfarin 5mg')).toBeInTheDocument()
      expect(screen.getByText('Aspirin 81mg')).toBeInTheDocument()
      expect(screen.getByText('Bleeding risk')).toBeInTheDocument()
    })
  })

  it('shows the correct severity badge', async () => {
    mockCheck.mockResolvedValue([
      { drug1: 'Simvastatin', drug2: 'Clarithromycin', severity: 'contraindicated', description: 'Myopathy risk' },
    ])

    render(
      <DrugInteractionAlert activeMedications={[makeMed('Simvastatin'), makeMed('Clarithromycin')]} />,
    )

    await waitFor(() => {
      expect(screen.getByText(/contraindicated/i)).toBeInTheDocument()
    })
  })

  it('bolds the highlighted medication name', async () => {
    mockCheck.mockResolvedValue([
      { drug1: 'Warfarin 5mg', drug2: 'Aspirin 81mg', severity: 'major', description: 'Bleeding risk' },
    ])

    render(
      <DrugInteractionAlert
        activeMedications={[makeMed('Warfarin 5mg'), makeMed('Aspirin 81mg')]}
        highlightMedName="Warfarin 5mg"
      />,
    )

    await waitFor(() => {
      const bold = screen.getByText('Warfarin 5mg').closest('strong')
      expect(bold).toBeInTheDocument()
    })
  })

  it('shows offline note when !isOnline and interactions exist', async () => {
    mockOnline.mockReturnValue(false)
    mockCheck.mockResolvedValue([
      { drug1: 'Warfarin', drug2: 'Aspirin', severity: 'major', description: 'Risk' },
    ])

    render(
      <DrugInteractionAlert activeMedications={[makeMed('Warfarin'), makeMed('Aspirin')]} />,
    )

    const user = userEvent.setup()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    // expand to see offline note
    await user.click(screen.getByRole('button', { name: /view prescribing info/i }))

    await waitFor(() => {
      expect(screen.getByText(/connect to internet/i)).toBeInTheDocument()
    })
  })

  it('fetches and displays OpenFDA text when expanded while online', async () => {
    mockOnline.mockReturnValue(true)
    mockCheck.mockResolvedValue([
      { drug1: 'Warfarin', drug2: 'Aspirin', severity: 'major', description: 'Risk' },
    ])
    mockOpenFda.mockResolvedValue('Warfarin interacts with many drugs including aspirin.')

    const user = userEvent.setup()
    render(
      <DrugInteractionAlert activeMedications={[makeMed('Warfarin'), makeMed('Aspirin')]} />,
    )

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /view prescribing info/i }))

    await waitFor(() => {
      expect(screen.getByText(/warfarin interacts with many drugs/i)).toBeInTheDocument()
    })
  })
})

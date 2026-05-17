import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { PatientTrends } from './PatientTrends'

const orgId = 'org-trends'
const patientId = 'patient-trends'

beforeEach(async () => {
  vi.restoreAllMocks()
  await db.transaction(
    'rw',
    [db.vitals, db.labs, db.patients, db.syncQueue, db.orgRoles],
    async () => {
      await db.vitals.clear()
      await db.labs.clear()
      await db.patients.clear()
      await db.syncQueue.clear()
      await db.orgRoles.clear()
    },
  )
  useAuthStore.setState({
    user: { id: 'author-1' } as never,
    session: null,
    orgId,
    role: 'doctor',
    isLoading: false,
  })
  await dbPut(
    'patients',
    {
      id: patientId,
      orgId,
      mrn: 'MRN-T',
      givenName: 'Trend',
      familyName: 'Patient',
      status: 'active',
      deletedAt: null,
    } as never,
    'insert',
  )
  // ResizeObserver polyfilled in test setup; mock recharts ResponsiveContainer-friendly size.
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { value: 600, configurable: true })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { value: 400, configurable: true })
})

describe('PatientTrends', () => {
  it('shows the empty state when no numeric data is present', async () => {
    render(<PatientTrends patientId={patientId} />)
    expect(await screen.findByText(/no numeric vitals or lab results/i)).toBeInTheDocument()
  })

  it('lets the user pick a vital field and shows the chart', async () => {
    const user = userEvent.setup()
    await dbPut(
      'vitals',
      {
        id: 'v-1',
        orgId,
        patientId,
        visitId: null,
        recordedAt: '2026-01-01T10:00:00.000Z',
        recordedBy: null,
        heartRate: 72,
        deletedAt: null,
      } as never,
      'insert',
    )
    await dbPut(
      'vitals',
      {
        id: 'v-2',
        orgId,
        patientId,
        visitId: null,
        recordedAt: '2026-01-08T10:00:00.000Z',
        recordedBy: null,
        heartRate: 80,
        deletedAt: null,
      } as never,
      'insert',
    )
    render(<PatientTrends patientId={patientId} />)
    expect(await screen.findByText(/choose measurements/i)).toBeInTheDocument()
    expect(screen.getByText(/choose 1 to 3 measurements/i)).toBeInTheDocument()
    const checkbox = await screen.findByRole('checkbox', { name: /heart rate/i })
    await user.click(checkbox)
    expect(await screen.findByTestId('trend-chart')).toBeInTheDocument()
  })

  it('caps selection at 3 series', async () => {
    const user = userEvent.setup()
    await dbPut(
      'vitals',
      {
        id: 'v-1',
        orgId,
        patientId,
        visitId: null,
        recordedAt: '2026-01-01T10:00:00.000Z',
        recordedBy: null,
        heartRate: 72,
        systolic: 120,
        diastolic: 80,
        respiratoryRate: 16,
        deletedAt: null,
      } as never,
      'insert',
    )
    render(<PatientTrends patientId={patientId} />)
    await user.click(await screen.findByRole('checkbox', { name: /heart rate/i }))
    await user.click(screen.getByRole('checkbox', { name: /systolic/i }))
    await user.click(screen.getByRole('checkbox', { name: /diastolic/i }))
    const respiratory = screen.getByRole('checkbox', { name: /respiratory/i })
    expect(respiratory).toBeDisabled()
  })

  it('includes lab series that have a numericValue', async () => {
    await dbPut(
      'labs',
      {
        id: 'l-1',
        orgId,
        patientId,
        visitId: null,
        code: 'GLU',
        type: 'glucose',
        status: 'completed',
        requestedBy: null,
        requestedAt: '2026-01-01T10:00:00.000Z',
        completedAt: '2026-01-01T11:00:00.000Z',
        canceledAt: null,
        result: '5.4 mmol/L',
        numericValue: 5.4,
        unit: 'mmol/L',
        notes: null,
        deletedAt: null,
      } as never,
      'insert',
    )
    render(<PatientTrends patientId={patientId} />)
    expect(await screen.findByText(/GLU.*glucose/i)).toBeInTheDocument()
  })
})

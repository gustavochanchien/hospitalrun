import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { PatientVitals } from './PatientVitals'

const orgId = 'org-vitals'
const adultPatientId = 'patient-adult'
const childPatientId = 'patient-child'

const sampleReference = {
  sex: 'boys',
  ageRange: '0-2',
  ageUnit: 'months',
  percentiles: [3, 15, 50, 85, 97],
  metrics: {
    weight: {
      unit: 'kg',
      rows: [
        [0, 2.5, 2.9, 3.3, 3.9, 4.3],
        [6, 6.4, 7.1, 7.9, 8.8, 9.7],
        [12, 7.7, 8.6, 9.6, 10.7, 11.8],
        [24, 9.7, 10.8, 12.2, 13.6, 14.8],
      ],
    },
    height: {
      unit: 'cm',
      rows: [
        [0, 46.0, 48.0, 49.9, 51.8, 53.7],
        [12, 71.0, 73.4, 75.7, 78.0, 80.5],
        [24, 81.7, 84.1, 87.1, 90.0, 92.9],
      ],
    },
    headCircumference: {
      unit: 'cm',
      rows: [
        [0, 32.6, 33.5, 34.5, 35.5, 36.5],
        [12, 44.4, 45.3, 46.4, 47.4, 48.4],
        [24, 47.0, 47.9, 49.0, 50.0, 51.0],
      ],
    },
  },
}

beforeEach(async () => {
  vi.restoreAllMocks()
  await db.transaction('rw', db.vitals, db.patients, db.syncQueue, db.orgRoles, async () => {
    await db.vitals.clear()
    await db.patients.clear()
    await db.syncQueue.clear()
    await db.orgRoles.clear()
  })
  useAuthStore.setState({
    user: { id: 'author-1' } as never,
    session: null,
    orgId,
    role: 'doctor',
    isLoading: false,
  })
  // Adult patient (45 y/o, male) — not eligible for growth chart
  await dbPut(
    'patients',
    {
      id: adultPatientId,
      orgId,
      mrn: 'MRN-AD',
      givenName: 'Adult',
      familyName: 'Test',
      sex: 'male',
      dateOfBirth: '1980-06-01',
      status: 'active',
      deletedAt: null,
    } as never,
    'insert',
  )
  // Pediatric patient (1y/o, male) — eligible for growth chart
  const dob = new Date()
  dob.setFullYear(dob.getFullYear() - 1)
  await dbPut(
    'patients',
    {
      id: childPatientId,
      orgId,
      mrn: 'MRN-CH',
      givenName: 'Child',
      familyName: 'Test',
      sex: 'male',
      dateOfBirth: dob.toISOString().slice(0, 10),
      status: 'active',
      deletedAt: null,
    } as never,
    'insert',
  )
  // Mock fetch for WHO growth-chart JSON
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => sampleReference,
  })) as never
})

describe('PatientVitals', () => {
  it('renders empty state when no vitals exist', async () => {
    render(<PatientVitals patientId={adultPatientId} />)
    expect(await screen.findByText(/no vitals recorded/i)).toBeInTheDocument()
  })

  it('rejects an empty submit and requires at least one measurement', async () => {
    const user = userEvent.setup()
    render(<PatientVitals patientId={adultPatientId} />)

    await user.click(await screen.findByRole('button', { name: /record vitals/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /enter at least one measurement/i,
    )
    expect(await db.vitals.count()).toBe(0)
  })

  it('saves a reading with valid numeric inputs', async () => {
    const user = userEvent.setup()
    render(<PatientVitals patientId={adultPatientId} />)

    await user.click(await screen.findByRole('button', { name: /record vitals/i }))
    const dialog = await screen.findByRole('dialog')
    const heartRate = within(dialog).getByLabelText(/heart rate/i)
    await user.type(heartRate, '72')
    const temperature = within(dialog).getByLabelText(/temperature/i)
    await user.type(temperature, '36.7')
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await waitFor(async () => {
      expect(await db.vitals.count()).toBe(1)
    })
    const [reading] = await db.vitals.toArray()
    expect(reading).toMatchObject({
      patientId: adultPatientId,
      heartRate: 72,
      temperatureC: 36.7,
      orgId,
      recordedBy: 'author-1',
    })
  })

  it('rejects partial blood-pressure inputs', async () => {
    const user = userEvent.setup()
    render(<PatientVitals patientId={adultPatientId} />)

    await user.click(await screen.findByRole('button', { name: /record vitals/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/systolic/i), '120')
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /both systolic and diastolic/i,
    )
    expect(await db.vitals.count()).toBe(0)
  })

  it('rejects out-of-range oxygen saturation', async () => {
    const user = userEvent.setup()
    render(<PatientVitals patientId={adultPatientId} />)

    await user.click(await screen.findByRole('button', { name: /record vitals/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/oxygen saturation/i), '120')
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/outside the expected/i)
  })

  it('hides the growth chart when the patient is an adult', async () => {
    render(<PatientVitals patientId={adultPatientId} />)
    expect(
      await screen.findByText(/growth charts are shown for patients under 19/i),
    ).toBeInTheDocument()
  })

  it('shows the growth chart for an eligible pediatric patient', async () => {
    render(<PatientVitals patientId={childPatientId} />)
    // The card title + the per-card placeholder appear once data loads.
    await waitFor(() => {
      expect(screen.getByTestId('growth-chart-card')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  it('denies access when the role lacks read:vitals', async () => {
    // Seed an orgRole row that explicitly drops read:vitals for the user role.
    await db.orgRoles.add({
      id: 'role-locked',
      orgId,
      roleKey: 'locked',
      label: 'Locked',
      permissions: ['read:patients'],
      isBuiltin: false,
      isLocked: false,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _synced: true,
      _deleted: false,
    } as never)
    useAuthStore.setState((s) => ({ ...s, role: 'locked' }))
    render(<PatientVitals patientId={adultPatientId} />)
    expect(
      await screen.findByText(/do not have permission to view vitals/i),
    ).toBeInTheDocument()
  })
})

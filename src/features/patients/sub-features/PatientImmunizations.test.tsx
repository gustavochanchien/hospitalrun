import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { PatientImmunizations } from './PatientImmunizations'
import { FeatureGate } from '@/components/ui/feature-gate'

const orgId = 'org-imm'
const patientId = 'patient-imm-1'

beforeEach(async () => {
  vi.restoreAllMocks()
  await db.transaction(
    'rw',
    db.immunizations,
    db.patients,
    db.syncQueue,
    db.orgRoles,
    async () => {
      await db.immunizations.clear()
      await db.patients.clear()
      await db.syncQueue.clear()
      await db.orgRoles.clear()
    },
  )
  useAuthStore.setState({
    user: { id: 'nurse-1' } as never,
    session: null,
    orgId,
    role: 'nurse',
    isLoading: false,
  })
  await dbPut(
    'patients',
    {
      id: patientId,
      orgId,
      mrn: 'MRN-IMM',
      givenName: 'Imm',
      familyName: 'Test',
      sex: 'male',
      dateOfBirth: '2024-01-01',
      status: 'active',
      deletedAt: null,
    } as never,
    'insert',
  )
})

describe('PatientImmunizations', () => {
  it('renders empty state when no immunizations exist', async () => {
    render(<PatientImmunizations patientId={patientId} />)
    expect(await screen.findByText(/no immunizations recorded/i)).toBeInTheDocument()
  })

  it('rejects submit when vaccine name is missing', async () => {
    const user = userEvent.setup()
    render(<PatientImmunizations patientId={patientId} />)

    await user.click(await screen.findByRole('button', { name: /record immunization/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /vaccine name is required/i,
    )
    expect(await db.immunizations.count()).toBe(0)
  })

  it('saves an immunization with valid inputs (round-trip)', async () => {
    const user = userEvent.setup()
    render(<PatientImmunizations patientId={patientId} />)

    await user.click(await screen.findByRole('button', { name: /record immunization/i }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText(/vaccine name/i), 'BCG')
    await user.type(within(dialog).getByLabelText(/dose #/i), '1')
    await user.type(within(dialog).getByLabelText(/lot number/i), 'LOT-1234')
    // next-due is optional; leave blank
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await waitFor(async () => {
      expect(await db.immunizations.count()).toBe(1)
    })
    const [row] = await db.immunizations.toArray()
    expect(row).toMatchObject({
      patientId,
      vaccineName: 'BCG',
      doseNumber: 1,
      lotNumber: 'LOT-1234',
      orgId,
      administeredBy: 'nurse-1',
    })
    // List shows the saved record
    await waitFor(() => {
      expect(screen.getByText('BCG')).toBeInTheDocument()
    })
  })

  it('rejects a next-due date that is before the administration date', async () => {
    const user = userEvent.setup()
    render(<PatientImmunizations patientId={patientId} />)

    await user.click(await screen.findByRole('button', { name: /record immunization/i }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText(/vaccine name/i), 'OPV')
    // administeredAt has a default (now). Set nextDueAt to a date in the past.
    const nextDue = within(dialog).getByLabelText(/next dose due/i)
    await user.clear(nextDue)
    await user.type(nextDue, '2000-01-01')

    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /next-due date must be after/i,
    )
    expect(await db.immunizations.count()).toBe(0)
  })

  it('persists nextDueAt so the recall board can read it', async () => {
    const user = userEvent.setup()
    render(<PatientImmunizations patientId={patientId} />)

    await user.click(await screen.findByRole('button', { name: /record immunization/i }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText(/vaccine name/i), 'Penta')
    // future next-due date
    const future = new Date()
    future.setFullYear(future.getFullYear() + 1)
    const iso = future.toISOString().slice(0, 10)
    await user.type(within(dialog).getByLabelText(/next dose due/i), iso)

    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await waitFor(async () => {
      expect(await db.immunizations.count()).toBe(1)
    })
    const [row] = await db.immunizations.toArray()
    expect(row.nextDueAt).toBeTruthy()
    expect(new Date(row.nextDueAt as string).getTime()).toBeGreaterThan(Date.now())
  })

  it('denies access when the role lacks read:immunizations', async () => {
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
    render(<PatientImmunizations patientId={patientId} />)
    expect(
      await screen.findByText(/do not have permission to view immunizations/i),
    ).toBeInTheDocument()
  })

  it('FeatureGate hides the sub-feature until the immunizations feature is enabled', async () => {
    await db.transaction('rw', db.orgFeatures, db.userFeatures, db.syncQueue, async () => {
      await db.orgFeatures.clear()
      await db.userFeatures.clear()
    })
    // Admins still need org enablement; ensure feature is OFF.
    useAuthStore.setState((s) => ({ ...s, role: 'admin' }))

    render(
      <FeatureGate
        feature="immunizations"
        fallback={<p data-testid="feature-fallback">Disabled</p>}
      >
        <PatientImmunizations patientId={patientId} />
      </FeatureGate>,
    )
    expect(await screen.findByTestId('feature-fallback')).toBeInTheDocument()
    expect(screen.queryByText(/no immunizations recorded/i)).not.toBeInTheDocument()

    // Now enable for the org — admin bypasses user grant.
    await dbPut(
      'orgFeatures',
      {
        id: 'orgf-imm',
        orgId,
        feature: 'immunizations',
        enabled: true,
        deletedAt: null,
      } as never,
      'insert',
    )
    await waitFor(() => {
      expect(screen.getByText(/no immunizations recorded/i)).toBeInTheDocument()
    })
  })

  it('hides the "Record immunization" button when the role lacks write:immunizations', async () => {
    // Read-only role: has read:immunizations but not write.
    await db.orgRoles.add({
      id: 'role-readonly',
      orgId,
      roleKey: 'readonly',
      label: 'Read Only',
      permissions: ['read:patients', 'read:immunizations'],
      isBuiltin: false,
      isLocked: false,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _synced: true,
      _deleted: false,
    } as never)
    useAuthStore.setState((s) => ({ ...s, role: 'readonly' }))
    render(<PatientImmunizations patientId={patientId} />)
    expect(await screen.findByText(/no immunizations recorded/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /record immunization/i }),
    ).not.toBeInTheDocument()
  })
})

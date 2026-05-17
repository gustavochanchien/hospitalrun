import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import type { InventoryItem, Patient } from '@/lib/db/schema'
import { useAuthStore } from '@/features/auth/auth.store'

vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => true,
}))

vi.mock('@/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: () => true,
  useEnabledFeatures: () => ['pharmacy'],
}))

vi.mock('@/components/pdf-export-button', () => ({
  PdfExportButton: ({ label }: { label: string }) => <button>{label}</button>,
}))

import { WalkInDispenseForm } from './WalkInDispenseForm'

const orgId = 'org-walkin'

function makeItem(o: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'item-1',
    orgId,
    sku: 'PARA-500',
    name: 'Paracetamol 500mg',
    description: null,
    unit: 'tabs',
    onHand: 100,
    reorderLevel: 10,
    unitCost: 0.1,
    currency: 'USD',
    active: true,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _synced: true,
    _deleted: false,
    ...o,
  }
}

function makePatient(o: Partial<Patient> = {}): Patient {
  return {
    id: 'pat-walkin',
    orgId,
    mrn: 'MRN-A1',
    prefix: null,
    givenName: 'Maria',
    familyName: 'Garcia',
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _synced: true,
    _deleted: false,
    ...o,
  }
}

beforeEach(async () => {
  useAuthStore.setState({
    user: { id: 'u-1', email: 'pharmacist@example.com' } as never,
    session: null,
    orgId,
    role: 'pharmacist',
    isLoading: false,
  })
  await db.transaction(
    'rw',
    [
      db.medications,
      db.inventoryItems,
      db.inventoryTransactions,
      db.patients,
      db.syncQueue,
    ],
    async () => {
      await db.medications.clear()
      await db.inventoryItems.clear()
      await db.inventoryTransactions.clear()
      await db.patients.clear()
      await db.syncQueue.clear()
    },
  )
})

describe('WalkInDispenseForm', () => {
  it('records a walk-in dispense and decrements stock', async () => {
    const user = userEvent.setup()
    await db.inventoryItems.put(makeItem({ onHand: 50 }))
    await db.patients.put(makePatient())

    render(<WalkInDispenseForm />)

    // Pick patient via popover
    const patientInput = screen.getByPlaceholderText(/search patients/i)
    await user.click(patientInput)
    await user.type(patientInput, 'Maria')
    const patientOption = await screen.findByRole('button', {
      name: /Maria Garcia/,
    })
    await user.click(patientOption)

    // Pick inventory item (Radix Select — target by label id)
    await user.click(screen.getByLabelText(/inventory item/i))
    const itemOption = await screen.findByRole('option', {
      name: /Paracetamol 500mg/,
    })
    await user.click(itemOption)

    // Quantity defaults to 1 — change to 5
    const qtyInput = screen.getByLabelText(/quantity/i)
    await user.clear(qtyInput)
    await user.type(qtyInput, '5')

    await user.click(screen.getByRole('button', { name: /record dispense/i }))

    await waitFor(async () => {
      const item = await db.inventoryItems.get('item-1')
      expect(item?.onHand).toBe(45)
    })

    const meds = await db.medications.toArray()
    expect(meds).toHaveLength(1)
    expect(meds[0].status).toBe('completed')
    expect(meds[0].patientId).toBe('pat-walkin')
    expect(meds[0].inventoryItemId).toBe('item-1')

    const txs = await db.inventoryTransactions.toArray()
    expect(txs).toHaveLength(1)
    expect(txs[0].kind).toBe('dispense')
    expect(txs[0].quantity).toBe(5)
  })
})

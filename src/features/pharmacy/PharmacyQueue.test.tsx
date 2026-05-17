import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { db } from '@/lib/db'
import type { InventoryItem, Medication, Patient } from '@/lib/db/schema'

vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => true,
}))

vi.mock('@/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: () => true,
  useEnabledFeatures: () => ['pharmacy'],
}))

vi.mock('./DispenseDialog', () => ({
  DispenseDialog: () => null,
}))

import { PharmacyQueue } from './PharmacyQueue'

const orgId = 'org-queue'

function makeItem(o: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: crypto.randomUUID(),
    orgId,
    sku: 'AMOX-500',
    name: 'Amoxicillin 500mg',
    description: null,
    unit: 'caps',
    onHand: 100,
    reorderLevel: 10,
    unitCost: 0.5,
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

function makeMed(o: Partial<Medication> = {}): Medication {
  return {
    id: crypto.randomUUID(),
    orgId,
    patientId: 'pat-1',
    visitId: null,
    name: 'Amoxicillin 500mg',
    status: 'active',
    intent: 'order',
    priority: 'routine',
    quantity: '30',
    requestedBy: null,
    startDate: null,
    endDate: null,
    notes: null,
    inventoryItemId: null,
    dosageInstructions: null,
    route: null,
    frequency: null,
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
    id: 'pat-1',
    orgId,
    mrn: 'MRN-001',
    prefix: null,
    givenName: 'Alice',
    familyName: 'Smith',
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
  await db.transaction(
    'rw',
    db.medications,
    db.inventoryItems,
    db.patients,
    async () => {
      await db.medications.clear()
      await db.inventoryItems.clear()
      await db.patients.clear()
    },
  )
})

describe('PharmacyQueue', () => {
  it('shows the empty state when no eligible medications exist', async () => {
    render(<PharmacyQueue />)
    expect(
      await screen.findByText(/no medications are ready to dispense/i),
    ).toBeInTheDocument()
  })

  it('lists active medications with linked inventory items', async () => {
    const item = makeItem({ name: 'Amox 500', onHand: 25 })
    await db.inventoryItems.put(item)
    await db.patients.put(makePatient())
    await db.medications.bulkPut([
      makeMed({ inventoryItemId: item.id, name: 'Amoxicillin 500mg' }),
      makeMed({ status: 'completed', inventoryItemId: item.id }),
      makeMed({ status: 'active', inventoryItemId: null }),
    ])

    render(<PharmacyQueue />)
    expect(await screen.findByText('Amoxicillin 500mg')).toBeInTheDocument()
    expect(await screen.findByText('Alice Smith')).toBeInTheDocument()
    expect(await screen.findByText('Amox 500')).toBeInTheDocument()
    expect(await screen.findByText(/25\.00 caps/)).toBeInTheDocument()
    // Only one row → only one dispense button
    expect(screen.getAllByRole('button', { name: /dispense/i })).toHaveLength(1)
  })
})

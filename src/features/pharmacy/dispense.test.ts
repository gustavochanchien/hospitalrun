import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import type { InventoryItem, Medication } from '@/lib/db/schema'
import { dispenseMedication } from './dispense'

const orgId = 'org-dispense'

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
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
    ...overrides,
  }
}

function makeMed(overrides: Partial<Medication> = {}): Medication {
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
    ...overrides,
  }
}

beforeEach(async () => {
  await db.transaction(
    'rw',
    db.medications,
    db.inventoryItems,
    db.inventoryTransactions,
    db.syncQueue,
    async () => {
      await db.medications.clear()
      await db.inventoryItems.clear()
      await db.inventoryTransactions.clear()
      await db.syncQueue.clear()
    },
  )
})

describe('dispenseMedication — queue', () => {
  it('flips medication to completed and decrements on-hand', async () => {
    const item = makeItem({ onHand: 30 })
    await db.inventoryItems.put(item)
    const med = makeMed({ inventoryItemId: item.id })
    await db.medications.put(med)

    const { medication, transaction } = await dispenseMedication({
      kind: 'queue',
      orgId,
      medication: med,
      quantity: 10,
      dosageInstructions: 'Take 1 capsule three times daily',
      route: 'oral',
      frequency: 'tid',
    })

    expect(medication.status).toBe('completed')
    expect(medication.dosageInstructions).toBe('Take 1 capsule three times daily')
    expect(medication.route).toBe('oral')
    expect(medication.frequency).toBe('tid')

    const updatedItem = await db.inventoryItems.get(item.id)
    expect(updatedItem?.onHand).toBe(20)

    expect(transaction.kind).toBe('dispense')
    expect(transaction.quantity).toBe(10)
    expect(transaction.medicationId).toBe(med.id)
    expect(transaction.patientId).toBe('pat-1')
  })

  it('throws when the medication has no linked inventory item', async () => {
    const med = makeMed({ inventoryItemId: null })
    await expect(
      dispenseMedication({
        kind: 'queue',
        orgId,
        medication: med,
        quantity: 1,
        dosageInstructions: null,
        route: null,
        frequency: null,
      }),
    ).rejects.toThrow()
  })
})

describe('dispenseMedication — walk-in', () => {
  it('creates a completed medication row + dispense transaction', async () => {
    const item = makeItem({ onHand: 50 })
    await db.inventoryItems.put(item)

    const { medication, transaction } = await dispenseMedication({
      kind: 'walkIn',
      orgId,
      patientId: 'pat-99',
      inventoryItemId: item.id,
      name: 'Paracetamol 500mg',
      quantity: 8,
      dosageInstructions: 'After meals',
      route: 'oral',
      frequency: 'qid',
      requestedBy: 'pharmacist@example.com',
    })

    expect(medication.status).toBe('completed')
    expect(medication.patientId).toBe('pat-99')
    expect(medication.inventoryItemId).toBe(item.id)
    expect(medication.name).toBe('Paracetamol 500mg')

    const stored = await db.medications.get(medication.id)
    expect(stored).toBeDefined()
    expect(stored?.dosageInstructions).toBe('After meals')

    const updatedItem = await db.inventoryItems.get(item.id)
    expect(updatedItem?.onHand).toBe(42)

    expect(transaction.medicationId).toBe(medication.id)
    expect(transaction.patientId).toBe('pat-99')
  })
})

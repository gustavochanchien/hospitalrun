import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
import type { InventoryTransaction, Medication } from '@/lib/db/schema'
import { recordStockMovement } from '@/features/inventory/stock-write'

export interface DispenseQueueInput {
  kind: 'queue'
  orgId: string
  medication: Medication
  quantity: number
  dosageInstructions: string | null
  route: string | null
  frequency: string | null
}

export interface DispenseWalkInInput {
  kind: 'walkIn'
  orgId: string
  patientId: string
  inventoryItemId: string
  name: string
  quantity: number
  dosageInstructions: string | null
  route: string | null
  frequency: string | null
  requestedBy: string | null
}

export type DispenseInput = DispenseQueueInput | DispenseWalkInInput

export interface DispenseResult {
  medication: Medication
  transaction: InventoryTransaction
}

export async function dispenseMedication(input: DispenseInput): Promise<DispenseResult> {
  if (input.kind === 'queue') {
    if (!input.medication.inventoryItemId) {
      throw new Error('Medication has no linked inventory item')
    }
    const updated: Medication = {
      ...input.medication,
      dosageInstructions: input.dosageInstructions,
      route: input.route,
      frequency: input.frequency,
      status: 'completed',
    }
    await dbPut('medications', updated, 'update')
    const transaction = await recordStockMovement({
      orgId: input.orgId,
      inventoryItemId: input.medication.inventoryItemId,
      kind: 'dispense',
      quantity: input.quantity,
      patientId: input.medication.patientId,
      medicationId: input.medication.id,
      reference: input.medication.name,
    })
    return { medication: updated, transaction }
  }

  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  const med: Medication = {
    id: crypto.randomUUID(),
    orgId: input.orgId,
    patientId: input.patientId,
    visitId: null,
    name: input.name,
    status: 'completed',
    intent: 'order',
    priority: null,
    quantity: String(input.quantity),
    requestedBy: input.requestedBy,
    startDate: today,
    endDate: today,
    notes: null,
    inventoryItemId: input.inventoryItemId,
    dosageInstructions: input.dosageInstructions,
    route: input.route,
    frequency: input.frequency,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    _synced: false,
    _deleted: false,
  }
  await dbPut('medications', med, 'insert')
  const transaction = await recordStockMovement({
    orgId: input.orgId,
    inventoryItemId: input.inventoryItemId,
    kind: 'dispense',
    quantity: input.quantity,
    patientId: input.patientId,
    medicationId: med.id,
    reference: input.name,
  })
  // Re-fetch so the caller has the persisted record (dbPut applies timestamps)
  const persisted = await db.medications.get(med.id)
  return { medication: persisted ?? med, transaction }
}

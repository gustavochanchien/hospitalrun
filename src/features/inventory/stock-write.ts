import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
import type {
  InventoryItem,
  InventoryTransaction,
  InventoryTransactionKind,
} from '@/lib/db/schema'

export interface RecordStockMovementInput {
  orgId: string
  inventoryItemId: string
  kind: InventoryTransactionKind
  quantity: number
  unitCost?: number | null
  reference?: string | null
  patientId?: string | null
  medicationId?: string | null
  occurredAt?: string
  recordedBy?: string | null
  notes?: string | null
}

/**
 * Signed delta applied to `on_hand` for a given transaction kind. `receive`
 * adds; `adjust` is signed as supplied (positive adds, negative removes);
 * every other kind removes the magnitude. The Supabase trigger
 * `apply_inventory_transaction()` uses the same rule server-side.
 */
export function signedDelta(kind: InventoryTransactionKind, quantity: number): number {
  if (kind === 'receive' || kind === 'adjust') return quantity
  return -quantity
}

/**
 * Record a stock movement locally and pre-update `on_hand` on the item so
 * the UI is consistent offline. The Supabase trigger applies the canonical
 * delta server-side on insert; when realtime re-broadcasts the item row,
 * any drift is reconciled by the inbound sync.
 */
export async function recordStockMovement(
  input: RecordStockMovementInput,
): Promise<InventoryTransaction> {
  const now = new Date().toISOString()
  const occurredAt = input.occurredAt ?? now

  const tx: InventoryTransaction = {
    id: crypto.randomUUID(),
    orgId: input.orgId,
    inventoryItemId: input.inventoryItemId,
    kind: input.kind,
    quantity: input.quantity,
    unitCost: input.unitCost ?? null,
    reference: input.reference ?? null,
    patientId: input.patientId ?? null,
    medicationId: input.medicationId ?? null,
    occurredAt,
    recordedBy: input.recordedBy ?? null,
    notes: input.notes ?? null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    _synced: false,
    _deleted: false,
  }

  await dbPut('inventoryTransactions', tx, 'insert')

  const item = await db.inventoryItems.get(input.inventoryItemId)
  if (item) {
    const next: InventoryItem = {
      ...item,
      onHand: item.onHand + signedDelta(input.kind, input.quantity),
    }
    await dbPut('inventoryItems', next, 'update')
  }

  return tx
}

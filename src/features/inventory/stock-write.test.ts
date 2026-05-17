import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import type { InventoryItem } from '@/lib/db/schema'
import { recordStockMovement, signedDelta } from './stock-write'

const orgId = 'org-stock-write'

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: crypto.randomUUID(),
    orgId,
    sku: 'GLOVE-S',
    name: 'Nitrile gloves',
    description: null,
    unit: 'box',
    onHand: 100,
    reorderLevel: 10,
    unitCost: 5,
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

beforeEach(async () => {
  await db.transaction(
    'rw',
    db.inventoryItems,
    db.inventoryTransactions,
    db.syncQueue,
    async () => {
      await db.inventoryItems.clear()
      await db.inventoryTransactions.clear()
      await db.syncQueue.clear()
    },
  )
})

describe('signedDelta', () => {
  it('adds for receive', () => {
    expect(signedDelta('receive', 5)).toBe(5)
  })

  it('passes through signed adjust', () => {
    expect(signedDelta('adjust', 3)).toBe(3)
    expect(signedDelta('adjust', -2)).toBe(-2)
  })

  it('subtracts for dispense / waste / transfer', () => {
    expect(signedDelta('dispense', 4)).toBe(-4)
    expect(signedDelta('waste', 2)).toBe(-2)
    expect(signedDelta('transfer', 7)).toBe(-7)
  })
})

describe('recordStockMovement', () => {
  it('writes a transaction and decreases on_hand for a dispense', async () => {
    const item = makeItem({ onHand: 50 })
    await db.inventoryItems.put(item)

    await recordStockMovement({
      orgId,
      inventoryItemId: item.id,
      kind: 'dispense',
      quantity: 3,
    })

    const updated = await db.inventoryItems.get(item.id)
    expect(updated?.onHand).toBe(47)

    const txs = await db.inventoryTransactions.toArray()
    expect(txs).toHaveLength(1)
    expect(txs[0].kind).toBe('dispense')
    expect(txs[0].quantity).toBe(3)
  })

  it('increases on_hand for a receive', async () => {
    const item = makeItem({ onHand: 10 })
    await db.inventoryItems.put(item)

    await recordStockMovement({
      orgId,
      inventoryItemId: item.id,
      kind: 'receive',
      quantity: 25,
      unitCost: 6,
    })

    const updated = await db.inventoryItems.get(item.id)
    expect(updated?.onHand).toBe(35)
  })

  it('signed adjust can add or remove', async () => {
    const item = makeItem({ onHand: 100 })
    await db.inventoryItems.put(item)

    await recordStockMovement({
      orgId,
      inventoryItemId: item.id,
      kind: 'adjust',
      quantity: 4,
    })
    await recordStockMovement({
      orgId,
      inventoryItemId: item.id,
      kind: 'adjust',
      quantity: -10,
    })

    const updated = await db.inventoryItems.get(item.id)
    expect(updated?.onHand).toBe(94)
  })

  it('enqueues sync entries for the transaction and the item', async () => {
    const item = makeItem()
    await db.inventoryItems.put(item)

    await recordStockMovement({
      orgId,
      inventoryItemId: item.id,
      kind: 'receive',
      quantity: 1,
    })

    const queued = await db.syncQueue.toArray()
    const tables = queued.map((q) => q.tableName).sort()
    expect(tables).toEqual(['inventoryItems', 'inventoryTransactions'])
  })
})

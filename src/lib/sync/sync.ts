import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase/client'
import { toSupabaseRow, supabaseTableName } from '@/lib/db/columns'
import type { SyncableTable, SyncQueueEntry } from '@/lib/db/schema'
import { getLanTransport } from './transport-router'
import type { SyncableRecord } from './lan-transport'

let syncing = false

/**
 * Process the sync queue: push local changes to cloud Supabase first,
 * fall back to the LAN transport when cloud is unreachable. Called on
 * reconnect, on app focus, and periodically.
 */
export async function flushSyncQueue(): Promise<void> {
  if (syncing) return
  syncing = true

  try {
    const entries = await db.syncQueue.orderBy('seq').toArray()
    if (entries.length === 0) return

    for (const entry of entries) {
      try {
        const ok = await pushEntryViaTransports(entry)
        if (!ok) break
        await db.transaction('rw', db.table(entry.tableName), db.syncQueue, async () => {
          if (entry.operation !== 'delete') {
            await db.table(entry.tableName).update(entry.recordId, { _synced: true })
          }
          await db.syncQueue.delete(entry.seq!)
        })
      } catch (err) {
        // Log and stop — we'll retry this entry on the next flush.
        console.error(`[sync] Failed to push ${entry.tableName}/${entry.recordId}:`, err)
        break
      }
    }
  } finally {
    syncing = false
  }
}

async function pushEntryViaTransports(entry: SyncQueueEntry): Promise<boolean> {
  // 1. Try cloud first when the browser thinks it has internet.
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      await pushEntryToCloud(entry)
      return true
    } catch (err) {
      // Fall through to LAN.
      console.warn(
        `[sync] Cloud push failed for ${entry.tableName}/${entry.recordId}; trying LAN`,
        err,
      )
    }
  }

  // 2. Try LAN if a hub transport is registered and connected.
  const lan = getLanTransport()
  if (lan && lan.state() === 'connected') {
    try {
      await pushEntryToLan(entry, lan)
      return true
    } catch (err) {
      console.warn(
        `[sync] LAN push failed for ${entry.tableName}/${entry.recordId}`,
        err,
      )
    }
  }

  return false
}

async function pushEntryToCloud(entry: SyncQueueEntry): Promise<void> {
  const table = entry.tableName as SyncableTable
  const sbTable = supabaseTableName[table]

  const record = await db.table(table).get(entry.recordId)
  if (!record) return

  if (entry.operation === 'delete') {
    const row = toSupabaseRow(table, record as Record<string, unknown>)
    const { error } = await supabase.from(sbTable).upsert(row)
    if (error) throw error
    return
  }

  const { _synced, _deleted, ...rest } = record as Record<string, unknown> & {
    _synced: boolean
    _deleted: boolean
  }
  void _synced
  void _deleted
  const row = toSupabaseRow(table, rest)
  const { error } = await supabase.from(sbTable).upsert(row)
  if (error) throw error
}

async function pushEntryToLan(
  entry: SyncQueueEntry,
  lan: NonNullable<ReturnType<typeof getLanTransport>>,
): Promise<void> {
  const record = await db.table(entry.tableName).get(entry.recordId)
  if (!record) return

  const wire: SyncableRecord = {
    ...(record as Record<string, unknown>),
    _table: entry.tableName,
  } as SyncableRecord
  const ack = await lan.writeRecord(wire)
  if (!ack.ok) {
    throw new Error(`LAN ack failed: ${ack.code}: ${ack.message}`)
  }
  // skipped:true (older write) is treated as success — the hub already
  // has a newer version; we don't need to re-push.
}

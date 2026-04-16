import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase/client'
import { toSupabaseRow, supabaseTableName } from '@/lib/db/columns'
import type { SyncableTable, SyncQueueEntry } from '@/lib/db/schema'

let syncing = false

/**
 * Process the sync queue: push local changes to Supabase.
 * Called on reconnect, on app focus, and periodically.
 */
export async function flushSyncQueue(): Promise<void> {
  if (syncing || !navigator.onLine) return
  syncing = true

  try {
    const entries = await db.syncQueue.orderBy('seq').toArray()
    if (entries.length === 0) return

    for (const entry of entries) {
      try {
        await pushEntry(entry)
        // On success, mark the Dexie record as synced and remove from queue
        await db.transaction('rw', db.table(entry.tableName), db.syncQueue, async () => {
          if (entry.operation !== 'delete') {
            await db.table(entry.tableName).update(entry.recordId, { _synced: true })
          }
          await db.syncQueue.delete(entry.seq!)
        })
      } catch (err) {
        // Log and continue — we'll retry this entry on the next flush
        console.error(`[sync] Failed to push ${entry.tableName}/${entry.recordId}:`, err)
        break
      }
    }
  } finally {
    syncing = false
  }
}

async function pushEntry(entry: SyncQueueEntry): Promise<void> {
  const table = entry.tableName as SyncableTable
  const sbTable = supabaseTableName[table]

  if (entry.operation === 'delete') {
    // Soft delete: update deleted_at in Supabase
    const record = await db.table(table).get(entry.recordId)
    if (!record) return
    const row = toSupabaseRow(table, record as Record<string, unknown>)
    const { error } = await supabase.from(sbTable).upsert(row)
    if (error) throw error
  } else {
    // Insert or update: upsert the full record
    const record = await db.table(table).get(entry.recordId)
    if (!record) return

    // Strip Dexie-only fields before sending to Supabase
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
}

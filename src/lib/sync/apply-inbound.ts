import { db } from '@/lib/db'
import type { SyncableTable } from '@/lib/db/schema'

/**
 * Shared "apply a record we received from someone else" logic.
 *
 * Both Supabase Realtime ([realtime.ts](./realtime.ts)) and the LAN
 * sync transport feed records into Dexie through this single function
 * so they stay consistent. Inbound records are always marked
 * `_synced: true` because the source of truth told us about them.
 */

interface InboundCandidate {
  id?: unknown
  _deleted?: unknown
  _table?: unknown
  [k: string]: unknown
}

export async function applyInboundRecord(
  tableName: SyncableTable,
  record: InboundCandidate,
): Promise<void> {
  if (typeof record.id !== 'string') return
  // Strip wire-only fields that don't belong in the Dexie schema.
  const { _table: _strip, ...clean } = record
  void _strip
  const merged = {
    ...clean,
    _synced: true,
    _deleted: clean._deleted === true,
  }
  await db.table(tableName).put(merged)
}

export async function applyInboundDelete(
  tableName: SyncableTable,
  recordId: string,
): Promise<void> {
  await db.table(tableName).delete(recordId)
}

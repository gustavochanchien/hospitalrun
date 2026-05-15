import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase, isHubLocalMode } from '@/lib/supabase/client'
import { fromSupabaseRow, supabaseTableName } from '@/lib/db/columns'
import type { SyncableTable } from '@/lib/db/schema'
import { applyInboundDelete, applyInboundRecord } from './apply-inbound'
import type { SyncableRecord } from './lan-transport'

const reverseLookup = Object.fromEntries(
  Object.entries(supabaseTableName).map(([dexie, sb]) => [sb, dexie as SyncableTable]),
)

const SYNCABLE_TABLE_NAMES = new Set<string>(Object.keys(supabaseTableName))

/**
 * Subscribe to Supabase Realtime for all syncable tables.
 * Inbound changes from other clients are applied to Dexie.
 * Returns an unsubscribe function.
 */
export function subscribeToRealtime(): () => void {
  if (isHubLocalMode()) return () => {}

  const channel = supabase
    .channel('db-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public' },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        void handleSupabaseChange(payload)
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

async function handleSupabaseChange(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): Promise<void> {
  const sbTableName = payload.table
  const dexieTable = reverseLookup[sbTableName]
  if (!dexieTable) return

  if (payload.eventType === 'DELETE') {
    const oldRecord = payload.old
    if (oldRecord && typeof oldRecord.id === 'string') {
      await applyInboundDelete(dexieTable, oldRecord.id)
    }
    return
  }

  const row = payload.new
  if (!row || typeof row.id !== 'string') return

  const record = {
    ...fromSupabaseRow(dexieTable, row),
    _deleted: !!row.deleted_at,
  }
  await applyInboundRecord(dexieTable, record)
}

/**
 * Apply a record received from the LAN sync relay. Records carry their
 * Dexie table name in `_table`; the table is validated against the
 * known syncable set so a malicious peer can't poke unknown tables.
 */
export async function applyLanRecord(record: SyncableRecord): Promise<void> {
  if (typeof record._table !== 'string' || !SYNCABLE_TABLE_NAMES.has(record._table)) {
    return
  }
  const tableName = record._table as SyncableTable
  if (record._deleted === true) {
    await applyInboundDelete(tableName, record.id)
    return
  }
  await applyInboundRecord(tableName, record)
}

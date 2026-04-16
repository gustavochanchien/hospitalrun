import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { db } from '@/lib/db'
import { fromSupabaseRow, supabaseTableName } from '@/lib/db/columns'
import type { SyncableTable } from '@/lib/db/schema'

const reverseLookup = Object.fromEntries(
  Object.entries(supabaseTableName).map(([dexie, sb]) => [sb, dexie as SyncableTable]),
)

/**
 * Subscribe to Supabase Realtime for all syncable tables.
 * Inbound changes from other clients are applied to Dexie.
 * Returns an unsubscribe function.
 */
export function subscribeToRealtime(): () => void {
  const channel = supabase
    .channel('db-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public' },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        handleChange(payload)
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

async function handleChange(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): Promise<void> {
  const sbTableName = payload.table
  const dexieTable = reverseLookup[sbTableName]
  if (!dexieTable) return

  if (payload.eventType === 'DELETE') {
    const oldRecord = payload.old
    if (oldRecord && typeof oldRecord.id === 'string') {
      await db.table(dexieTable).delete(oldRecord.id)
    }
    return
  }

  // INSERT or UPDATE
  const row = payload.new
  if (!row || typeof row.id !== 'string') return

  const record = {
    ...fromSupabaseRow(dexieTable, row),
    _synced: true,
    _deleted: !!(row.deleted_at),
  }

  await db.table(dexieTable).put(record)
}

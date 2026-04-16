import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase/client'
import { fromSupabaseRow, supabaseTableName } from '@/lib/db/columns'
import type { SyncableTable } from '@/lib/db/schema'

const CHUNK_SIZE = 500

const syncableTables: SyncableTable[] = [
  'patients',
  'visits',
  'appointments',
  'labs',
  'medications',
  'incidents',
  'imaging',
  'diagnoses',
  'allergies',
  'notes',
  'relatedPersons',
  'careGoals',
  'carePlans',
]

/**
 * On login, pull all Supabase data for the user's org into Dexie.
 * Fetches in chunks to avoid loading everything at once.
 */
export async function hydrateFromSupabase(): Promise<void> {
  for (const table of syncableTables) {
    await hydrateTable(table)
  }
}

async function hydrateTable(table: SyncableTable): Promise<void> {
  const sbTable = supabaseTableName[table]
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from(sbTable)
      .select('*')
      .range(offset, offset + CHUNK_SIZE - 1)
      .order('created_at', { ascending: true })

    if (error) {
      console.error(`[hydrate] Error fetching ${sbTable}:`, error.message)
      return
    }

    if (!data || data.length === 0) {
      hasMore = false
      break
    }

    const records = data.map((row) => ({
      ...fromSupabaseRow(table, row as Record<string, unknown>),
      _synced: true,
      _deleted: !!((row as Record<string, unknown>).deleted_at),
    }))

    await db.table(table).bulkPut(records)

    if (data.length < CHUNK_SIZE) {
      hasMore = false
    } else {
      offset += CHUNK_SIZE
    }
  }
}

/**
 * Clear all local Dexie data (used on logout).
 */
export async function clearLocalData(): Promise<void> {
  for (const table of syncableTables) {
    await db.table(table).clear()
  }
  await db.syncQueue.clear()
  await db.patientHistory.clear()
}

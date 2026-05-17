import { db } from './index'
import { PHI_TABLES, type PatientHistory, type PhiTable, type SyncableTable } from './schema'
import { PHI_TABLE_TO_RESOURCE, recordAccessEvent } from './access-log'

const PHI_TABLE_SET = new Set<SyncableTable>(PHI_TABLES)

function isPhiTable(t: SyncableTable): t is PhiTable {
  return PHI_TABLE_SET.has(t)
}

export interface DbWriteOptions {
  /**
   * Skip HIPAA audit-log emission. Set true for system-internal writes
   * (e.g. applying inbound sync records) that aren't user-initiated.
   */
  skipAudit?: boolean
}

export interface FieldChange {
  fieldName: string
  oldValue: string | null
  newValue: string | null
}

/**
 * Record one or more patient-scoped field changes into the audit log.
 * No-op if `changes` is empty.
 */
export async function recordPatientHistory(params: {
  orgId: string
  patientId: string
  changedBy: string | null
  changes: FieldChange[]
}): Promise<void> {
  if (params.changes.length === 0) return
  const changedAt = new Date().toISOString()
  const entries: PatientHistory[] = params.changes.map((c) => ({
    id: crypto.randomUUID(),
    orgId: params.orgId,
    patientId: params.patientId,
    changedBy: params.changedBy,
    changedAt,
    fieldName: c.fieldName,
    oldValue: c.oldValue,
    newValue: c.newValue,
  }))
  await db.patientHistory.bulkAdd(entries)
}

/**
 * Compute the field-level diff between two records, returning only changed fields.
 */
export function diffFields<T extends object>(
  previous: Partial<T> | null | undefined,
  next: T,
  fields: readonly (keyof T)[],
): FieldChange[] {
  const changes: FieldChange[] = []
  for (const field of fields) {
    const oldVal = previous?.[field]
    const newVal = next[field]
    if (oldVal === newVal) continue
    const oldStr = oldVal == null ? null : String(oldVal)
    const newStr = newVal == null ? null : String(newVal)
    if (oldStr === newStr) continue
    changes.push({
      fieldName: String(field),
      oldValue: oldStr,
      newValue: newStr,
    })
  }
  return changes
}

/**
 * Write a record to Dexie and enqueue it for sync to Supabase.
 * All writes to syncable tables MUST go through this helper.
 *
 * For PHI tables, also emits a HIPAA audit-log entry unless
 * `options.skipAudit` is set.
 */
export async function dbPut<T extends { id: string; patientId?: string | null }>(
  tableName: SyncableTable,
  record: T,
  operation: 'insert' | 'update' = 'update',
  options: DbWriteOptions = {},
): Promise<void> {
  const now = new Date().toISOString()
  const enriched = {
    ...record,
    _synced: false,
    _deleted: false,
    updatedAt: now,
    ...(operation === 'insert' ? { createdAt: now } : {}),
  }

  await db.transaction('rw', db.table(tableName), db.syncQueue, async () => {
    await db.table(tableName).put(enriched)
    await db.syncQueue.add({
      tableName,
      recordId: record.id,
      operation,
      createdAt: now,
    })
  })

  if (!options.skipAudit && isPhiTable(tableName)) {
    const patientId =
      tableName === 'patients' ? record.id : (record.patientId ?? null)
    await recordAccessEvent({
      action: operation === 'insert' ? 'create' : 'update',
      resourceType: PHI_TABLE_TO_RESOURCE[tableName],
      resourceId: record.id,
      patientId,
    })
  }
}

/**
 * Soft-delete a record: set _deleted = true, enqueue for sync.
 *
 * For PHI tables, also emits a HIPAA audit-log entry unless
 * `options.skipAudit` is set. The pre-update patientId is read inside
 * the transaction so the audit entry is correctly scoped.
 */
export async function dbDelete(
  tableName: SyncableTable,
  recordId: string,
  options: DbWriteOptions = {},
): Promise<void> {
  const now = new Date().toISOString()
  let patientId: string | null = null

  await db.transaction('rw', db.table(tableName), db.syncQueue, async () => {
    if (isPhiTable(tableName)) {
      const existing = (await db.table(tableName).get(recordId)) as
        | { patientId?: string | null }
        | undefined
      patientId = tableName === 'patients' ? recordId : (existing?.patientId ?? null)
    }
    await db.table(tableName).update(recordId, {
      _synced: false,
      _deleted: true,
      deletedAt: now,
      updatedAt: now,
    })
    await db.syncQueue.add({
      tableName,
      recordId,
      operation: 'delete',
      createdAt: now,
    })
  })

  if (!options.skipAudit && isPhiTable(tableName)) {
    await recordAccessEvent({
      action: 'delete',
      resourceType: PHI_TABLE_TO_RESOURCE[tableName],
      resourceId: recordId,
      patientId,
    })
  }
}

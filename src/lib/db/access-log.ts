import { db } from './index'
import { useAuthStore } from '@/features/auth/auth.store'
import type { AccessAction, AccessLog, AccessResourceType, PhiTable } from './schema'

const CLIENT_ID_KEY = 'hr_client_id'

function getClientId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    let id = window.localStorage.getItem(CLIENT_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      window.localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

export interface RecordAccessEventInput {
  action: AccessAction
  resourceType: AccessResourceType
  resourceId?: string | null
  patientId?: string | null
  context?: Record<string, unknown> | null
}

/**
 * Append a HIPAA audit-log entry for a patient-data access. Writes to
 * Dexie + syncQueue atomically; the sync engine pushes it to Supabase
 * where the `access_logs_seal` trigger overwrites the identity columns
 * from auth.uid() (a malicious client can never forge them).
 *
 * Never throws — auditing must not break the read it records.
 */
export async function recordAccessEvent(input: RecordAccessEventInput): Promise<void> {
  try {
    const { user, orgId, role } = useAuthStore.getState()
    if (!user || !orgId) return

    const now = new Date().toISOString()
    const log: AccessLog = {
      id: crypto.randomUUID(),
      orgId,
      userId: user.id,
      userEmail: user.email ?? null,
      userRole: role ?? 'unknown',
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      patientId: input.patientId ?? null,
      context: input.context ?? null,
      clientId: getClientId(),
      occurredAt: now,
      createdAt: now,
      _synced: false,
    }

    await db.transaction('rw', db.accessLogs, db.syncQueue, async () => {
      await db.accessLogs.add(log)
      await db.syncQueue.add({
        tableName: 'accessLogs',
        recordId: log.id,
        operation: 'insert',
        createdAt: now,
      })
    })
  } catch (err) {
    console.warn('[access-log] Failed to record event:', err)
  }
}

/** Maps a syncable PHI Dexie table to its audit-log `resource_type`. */
export const PHI_TABLE_TO_RESOURCE: Record<PhiTable, AccessResourceType> = {
  patients: 'patient',
  visits: 'visit',
  appointments: 'appointment',
  labs: 'lab',
  medications: 'medication',
  imaging: 'imaging',
  incidents: 'incident',
  diagnoses: 'diagnosis',
  allergies: 'allergy',
  notes: 'note',
  relatedPersons: 'related_person',
  careGoals: 'care_goal',
  carePlans: 'care_plan',
}

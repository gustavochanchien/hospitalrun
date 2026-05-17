import { useEffect, useRef } from 'react'
import { recordAccessEvent } from '@/lib/db/access-log'
import type { AccessAction, AccessResourceType } from '@/lib/db/schema'

interface UseLogAccessOptions {
  action: AccessAction
  resourceType: AccessResourceType
  resourceId?: string | null
  patientId?: string | null
  context?: Record<string, unknown> | null
  /** When falsy, the log is skipped (e.g. waiting for an async dependency). */
  enabled?: boolean
}

/**
 * Emit a HIPAA access-log event exactly once per mount when `enabled`
 * first becomes true and the identity (resourceId + action +
 * resourceType) changes. Use this on detail/list pages to record
 * patient-data access. Safe for re-renders.
 */
export function useLogAccess({
  action,
  resourceType,
  resourceId = null,
  patientId = null,
  context = null,
  enabled = true,
}: UseLogAccessOptions): void {
  const loggedKey = useRef<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    const key = `${action}:${resourceType}:${resourceId ?? ''}:${patientId ?? ''}`
    if (loggedKey.current === key) return
    loggedKey.current = key
    void recordAccessEvent({ action, resourceType, resourceId, patientId, context })
    // context is intentionally not in the dep array — it is forwarded as
    // metadata, not part of the dedup key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, action, resourceType, resourceId, patientId])
}

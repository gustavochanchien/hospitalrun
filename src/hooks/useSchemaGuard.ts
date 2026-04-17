import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuthStore } from '@/features/auth/auth.store'

/**
 * Schema version the deployed frontend was built against. Bump this
 * whenever you add a new migration under supabase/migrations/ and the
 * corresponding number in public.schema_meta. If the backend reports a
 * lower version, the app renders the "Upgrade required" screen.
 */
export const EXPECTED_SCHEMA_VERSION = 1

type Status = 'checking' | 'ok' | 'stale-db' | 'missing-rpc'

/**
 * Runs once after a session is established. Calls the
 * current_schema_version RPC and compares against what the frontend
 * expects. Status drives the root guard UI.
 */
export function useSchemaGuard(): Status {
  const [status, setStatus] = useState<Status>('checking')
  const session = useAuthStore((s) => s.session)

  useEffect(() => {
    if (!session) return
    let cancelled = false

    void (async () => {
      try {
        const { data, error } = await supabase.rpc('current_schema_version')
        if (cancelled) return
        if (error) {
          // RPC missing = deploy.sql never applied or pre-schema_meta version.
          setStatus('missing-rpc')
          return
        }
        const version = typeof data === 'number' ? data : 0
        setStatus(version >= EXPECTED_SCHEMA_VERSION ? 'ok' : 'stale-db')
      } catch {
        if (!cancelled) setStatus('missing-rpc')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [session])

  return status
}

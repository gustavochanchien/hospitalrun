import { useEffect, useRef } from 'react'
import { useOnlineStatus } from './useOnlineStatus'
import { useAuthStore } from '@/features/auth/auth.store'
import { flushSyncQueue } from '@/lib/sync/sync'
import { hydrateFromSupabase } from '@/lib/sync/hydrate'
import { subscribeToRealtime, applyLanRecord } from '@/lib/sync/realtime'
import { createLanTransport } from '@/lib/sync/lan-transport'
import { setLanTransport } from '@/lib/sync/transport-router'
import { isHubLocalMode } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/seed'

/**
 * Manages the full sync lifecycle:
 * - Hydrates Dexie from Supabase on login (or subscribes to the LAN relay in local-hub mode)
 * - Flushes sync queue when online / on focus
 * - Subscribes to Supabase Realtime for inbound changes (skipped in local-hub mode)
 */
export function useSync() {
  const isOnline = useOnlineStatus()
  const session = useAuthStore((s) => s.session)
  const orgId = useAuthStore((s) => s.orgId)
  const getAccessToken = useAuthStore((s) => s.getAccessToken)
  const hydrated = useRef(false)
  const demo = isDemoMode()

  // Hydrate on login
  useEffect(() => {
    if (demo || !session || hydrated.current) return
    hydrated.current = true
    if (!isHubLocalMode()) {
      hydrateFromSupabase().then(() => {
        flushSyncQueue()
      })
    }
  }, [session, demo])

  // In local-hub mode, create and start a LAN transport which handles both
  // replay (initial hydration) and broadcast (live updates).
  useEffect(() => {
    if (demo || !session || !orgId || !isHubLocalMode()) return

    const hubOrigin = window.location.origin
    const wsUrl = hubOrigin.replace(/^http/, 'ws') + '/sync'

    const transport = createLanTransport({
      hubUrl: wsUrl,
      orgId,
      getJwt: () => getAccessToken(),
      onRecord: (record) => { void applyLanRecord(record) },
      loadCursor: () => {
        const v = localStorage.getItem(`hr_lan_cursor_${orgId}`)
        return v ? Number(v) : 0
      },
      saveCursor: (cursor) => {
        localStorage.setItem(`hr_lan_cursor_${orgId}`, String(cursor))
      },
    })

    setLanTransport(transport)
    transport.start()

    return () => {
      transport.stop()
      setLanTransport(null)
    }
  }, [session, orgId, demo])

  // Flush on reconnect
  useEffect(() => {
    if (!demo && isOnline && session) {
      flushSyncQueue()
    }
  }, [isOnline, session, demo])

  // Flush on window focus
  useEffect(() => {
    if (demo || !session) return

    const onFocus = () => {
      if (navigator.onLine) {
        flushSyncQueue()
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [session, demo])

  // Subscribe to Supabase Realtime (no-op in local-hub mode — relay handles it)
  useEffect(() => {
    if (demo || !session) return
    const unsubscribe = subscribeToRealtime()
    return unsubscribe
  }, [session, demo])
}

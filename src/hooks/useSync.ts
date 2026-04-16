import { useEffect, useRef } from 'react'
import { useOnlineStatus } from './useOnlineStatus'
import { useAuthStore } from '@/features/auth/auth.store'
import { flushSyncQueue } from '@/lib/sync/sync'
import { hydrateFromSupabase } from '@/lib/sync/hydrate'
import { subscribeToRealtime } from '@/lib/sync/realtime'
import { isDemoMode } from '@/lib/demo/seed'

/**
 * Manages the full sync lifecycle:
 * - Hydrates Dexie from Supabase on login
 * - Flushes sync queue when online / on focus
 * - Subscribes to Supabase Realtime for inbound changes
 */
export function useSync() {
  const isOnline = useOnlineStatus()
  const session = useAuthStore((s) => s.session)
  const hydrated = useRef(false)
  const demo = isDemoMode()

  // Hydrate on login
  useEffect(() => {
    if (demo || !session || hydrated.current) return
    hydrated.current = true
    hydrateFromSupabase().then(() => {
      flushSyncQueue()
    })
  }, [session, demo])

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

  // Subscribe to Realtime
  useEffect(() => {
    if (demo || !session) return
    const unsubscribe = subscribeToRealtime()
    return unsubscribe
  }, [session, demo])
}

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useOnlineStatus } from './useOnlineStatus'

export function useOnlineToast() {
  const isOnline = useOnlineStatus()
  const previousRef = useRef(isOnline)

  useEffect(() => {
    if (previousRef.current === isOnline) return
    previousRef.current = isOnline

    if (isOnline) {
      toast.success('Back online', {
        description: 'Syncing pending changes...',
        duration: 3000,
      })
    } else {
      toast.warning('You are offline', {
        description: 'Changes will sync when you reconnect.',
        duration: 5000,
      })
    }
  }, [isOnline])
}

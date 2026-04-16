import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { WifiOff } from 'lucide-react'

export function NetworkStatusBanner() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500/95 px-4 py-2 text-sm font-medium text-amber-950 shadow-sm"
    >
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      <span>You are offline. Changes will sync when you reconnect.</span>
    </div>
  )
}

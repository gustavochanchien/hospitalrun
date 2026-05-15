import { useEffect } from 'react'
import { toast } from 'sonner'

const STORAGE_KEY = 'hr_hub_just_started'

interface HubReadyPayload {
  url?: string
}

/**
 * One-shot splash shown after the desktop hub setup wizard reloads the
 * renderer. HubSetupFlow drops a JSON blob into localStorage before it
 * calls `window.location.assign('/')`; we read and clear it on the
 * first dashboard render so the user sees an explicit "your hub is
 * running" confirmation instead of landing cold on the empty
 * dashboard.
 */
export function useHubReadyToast() {
  useEffect(() => {
    let raw: string | null = null
    try {
      raw = localStorage.getItem(STORAGE_KEY)
      if (raw) localStorage.removeItem(STORAGE_KEY)
    } catch {
      return
    }
    if (!raw) return

    let payload: HubReadyPayload = {}
    try {
      payload = JSON.parse(raw) as HubReadyPayload
    } catch {
      payload = {}
    }

    toast.success('Your clinic hub is running', {
      description:
        typeof payload.url === 'string' && payload.url.length > 0
          ? `Other devices can connect at ${payload.url}`
          : 'Other devices on the same network can connect to it.',
      duration: 8000,
    })
  }, [])
}

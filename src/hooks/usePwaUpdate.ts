import { useEffect } from 'react'
import { toast } from 'sonner'
import { isDesktop } from '@/lib/desktop/env'

async function hardReload() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch (err) {
    console.warn('Cache/SW cleanup failed before reload:', err)
  } finally {
    // Bust HTTP cache with a query param so the browser refetches the shell.
    const url = new URL(window.location.href)
    url.searchParams.set('_v', Date.now().toString())
    window.location.replace(url.toString())
  }
}

export function usePwaUpdate() {
  useEffect(() => {
    if (isDesktop()) return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            toast.info('Update available', {
              description: 'A new version of HospitalRun is ready.',
              action: {
                label: 'Reload',
                onClick: () => void hardReload(),
              },
              duration: Infinity,
            })
          }
        })
      })
    })
  }, [])
}

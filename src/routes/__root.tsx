import { useEffect } from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/lib/theme/ThemeProvider'
import { useAuthStore } from '@/features/auth/auth.store'
import { useSync } from '@/hooks/useSync'
import { useOnlineToast } from '@/hooks/useOnlineToast'
import { usePwaUpdate } from '@/hooks/usePwaUpdate'
import { isDemoMode, seedDemoData, applyDemoAuth } from '@/lib/demo/seed'

function RootComponent() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    if (isDemoMode()) {
      void seedDemoData().then(applyDemoAuth)
      return
    }
    const unsubscribe = initialize()
    return unsubscribe
  }, [initialize])

  useSync()
  useOnlineToast()
  usePwaUpdate()

  return (
    <ThemeProvider>
      <Outlet />
      <Toaster />
    </ThemeProvider>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})

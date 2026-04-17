import { useEffect } from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/lib/theme/ThemeProvider'
import { useAuthStore } from '@/features/auth/auth.store'
import { useSync } from '@/hooks/useSync'
import { useOnlineToast } from '@/hooks/useOnlineToast'
import { usePwaUpdate } from '@/hooks/usePwaUpdate'
import { useSchemaGuard } from '@/hooks/useSchemaGuard'
import { SchemaMismatchScreen } from '@/components/schema-mismatch-screen'
import { isDemoMode, seedDemoData, applyDemoAuth } from '@/lib/demo/seed'

function RootComponent() {
  const initialize = useAuthStore((s) => s.initialize)
  const schemaStatus = useSchemaGuard()

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

  if (schemaStatus === 'stale-db' || schemaStatus === 'missing-rpc') {
    return (
      <ThemeProvider>
        <SchemaMismatchScreen reason={schemaStatus} />
        <Toaster />
      </ThemeProvider>
    )
  }

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

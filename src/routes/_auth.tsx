import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { useAuthStore } from '@/features/auth/auth.store'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { NetworkStatusBanner } from '@/components/network-status-banner'
import { UpdateAvailableBanner } from '@/components/update-available-banner'
import { hasBackendConfig } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/seed'
import { useHubReadyToast } from '@/hooks/useHubReadyToast'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const demo = isDemoMode()
    if (!demo && !hasBackendConfig()) {
      throw redirect({ to: '/setup' })
    }
    let { session } = useAuthStore.getState()
    const { isLoading } = useAuthStore.getState()
    if (!demo && isLoading) {
      await new Promise<void>((resolve) => {
        const unsub = useAuthStore.subscribe((state) => {
          if (!state.isLoading) {
            unsub()
            resolve()
          }
        })
        // Safety net: never deadlock — if auth init hasn't settled in
        // 5s, fall through and let the session-null check redirect.
        setTimeout(() => {
          unsub()
          resolve()
        }, 5000)
      })
      session = useAuthStore.getState().session
    }
    if (demo) {
      // Demo seed runs in __root.tsx useEffect after mount — wait briefly
      // for applyDemoAuth() to populate the session, otherwise the first
      // navigation will bounce to /login before the seed lands.
      if (!session) {
        await new Promise<void>((resolve) => {
          const unsub = useAuthStore.subscribe((state) => {
            if (state.session) {
              unsub()
              resolve()
            }
          })
          setTimeout(() => {
            unsub()
            resolve()
          }, 3000)
        })
        session = useAuthStore.getState().session
      }
      return
    }
    if (!session) {
      throw redirect({ to: '/login' })
    }
  },
  component: AuthLayout,
})

function AuthLayout() {
  useHubReadyToast()
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <UpdateAvailableBanner />
          <NetworkStatusBanner />
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

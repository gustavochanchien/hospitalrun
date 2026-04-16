import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { useAuthStore } from '@/features/auth/auth.store'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { NetworkStatusBanner } from '@/components/network-status-banner'
import { hasBackendConfig } from '@/lib/supabase/client'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    if (!hasBackendConfig()) {
      throw redirect({ to: '/setup' })
    }
    let { session } = useAuthStore.getState()
    const { isLoading } = useAuthStore.getState()
    if (isLoading) {
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
    if (!session) {
      throw redirect({ to: '/login' })
    }
  },
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <NetworkStatusBanner />
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

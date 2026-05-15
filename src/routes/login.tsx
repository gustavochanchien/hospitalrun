import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { useAuthStore } from '@/features/auth/auth.store'
import { hasBackendConfig } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/seed'

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    if (isDemoMode()) {
      throw redirect({ to: '/' })
    }
    if (!hasBackendConfig()) {
      throw redirect({ to: '/setup' })
    }
    const { session } = useAuthStore.getState()
    if (session) {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
})

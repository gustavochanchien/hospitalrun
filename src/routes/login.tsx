import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { useAuthStore } from '@/features/auth/auth.store'
import { hasBackendConfig } from '@/lib/supabase/client'

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
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

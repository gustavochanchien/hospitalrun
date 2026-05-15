import { createFileRoute, redirect } from '@tanstack/react-router'
import { SetupPage } from '@/features/setup/SetupPage'
import { hasBackendConfig } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/seed'

export const Route = createFileRoute('/setup')({
  beforeLoad: () => {
    if (isDemoMode() || hasBackendConfig()) {
      throw redirect({ to: '/' })
    }
  },
  component: SetupPage,
})

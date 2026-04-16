import { createFileRoute, redirect } from '@tanstack/react-router'
import { SetupPage } from '@/features/setup/SetupPage'
import { hasBackendConfig } from '@/lib/supabase/client'

export const Route = createFileRoute('/setup')({
  beforeLoad: () => {
    if (hasBackendConfig()) {
      throw redirect({ to: '/' })
    }
  },
  component: SetupPage,
})

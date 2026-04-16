import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { initBackendConfig } from '@/lib/supabase/client'
import '@/lib/i18n'
import '@/features/settings/language.store'
import './index.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

async function bootstrap() {
  await initBackendConfig()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

void bootstrap()

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from '@/features/auth/auth.store'

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
  hasBackendConfig: () => true,
  getSupabase: vi.fn(),
  initBackendConfig: vi.fn(),
  getBackendConfig: () => null,
  saveBackendConfig: vi.fn(),
  clearBackendConfig: vi.fn(),
}))

vi.mock('@/lib/demo/seed', async () => {
  const actual = await vi.importActual<typeof import('@/lib/demo/seed')>(
    '@/lib/demo/seed',
  )
  return {
    ...actual,
    isDemoMode: () => false,
  }
})

const { Route } = await import('./_auth')

function setAuthState(session: unknown, isLoading = false) {
  useAuthStore.setState({
    session: session as never,
    user: null,
    orgId: null,
    role: null,
    isLoading,
  })
}

beforeEach(() => {
  setAuthState(null, false)
})

describe('_auth route guard', () => {
  it('redirects to /login when there is no session and not loading', async () => {
    setAuthState(null, false)
    await expect(
      (async () => Route.options.beforeLoad?.({} as never))(),
    ).rejects.toMatchObject({ options: { to: '/login' } })
  })

  it('does not redirect when a session exists', async () => {
    setAuthState({ access_token: 'token' }, false)
    await expect(
      (async () => Route.options.beforeLoad?.({} as never))(),
    ).resolves.not.toThrow()
  })

  it('waits for auth to finish loading before deciding', async () => {
    setAuthState(null, true)
    const pending = (async () =>
      Route.options.beforeLoad?.({} as never))() as Promise<unknown>

    setTimeout(() => {
      useAuthStore.setState({
        session: { access_token: 'token' } as never,
        isLoading: false,
      })
    }, 10)

    await expect(pending).resolves.not.toThrow()
  })
})

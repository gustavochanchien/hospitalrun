import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Session } from '@supabase/supabase-js'

const signInWithPassword = vi.fn()
const signUp = vi.fn()
const signOut = vi.fn()
const getSession = vi.fn()
const onAuthStateChange = vi.fn()
const unsubscribe = vi.fn()

const profiles: Record<string, { org_id: string; role: string }> = {
  'user-1': { org_id: 'org-1', role: 'admin' },
  'user-2': { org_id: 'org-2', role: 'doctor' },
}

const from = vi.fn((table: string) => {
  if (table !== 'profiles') throw new Error(`unexpected table ${table}`)
  return {
    select: () => ({
      eq: (_col: string, userId: string) => ({
        maybeSingle: async () => ({
          data: profiles[userId] ?? null,
          error: null,
        }),
      }),
    }),
  }
})

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      signUp: (...args: unknown[]) => signUp(...args),
      signOut: (...args: unknown[]) => signOut(...args),
      getSession: (...args: unknown[]) => getSession(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChange(...args),
    },
    from: (...args: unknown[]) => from(...(args as [string])),
    rpc: vi.fn(),
  },
}))

const { useAuthStore } = await import('./auth.store')

function resetStore() {
  useAuthStore.setState({
    user: null,
    session: null,
    orgId: null,
    role: null,
    isLoading: true,
  })
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    access_token: 'token',
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      app_metadata: { org_id: 'org-1', role: 'admin' },
      user_metadata: {},
      aud: 'authenticated',
      created_at: '',
    },
    ...overrides,
  } as Session
}

beforeEach(() => {
  vi.clearAllMocks()
  resetStore()
  onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } })
})

describe('useAuthStore.signIn', () => {
  it('returns null error on success', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    const result = await useAuthStore.getState().signIn('a@b.com', 'pw123456')
    expect(result).toEqual({ error: null })
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw123456' })
  })

  it('returns error message on failure', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid credentials' } })
    const result = await useAuthStore.getState().signIn('a@b.com', 'wrong')
    expect(result).toEqual({ error: 'Invalid credentials' })
  })
})

describe('useAuthStore.signUp', () => {
  it('passes full name into user metadata', async () => {
    signUp.mockResolvedValue({ error: null })
    const result = await useAuthStore.getState().signUp('a@b.com', 'pw123456', 'Alice Smith')
    expect(result).toEqual({ error: null })
    expect(signUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pw123456',
      options: { data: { full_name: 'Alice Smith' } },
    })
  })

  it('returns error message on failure', async () => {
    signUp.mockResolvedValue({ error: { message: 'Email already registered' } })
    const result = await useAuthStore.getState().signUp('a@b.com', 'pw123456', 'Alice')
    expect(result).toEqual({ error: 'Email already registered' })
  })
})

describe('useAuthStore.signOut', () => {
  it('clears user, session, orgId, and role', async () => {
    useAuthStore.setState({
      user: { id: 'u1' } as Session['user'],
      session: makeSession(),
      orgId: 'org-1',
      role: 'admin',
      isLoading: false,
    })
    signOut.mockResolvedValue({ error: null })

    await useAuthStore.getState().signOut()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.session).toBeNull()
    expect(state.orgId).toBeNull()
    expect(state.role).toBeNull()
  })
})

describe('useAuthStore.initialize', () => {
  it('hydrates state from existing session and loads the profile', async () => {
    const session = makeSession()
    getSession.mockResolvedValue({ data: { session } })

    useAuthStore.getState().initialize()
    await vi.waitFor(() => {
      expect(useAuthStore.getState().orgId).toBe('org-1')
    })

    const state = useAuthStore.getState()
    expect(state.session).toBe(session)
    expect(state.user).toBe(session.user)
    expect(state.orgId).toBe('org-1')
    expect(state.role).toBe('admin')
    expect(state.isLoading).toBe(false)
  })

  it('sets null values when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } })

    useAuthStore.getState().initialize()
    await vi.waitFor(() => {
      expect(useAuthStore.getState().isLoading).toBe(false)
    })

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.orgId).toBeNull()
    expect(state.role).toBeNull()
  })

  it('updates state when onAuthStateChange fires', async () => {
    getSession.mockResolvedValue({ data: { session: null } })

    useAuthStore.getState().initialize()
    await vi.waitFor(() => {
      expect(onAuthStateChange).toHaveBeenCalled()
    })

    const callback = onAuthStateChange.mock.calls[0][0]
    const newSession = makeSession({
      user: {
        id: 'user-2',
        app_metadata: { org_id: 'org-2', role: 'doctor' },
        user_metadata: {},
        aud: 'authenticated',
        created_at: '',
      } as Session['user'],
    })
    callback('SIGNED_IN', newSession)

    await vi.waitFor(() => {
      expect(useAuthStore.getState().orgId).toBe('org-2')
    })
    const state = useAuthStore.getState()
    expect(state.session).toBe(newSession)
    expect(state.orgId).toBe('org-2')
    expect(state.role).toBe('doctor')
  })

  it('returns an unsubscribe function', () => {
    getSession.mockResolvedValue({ data: { session: null } })
    const cleanup = useAuthStore.getState().initialize()
    cleanup()
    expect(unsubscribe).toHaveBeenCalled()
  })
})

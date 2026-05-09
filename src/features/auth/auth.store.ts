import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { hubCachePassword, hubSignin, type HubProfile } from '@/lib/desktop/hub-auth'

export type AuthIssuer = 'cloud' | 'hub'

interface AuthState {
  user: User | null
  session: Session | null
  orgId: string | null
  role: string | null
  isLoading: boolean
  issuer: AuthIssuer | null
  /**
   * Hub-issued access token (when `issuer === 'hub'`). Used by the LAN
   * sync transport when the cloud is unreachable. Null when the user
   * is signed in via cloud — in that case `session.access_token` is
   * the source of truth.
   */
  hubAccessToken: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  initialize: () => () => void
  loadProfile: () => Promise<void>
  /** Active access token regardless of issuer. */
  getAccessToken: () => string | null
}

/**
 * Source of truth for the current user's org membership is the
 * `profiles` row, not a JWT claim. The JWT hook is optional — if it
 * ever stops working (hook disabled, missing grant, trigger failure on
 * signup), this store self-heals by looking up or creating the profile
 * via the `bootstrap_current_user` SECURITY DEFINER RPC.
 */
async function fetchOrBootstrapProfile(
  userId: string,
): Promise<{ orgId: string | null; role: string | null }> {
  const { data: existing, error: selErr } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', userId)
    .maybeSingle()

  if (selErr) {
    console.error('fetch profile failed:', selErr)
    throw selErr
  }

  if (existing?.org_id) {
    return { orgId: existing.org_id, role: existing.role ?? null }
  }

  // No profile yet — create one via the SECURITY DEFINER RPC.
  const { data: newOrgId, error: rpcErr } = await supabase.rpc(
    'bootstrap_current_user',
    { org_name: 'My Hospital' },
  )
  if (rpcErr) {
    console.error('bootstrap_current_user failed:', rpcErr)
    throw rpcErr
  }

  // Re-read the profile to pick up the role the RPC assigned.
  const { data: fresh } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', userId)
    .maybeSingle()

  return {
    orgId: (newOrgId as string | null) ?? fresh?.org_id ?? null,
    role: fresh?.role ?? 'admin',
  }
}

function buildHubSession(profile: HubProfile, accessToken: string): Session {
  // Construct a Supabase-Session-shaped object so route guards that
  // check `session != null` continue to work for hub-issued logins.
  // Note: this session is NOT valid against the cloud — any direct
  // supabase.from(...) call will fail until the user re-authenticates
  // via cloud. That's expected; reads come from Dexie and writes flow
  // through the LAN transport.
  const nowSec = Math.floor(Date.now() / 1000)
  const fakeUser: User = {
    id: profile.userId,
    email: profile.email,
    app_metadata: { org_id: profile.orgId, role: profile.role, provider: 'hub' },
    user_metadata: {},
    aud: 'authenticated',
    role: 'authenticated',
    created_at: new Date().toISOString(),
  } as User
  return {
    access_token: accessToken,
    refresh_token: '',
    expires_at: nowSec + 12 * 3600,
    expires_in: 12 * 3600,
    token_type: 'bearer',
    user: fakeUser,
  } as Session
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  orgId: null,
  role: null,
  isLoading: true,
  issuer: null,
  hubAccessToken: null,

  signIn: async (email, password) => {
    // 1. Try cloud Supabase first.
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) {
      // Best-effort: forward the password to the hub so it can be
      // cached for future offline signins. Non-blocking, ignores
      // failures (e.g. when there's no hub on the LAN). Skipped if
      // the response has no session (some test fixtures, or auth
      // configs that require email confirmation).
      if (data?.session) {
        void hubCachePassword({
          email,
          password,
          accessToken: data.session.access_token,
        })
      }
      // applySession via onAuthStateChange will populate state
      // (issuer = 'cloud' set there).
      return { error: null }
    }

    // 2. Cloud failed — try the hub if there is one.
    const hubResult = await hubSignin(email, password)
    if (hubResult) {
      const fakeSession = buildHubSession(hubResult.profile, hubResult.accessToken)
      set({
        session: fakeSession,
        user: fakeSession.user,
        orgId: hubResult.profile.orgId,
        role: hubResult.profile.role,
        issuer: 'hub',
        hubAccessToken: hubResult.accessToken,
        isLoading: false,
      })
      return { error: null }
    }

    return { error: error?.message ?? 'Sign-in failed' }
  },

  signUp: async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) return { error: error.message }
    return { error: null }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      // Hub-issued sessions don't have a cloud signout to call.
    }
    set({
      user: null,
      session: null,
      orgId: null,
      role: null,
      issuer: null,
      hubAccessToken: null,
    })
  },

  loadProfile: async () => {
    const user = get().user
    if (!user) return
    if (get().issuer === 'hub') {
      // Hub sessions already carry the profile from the signin response.
      return
    }
    try {
      const { orgId, role } = await fetchOrBootstrapProfile(user.id)
      set({ orgId, role })
    } catch (err) {
      toast.error(
        `Couldn't load your org profile: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  },

  getAccessToken: () => {
    const s = get()
    if (s.issuer === 'hub') return s.hubAccessToken
    return s.session?.access_token ?? null
  },

  initialize: () => {
    const applySession = (session: Session | null) => {
      set({
        session,
        user: session?.user ?? null,
        isLoading: false,
        issuer: session ? 'cloud' : null,
        hubAccessToken: null,
      })
      if (session?.user) {
        void get().loadProfile()
      } else {
        set({ orgId: null, role: null })
      }
    }

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => applySession(session))
      .catch((err) => {
        console.error('auth.getSession failed:', err)
        set({
          session: null,
          user: null,
          orgId: null,
          role: null,
          issuer: null,
          hubAccessToken: null,
          isLoading: false,
        })
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => applySession(session))

    return () => subscription.unsubscribe()
  },
}))

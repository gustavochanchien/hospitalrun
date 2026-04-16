import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

interface AuthState {
  user: User | null
  session: Session | null
  orgId: string | null
  role: string | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  initialize: () => () => void
  loadProfile: () => Promise<void>
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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  orgId: null,
  role: null,
  isLoading: true,

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
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
    await supabase.auth.signOut()
    set({ user: null, session: null, orgId: null, role: null })
  },

  loadProfile: async () => {
    const user = get().user
    if (!user) return
    try {
      const { orgId, role } = await fetchOrBootstrapProfile(user.id)
      set({ orgId, role })
    } catch (err) {
      toast.error(
        `Couldn't load your org profile: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  },

  initialize: () => {
    const applySession = (session: Session | null) => {
      set({
        session,
        user: session?.user ?? null,
        isLoading: false,
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
        set({ session: null, user: null, orgId: null, role: null, isLoading: false })
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => applySession(session))

    return () => subscription.unsubscribe()
  },
}))

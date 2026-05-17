// deno-lint-ignore-file no-explicit-any
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Roles are no longer a closed enum — each org defines its own set in
// `org_roles`. We validate the role string at runtime by checking that
// a non-deleted row exists for (inviter's org_id, role).
type Role = string

interface RequestBody {
  mode?: 'invite' | 'create' | 'disable' | 'enable'
  email?: string
  role?: Role
  // 'create' mode only:
  password?: string
  fullName?: string
  // 'disable' / 'enable' mode only:
  userId?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'missing_authorization' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'unauthorized' }, 401)

    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('id, org_id, role')
      .eq('id', user.id)
      .maybeSingle()
    if (profileErr || !profile) return json({ error: 'no_profile' }, 403)
    if (profile.role !== 'admin') return json({ error: 'forbidden' }, 403)

    const body = (await req.json().catch(() => ({}))) as Partial<RequestBody>
    const mode = body.mode ?? 'invite'

    if (mode === 'disable' || mode === 'enable') {
      const targetUserId = (body.userId ?? '').trim()
      if (!targetUserId) return json({ error: 'missing_user_id' }, 400)
      return await handleToggle({ admin, targetUserId, ban: mode === 'disable', adminOrgId: profile.org_id })
    }

    const email = (body.email ?? '').trim().toLowerCase()
    const role = typeof body.role === 'string' ? body.role.trim() : ''
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'invalid_email' }, 400)
    }
    if (!role) {
      return json({ error: 'invalid_role' }, 400)
    }

    // Validate the role exists in this org's editable role table.
    // No caching — staleness is a security concern (deleted role would
    // be accepted as valid). One extra read per invite is acceptable at
    // human pace.
    const { data: roleRow, error: roleErr } = await admin
      .from('org_roles')
      .select('role_key')
      .eq('org_id', profile.org_id)
      .eq('role_key', role)
      .is('deleted_at', null)
      .maybeSingle()
    if (roleErr) {
      return json({ error: 'role_lookup_failed', detail: roleErr.message }, 500)
    }
    if (!roleRow) {
      return json({ error: 'invalid_role' }, 400)
    }

    const { data: existing } = await admin
      .from('org_members')
      .select('id, accepted_at, user_id')
      .eq('org_id', profile.org_id)
      .eq('invited_email', email)
      .maybeSingle()
    if (existing?.accepted_at) {
      return json({ error: 'already_member' }, 409)
    }

    if (mode === 'create') {
      return await handleCreate({
        admin,
        email,
        role,
        password: body.password ?? '',
        fullName: (body.fullName ?? '').trim(),
        adminUserId: user.id,
        adminOrgId: profile.org_id,
        existingMemberId: existing?.id ?? null,
      })
    }

    return await handleInvite({
      admin,
      email,
      role,
      adminUserId: user.id,
      adminOrgId: profile.org_id,
      existingMemberId: existing?.id ?? null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: 'server_error', detail: message }, 500)
  }
})

async function handleToggle({
  admin,
  targetUserId,
  ban,
  adminOrgId,
}: {
  admin: any
  targetUserId: string
  ban: boolean
  adminOrgId: string
}): Promise<Response> {
  // Verify the target user belongs to the admin's org before acting.
  const { data: targetProfile, error: profileErr } = await admin
    .from('profiles')
    .select('id, org_id')
    .eq('id', targetUserId)
    .maybeSingle()
  if (profileErr || !targetProfile) return json({ error: 'user_not_found' }, 404)
  if (targetProfile.org_id !== adminOrgId) return json({ error: 'forbidden' }, 403)

  const { error } = await admin.auth.admin.updateUser(targetUserId, {
    ban_duration: ban ? '876000h' : 'none',
  })
  if (error) return json({ error: 'toggle_failed', detail: error.message }, 500)
  return json({ ok: true, mode: ban ? 'disable' : 'enable' }, 200)
}

interface MemberContext {
  admin: any
  email: string
  role: Role
  adminUserId: string
  adminOrgId: string
  existingMemberId: string | null
}

async function handleInvite(ctx: MemberContext): Promise<Response> {
  const { admin, email, role, adminUserId, adminOrgId, existingMemberId } = ctx
  const siteUrl = Deno.env.get('SITE_URL')
  if (!siteUrl) {
    return json({ error: 'site_url_not_configured' }, 500)
  }
  const redirectTo = `${siteUrl.replace(/\/$/, '')}/login`
  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { org_id: adminOrgId, role, invited_org_id: adminOrgId, invited_role: role },
  })
  if (inviteErr && !String(inviteErr.message).toLowerCase().includes('already')) {
    return json({ error: 'invite_failed', detail: inviteErr.message }, 500)
  }

  const upsert = existingMemberId
    ? await admin
        .from('org_members')
        .update({
          role,
          invited_by: adminUserId,
          invited_at: new Date().toISOString(),
        })
        .eq('id', existingMemberId)
    : await admin.from('org_members').insert({
        org_id: adminOrgId,
        role,
        invited_email: email,
        invited_by: adminUserId,
      })
  if (upsert.error) {
    return json({ error: 'db_failed', detail: upsert.error.message }, 500)
  }

  return json({ ok: true, mode: 'invite' }, 200)
}

async function handleCreate(
  ctx: MemberContext & { password: string; fullName: string },
): Promise<Response> {
  const { admin, email, role, password, fullName, adminUserId, adminOrgId, existingMemberId } = ctx

  if (!fullName) return json({ error: 'invalid_full_name' }, 400)
  if (!password || password.length < 8) {
    return json({ error: 'invalid_password' }, 400)
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      invited_org_id: adminOrgId,
      invited_role: role,
    },
  })
  if (createErr || !created?.user) {
    return json({ error: 'create_failed', detail: createErr?.message ?? 'unknown' }, 500)
  }

  const newUserId = created.user.id

  // Safety net: the handle_new_user trigger populates the profile with the
  // invited_org_id/invited_role hints. Make sure it actually did so (if the
  // trigger was absent or the hints were lost, repair the profile now).
  const profileRepair = await admin
    .from('profiles')
    .upsert(
      { id: newUserId, org_id: adminOrgId, role, full_name: fullName },
      { onConflict: 'id' },
    )
  if (profileRepair.error) {
    return json(
      { error: 'profile_failed', detail: profileRepair.error.message },
      500,
    )
  }

  const now = new Date().toISOString()
  const memberWrite = existingMemberId
    ? await admin
        .from('org_members')
        .update({
          role,
          user_id: newUserId,
          invited_by: adminUserId,
          invited_at: now,
          accepted_at: now,
        })
        .eq('id', existingMemberId)
    : await admin.from('org_members').insert({
        org_id: adminOrgId,
        role,
        user_id: newUserId,
        invited_email: email,
        invited_by: adminUserId,
        accepted_at: now,
      })
  if (memberWrite.error) {
    return json({ error: 'db_failed', detail: memberWrite.error.message }, 500)
  }

  return json({ ok: true, mode: 'create', userId: newUserId, email }, 200)
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

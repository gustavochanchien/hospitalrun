import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JSONWebKeySet,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose'

export interface VerifiedClaims {
  /** Supabase user id. */
  sub: string
  /** Org the user belongs to — what RLS keys against. */
  orgId: string
  /** admin / doctor / nurse / user. */
  role: string
  /** Unix-seconds expiry. */
  exp: number
}

export interface AuthVerifier {
  verify(token: string): Promise<VerifiedClaims>
}

/**
 * Build a verifier from any jose `JWTVerifyGetKey` (remote JWKS, local
 * JWKS, or a single key). The hub uses this to validate Supabase-issued
 * JWTs in Phase 2; in Phase 3 the same shape will validate hub-signed
 * JWTs as a fallback when offline.
 *
 * Org ID and role are checked at both the top-level (where Supabase's
 * `custom_access_token_hook` injects them) and inside `app_metadata`
 * (the standard Supabase location). Either is accepted; mismatch is
 * fine — the JWT signature is what we trust.
 */
export function createVerifier(getKey: JWTVerifyGetKey): AuthVerifier {
  return {
    async verify(token: string): Promise<VerifiedClaims> {
      const { payload } = await jwtVerify(token, getKey, {
        algorithms: ['RS256', 'ES256'],
      })
      return extractClaims(payload)
    },
  }
}

/**
 * Build a verifier that fetches the Supabase project's JWKS once and
 * caches the keys in memory. Requires Supabase to be configured with
 * asymmetric JWT signing (RS256/ES256) — the hub never has the JWT
 * secret needed for HS256.
 */
export function createSupabaseVerifier(supabaseUrl: string): AuthVerifier {
  const jwksUrl = new URL('/auth/v1/jwks', supabaseUrl)
  const getKey = createRemoteJWKSet(jwksUrl, {
    cacheMaxAge: 10 * 60 * 1000, // 10 min
    cooldownDuration: 30 * 1000, // 30s between retries on miss
  })
  return createVerifier(getKey)
}

/**
 * Verifier that accepts JWTs from either Supabase or the hub's own
 * signing key. Used by the relay during Phase 3 — clients may sign in
 * via cloud (Supabase JWT) or via the hub's offline endpoint
 * (hub-signed JWT). Either is acceptable; the relay checks the
 * resulting claims against `record.orgId`.
 *
 * Resolution strategy: try the hub JWKS first when the JWT's `kid`
 * starts with `hub-`, otherwise try Supabase. Both are tried as a
 * fallback so a misclassified token still verifies correctly.
 */
export function createCombinedVerifier(opts: {
  supabaseUrl?: string
  hubJwks?: JSONWebKeySet
}): AuthVerifier {
  const local = opts.hubJwks ? createLocalJWKSet(opts.hubJwks) : null
  const remote = opts.supabaseUrl
    ? createRemoteJWKSet(new URL('/auth/v1/jwks', opts.supabaseUrl), {
        cacheMaxAge: 10 * 60 * 1000,
        cooldownDuration: 30 * 1000,
      })
    : null

  if (!local && !remote) {
    throw new Error('createCombinedVerifier needs at least one of supabaseUrl or hubJwks')
  }

  const getKey: JWTVerifyGetKey = async (header, token) => {
    const kid = typeof header.kid === 'string' ? header.kid : ''
    const tryOrder: Array<JWTVerifyGetKey | null> = kid.startsWith('hub-')
      ? [local, remote]
      : [remote, local]
    let lastErr: unknown
    for (const fn of tryOrder) {
      if (!fn) continue
      try {
        return await fn(header, token)
      } catch (err) {
        lastErr = err
      }
    }
    throw lastErr ?? new Error('no JWKS source matched')
  }

  return createVerifier(getKey)
}

interface MaybeAppMetadata {
  app_metadata?: { org_id?: unknown; role?: unknown }
  user_metadata?: { org_id?: unknown; role?: unknown }
  org_id?: unknown
  role?: unknown
}

export function extractClaims(payload: JWTPayload): VerifiedClaims {
  const c = payload as JWTPayload & MaybeAppMetadata
  if (typeof c.sub !== 'string') throw new Error('JWT missing sub')
  if (typeof c.exp !== 'number') throw new Error('JWT missing exp')

  const orgId =
    pickString(c.org_id) ?? pickString(c.app_metadata?.org_id) ?? pickString(c.user_metadata?.org_id)
  if (!orgId) throw new Error('JWT missing org_id')

  const role =
    pickString(c.role) ?? pickString(c.app_metadata?.role) ?? pickString(c.user_metadata?.role)
  if (!role) throw new Error('JWT missing role')

  return { sub: c.sub, orgId, role, exp: c.exp }
}

function pickString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

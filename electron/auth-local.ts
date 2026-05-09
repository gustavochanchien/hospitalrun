import { Hono } from 'hono'
import { SignJWT, type JWK, type KeyLike } from 'jose'
import type { AuthCache } from './auth-cache.js'
import type { AuthVerifier } from './auth-verify.js'

/**
 * Hono routes for offline auth on the hub.
 *
 *  - `POST /auth/local/signin`     — `{ email, password }` → hub-signed JWT
 *  - `POST /auth/local/cache`      — `{ email, password, accessToken }` →
 *                                    hub stores a bcrypt hash for the user.
 *                                    `accessToken` must be a valid
 *                                    cloud-issued JWT (proves the user really
 *                                    signed in). Hub never sees the plaintext
 *                                    password until this call.
 *  - `GET  /auth/local/jwks`       — JWKS for the hub's signing key, so other
 *                                    LAN devices' verifiers can validate
 *                                    hub-issued tokens.
 */

const ALG = 'RS256'

export interface AuthLocalDeps {
  cache: AuthCache
  signingKey: KeyLike
  publicJwk: JWK
  kid: string
  /** Used to validate the cloud accessToken in /auth/local/cache. */
  cloudVerifier: AuthVerifier | null
  /** Token TTL in seconds. Default 12 hours. */
  tokenTtlSeconds?: number
  /** issuer claim — defaults to 'hospitalrun-hub'. */
  issuer?: string
}

interface SigninBody {
  email: string
  password: string
}

interface CacheBody {
  email: string
  password: string
  accessToken: string
}

export function createAuthLocalRouter(deps: AuthLocalDeps): Hono {
  const router = new Hono()
  const ttl = deps.tokenTtlSeconds ?? 12 * 60 * 60
  const issuer = deps.issuer ?? 'hospitalrun-hub'

  router.get('/auth/local/jwks', (c) =>
    c.json({ keys: [deps.publicJwk] }, 200, { 'cache-control': 'no-store' }),
  )

  router.post('/auth/local/signin', async (c) => {
    const body = await readJson<SigninBody>(c)
    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
      return c.json({ error: 'email and password required' }, 400)
    }
    const profile = deps.cache.verify(body.email, body.password)
    if (!profile) {
      return c.json({ error: 'invalid credentials' }, 401)
    }
    const token = await new SignJWT({
      org_id: profile.orgId,
      role: profile.role,
      email: profile.email,
    })
      .setProtectedHeader({ alg: ALG, kid: deps.kid })
      .setIssuedAt()
      .setIssuer(issuer)
      .setSubject(profile.userId)
      .setExpirationTime(`${ttl}s`)
      .sign(deps.signingKey)
    return c.json({
      accessToken: token,
      issuer,
      profile: {
        userId: profile.userId,
        email: profile.email,
        orgId: profile.orgId,
        role: profile.role,
      },
    })
  })

  router.post('/auth/local/cache', async (c) => {
    const body = await readJson<CacheBody>(c)
    if (
      !body ||
      typeof body.email !== 'string' ||
      typeof body.password !== 'string' ||
      typeof body.accessToken !== 'string'
    ) {
      return c.json({ error: 'email, password, and accessToken required' }, 400)
    }
    if (!deps.cloudVerifier) {
      return c.json({ error: 'cloud verifier not configured' }, 503)
    }
    let claims
    try {
      claims = await deps.cloudVerifier.verify(body.accessToken)
    } catch (err) {
      return c.json(
        { error: 'invalid accessToken', detail: err instanceof Error ? err.message : 'verify failed' },
        401,
      )
    }
    deps.cache.populate(body.email, body.password, {
      userId: claims.sub,
      orgId: claims.orgId,
      role: claims.role,
    })
    return c.json({ ok: true })
  })

  return router
}

async function readJson<T>(c: { req: { json: () => Promise<unknown> } }): Promise<T | null> {
  try {
    return (await c.req.json()) as T
  } catch {
    return null
  }
}

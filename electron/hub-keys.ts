import { promises as fs } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { generateKeyPair, exportJWK, importJWK, type JWK, type KeyLike } from 'jose'

/**
 * RSA keypair the hub uses to sign offline JWTs (Phase 3).
 *
 * Persisted (unencrypted) under Electron's userData. Per the plan's
 * "trusted-LAN model" for v1, no SQLCipher / OS keychain integration —
 * a v2 work item if regulatory pressure mounts.
 *
 * Keys live forever once generated. Rotation is out of scope for v1.
 */

const KEY_FILE = 'hub-signing-key.json'
const ALG = 'RS256'
const KID_PREFIX = 'hub-'

export interface HubKeySet {
  /** Used to sign JWTs in `auth-local.ts`. */
  signingKey: KeyLike
  /** Public key for the relay's JWKS so the verifier accepts our tokens. */
  publicJwk: JWK
  /** kid identifier for the public JWK. */
  kid: string
}

interface PersistedKeys {
  kid: string
  privateJwk: JWK
  publicJwk: JWK
}

function keyFilePath(): string {
  return path.join(app.getPath('userData'), KEY_FILE)
}

async function readPersisted(file: string): Promise<PersistedKeys | null> {
  try {
    const raw = await fs.readFile(file, 'utf8')
    const parsed = JSON.parse(raw) as Partial<PersistedKeys>
    if (
      typeof parsed.kid === 'string' &&
      parsed.privateJwk &&
      parsed.publicJwk &&
      typeof parsed.privateJwk === 'object' &&
      typeof parsed.publicJwk === 'object'
    ) {
      return parsed as PersistedKeys
    }
    return null
  } catch {
    return null
  }
}

async function writePersisted(file: string, keys: PersistedKeys): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  // 0600 — owner read/write only
  await fs.writeFile(file, JSON.stringify(keys, null, 2), { encoding: 'utf8', mode: 0o600 })
}

function newKid(): string {
  // 8 random bytes hex, prefixed so we can identify hub-issued JWTs in logs
  return KID_PREFIX + crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

/**
 * Load the hub's signing key from disk, generating one on first run.
 * Idempotent — calling twice returns the same in-memory KeyLike.
 */
export async function loadOrCreateHubKeys(filePathOverride?: string): Promise<HubKeySet> {
  const file = filePathOverride ?? keyFilePath()
  const existing = await readPersisted(file)
  if (existing) {
    const signingKey = (await importJWK(existing.privateJwk, ALG)) as KeyLike
    return { signingKey, publicJwk: { ...existing.publicJwk, kid: existing.kid, alg: ALG, use: 'sig' }, kid: existing.kid }
  }

  const { privateKey, publicKey } = await generateKeyPair(ALG, { extractable: true })
  const privateJwk = await exportJWK(privateKey)
  const publicJwk = await exportJWK(publicKey)
  const kid = newKid()
  privateJwk.alg = ALG
  publicJwk.alg = ALG
  publicJwk.use = 'sig'
  publicJwk.kid = kid

  await writePersisted(file, { kid, privateJwk, publicJwk })

  return { signingKey: privateKey as KeyLike, publicJwk, kid }
}

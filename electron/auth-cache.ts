import path from 'node:path'
import { app } from 'electron'
import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import type { Database as Db } from 'better-sqlite3'

/**
 * Cached profiles for offline sign-in (Phase 3).
 *
 * Populated opportunistically: when a user signs in successfully via
 * cloud Supabase, the renderer also POSTs their plaintext password to
 * the hub which stores a bcrypt hash here. Later, when the cloud is
 * unreachable, the renderer can sign in via the hub against this cache.
 *
 * Stored unencrypted on disk per the v1 trusted-LAN model. Defense in
 * depth (SQLCipher, OS keychain) is parked for v2.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS auth_cache (
  email          TEXT PRIMARY KEY,
  bcrypt_hash    TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  org_id         TEXT NOT NULL,
  role           TEXT NOT NULL,
  last_verified  INTEGER NOT NULL
);
`

const BCRYPT_COST = 10

export interface CachedProfile {
  email: string
  userId: string
  orgId: string
  role: string
  lastVerified: number
}

export interface AuthCache {
  /** Insert or update the cache entry; password is hashed before storage. */
  populate(email: string, password: string, profile: Omit<CachedProfile, 'email' | 'lastVerified'>): void
  /** Returns the cached profile if the password matches, else null. */
  verify(email: string, password: string): CachedProfile | null
  /** Look up the profile without a password (e.g. for diagnostics). */
  lookup(email: string): CachedProfile | null
  /** Returns the org_id shared by all cached users, or null if cache is empty. */
  getAnyOrgId(): string | null
  /** Forget a single user (e.g. on admin removal). */
  forget(email: string): void
  close(): void
}

interface CacheRow {
  email: string
  bcrypt_hash: string
  user_id: string
  org_id: string
  role: string
  last_verified: number
}

export function defaultAuthCachePath(): string {
  return path.join(app.getPath('userData'), 'auth-cache.sqlite')
}

export function openAuthCache(filePath: string): AuthCache {
  const db: Db = new Database(filePath)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.exec(SCHEMA)

  const stmtSelect = db.prepare<[string], CacheRow>(
    `SELECT * FROM auth_cache WHERE email = ?`,
  )
  const stmtUpsert = db.prepare<[string, string, string, string, string, number]>(
    `INSERT INTO auth_cache (email, bcrypt_hash, user_id, org_id, role, last_verified)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       bcrypt_hash = excluded.bcrypt_hash,
       user_id     = excluded.user_id,
       org_id      = excluded.org_id,
       role        = excluded.role,
       last_verified = excluded.last_verified`,
  )
  const stmtTouch = db.prepare<[number, string]>(
    `UPDATE auth_cache SET last_verified = ? WHERE email = ?`,
  )
  const stmtDelete = db.prepare<[string]>(`DELETE FROM auth_cache WHERE email = ?`)
  const stmtAnyOrgId = db.prepare<[], { org_id: string }>(`SELECT org_id FROM auth_cache LIMIT 1`)

  function rowToProfile(row: CacheRow): CachedProfile {
    return {
      email: row.email,
      userId: row.user_id,
      orgId: row.org_id,
      role: row.role,
      lastVerified: row.last_verified,
    }
  }

  return {
    populate(email, password, profile) {
      if (!password) throw new Error('password is required')
      const hash = bcrypt.hashSync(password, BCRYPT_COST)
      stmtUpsert.run(
        email.toLowerCase(),
        hash,
        profile.userId,
        profile.orgId,
        profile.role,
        Date.now(),
      )
    },
    verify(email, password) {
      const row = stmtSelect.get(email.toLowerCase())
      if (!row) return null
      const ok = bcrypt.compareSync(password, row.bcrypt_hash)
      if (!ok) return null
      const now = Date.now()
      stmtTouch.run(now, row.email)
      return { ...rowToProfile(row), lastVerified: now }
    },
    lookup(email) {
      const row = stmtSelect.get(email.toLowerCase())
      return row ? rowToProfile(row) : null
    },
    getAnyOrgId() {
      const row = stmtAnyOrgId.get()
      return row ? row.org_id : null
    },
    forget(email) {
      stmtDelete.run(email.toLowerCase())
    },
    close() {
      db.close()
    },
  }
}

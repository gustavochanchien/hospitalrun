import path from 'node:path'
import { app } from 'electron'
import Database from 'better-sqlite3'
import type { Database as Db } from 'better-sqlite3'

/**
 * Append-and-LWW write log for the LAN sync relay.
 *
 * Each `(orgId, tableName, recordId)` triple has a single row in the
 * `latest` table. The row's `cursor` is monotonically assigned from
 * SQLite's `INTEGER PRIMARY KEY AUTOINCREMENT`, so:
 *  - Catch-up: a peer with `lastSeenCursor` asks for everything where
 *    `cursor > lastSeenCursor`. Because we delete the old row before
 *    inserting the new one, every replay reflects only the latest
 *    version of any record.
 *  - LWW: an incoming write whose `updatedAt` is `<=` the stored
 *    `updated_at` is dropped and `appendIfNewer` returns `{ skipped: true }`.
 *
 * The `payload` is stored as JSON-encoded TEXT (not BLOB) for easier
 * inspection during incidents — sync rates are well below the level
 * where the encoding cost matters.
 */

export interface AppendArgs {
  orgId: string
  tableName: string
  recordId: string
  /** ISO 8601 timestamp; LWW comparison is lexicographic (works for ISO). */
  updatedAt: string
  /** Full record. Must be JSON-serializable. */
  record: unknown
}

export type AppendResult = { cursor: number } | { skipped: true }

export interface LogEntry {
  cursor: number
  record: unknown
}

export interface LogStore {
  /** Insert if newer than the stored version; LWW by `updatedAt`. */
  appendIfNewer(args: AppendArgs): AppendResult
  /** All entries with `cursor > sinceCursor` for the given org, in order. */
  replaySince(orgId: string, sinceCursor: number): LogEntry[]
  /** Largest cursor for the given org, or 0 if none. */
  head(orgId: string): number
  close(): void
}

interface ExistingRow {
  cursor: number
  updated_at: string
}

interface ReplayRow {
  cursor: number
  record: string
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS latest (
  cursor      INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id      TEXT NOT NULL,
  table_name  TEXT NOT NULL,
  record_id   TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  record      TEXT NOT NULL,
  UNIQUE (org_id, table_name, record_id)
);
CREATE INDEX IF NOT EXISTS idx_latest_org_cursor ON latest(org_id, cursor);
`

export function defaultLogStorePath(): string {
  return path.join(app.getPath('userData'), 'sync-log.sqlite')
}

export function openLogStore(filePath: string): LogStore {
  const db: Db = new Database(filePath)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)

  const stmtFind = db.prepare<[string, string, string], ExistingRow>(
    `SELECT cursor, updated_at FROM latest
     WHERE org_id = ? AND table_name = ? AND record_id = ?`,
  )
  const stmtDelete = db.prepare<[number]>(`DELETE FROM latest WHERE cursor = ?`)
  const stmtInsert = db.prepare<[string, string, string, string, string]>(
    `INSERT INTO latest (org_id, table_name, record_id, updated_at, record)
     VALUES (?, ?, ?, ?, ?)`,
  )
  const stmtReplay = db.prepare<[string, number], ReplayRow>(
    `SELECT cursor, record FROM latest
     WHERE org_id = ? AND cursor > ?
     ORDER BY cursor ASC`,
  )
  const stmtHead = db.prepare<[string], { h: number | null }>(
    `SELECT MAX(cursor) AS h FROM latest WHERE org_id = ?`,
  )

  const append = db.transaction((args: AppendArgs): AppendResult => {
    const existing = stmtFind.get(args.orgId, args.tableName, args.recordId)
    if (existing && existing.updated_at >= args.updatedAt) {
      return { skipped: true }
    }
    if (existing) {
      stmtDelete.run(existing.cursor)
    }
    const result = stmtInsert.run(
      args.orgId,
      args.tableName,
      args.recordId,
      args.updatedAt,
      JSON.stringify(args.record),
    )
    return { cursor: Number(result.lastInsertRowid) }
  })

  return {
    appendIfNewer(args) {
      return append(args)
    },
    replaySince(orgId, sinceCursor) {
      const rows = stmtReplay.all(orgId, sinceCursor)
      return rows.map((r) => ({ cursor: r.cursor, record: JSON.parse(r.record) }))
    },
    head(orgId) {
      const row = stmtHead.get(orgId)
      return row?.h ?? 0
    },
    close() {
      db.close()
    },
  }
}

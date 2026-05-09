// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/hr-test',
    getName: () => 'HospitalRun',
    getVersion: () => '0.0.0-test',
  },
}))

import { openLogStore, type LogStore } from './log-store'

let tmpDir: string
let store: LogStore

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hr-logstore-'))
  store = openLogStore(path.join(tmpDir, 'log.sqlite'))
})

afterEach(async () => {
  store.close()
  await fs.rm(tmpDir, { recursive: true, force: true })
})

const orgA = 'org-a'
const orgB = 'org-b'

function patient(id: string, name: string, updatedAt: string) {
  return {
    orgId: orgA,
    tableName: 'patients',
    recordId: id,
    updatedAt,
    record: { id, orgId: orgA, familyName: name, updatedAt },
  }
}

describe('log-store appendIfNewer', () => {
  it('inserts a new record and returns a cursor', () => {
    const r = store.appendIfNewer(patient('p1', 'Smith', '2026-01-01T00:00:00Z'))
    expect(r).toEqual({ cursor: expect.any(Number) })
    if ('cursor' in r) expect(r.cursor).toBeGreaterThan(0)
  })

  it('skips an older write for the same record', () => {
    store.appendIfNewer(patient('p1', 'Smith', '2026-01-02T00:00:00Z'))
    const r = store.appendIfNewer(patient('p1', 'Old', '2026-01-01T00:00:00Z'))
    expect(r).toEqual({ skipped: true })
  })

  it('skips a write whose updated_at equals the stored one', () => {
    const ts = '2026-01-02T00:00:00Z'
    store.appendIfNewer(patient('p1', 'Smith', ts))
    const r = store.appendIfNewer(patient('p1', 'Other', ts))
    expect(r).toEqual({ skipped: true })
  })

  it('replaces an older write with a newer one and advances the cursor', () => {
    const r1 = store.appendIfNewer(patient('p1', 'Old', '2026-01-01T00:00:00Z'))
    const r2 = store.appendIfNewer(patient('p1', 'New', '2026-01-02T00:00:00Z'))
    expect('cursor' in r1 && 'cursor' in r2).toBe(true)
    if ('cursor' in r1 && 'cursor' in r2) {
      expect(r2.cursor).toBeGreaterThan(r1.cursor)
    }
  })

  it('keeps writes from different orgs independent', () => {
    store.appendIfNewer({ ...patient('p1', 'A', '2026-01-01T00:00:00Z') })
    const r = store.appendIfNewer({
      ...patient('p1', 'B', '2026-01-01T00:00:00Z'),
      orgId: orgB,
    })
    // Same table+id but different org: should be inserted, not skipped
    expect(r).toEqual({ cursor: expect.any(Number) })
  })
})

describe('log-store replaySince', () => {
  it('returns nothing for empty store', () => {
    expect(store.replaySince(orgA, 0)).toEqual([])
  })

  it('returns all entries since cursor 0, in cursor order', () => {
    const a = store.appendIfNewer(patient('p1', 'A', '2026-01-01T00:00:00Z'))
    const b = store.appendIfNewer(patient('p2', 'B', '2026-01-02T00:00:00Z'))
    const c = store.appendIfNewer(patient('p3', 'C', '2026-01-03T00:00:00Z'))
    expect('cursor' in a && 'cursor' in b && 'cursor' in c).toBe(true)

    const replay = store.replaySince(orgA, 0)
    expect(replay).toHaveLength(3)
    expect(replay[0]?.cursor).toBeLessThan(replay[1]!.cursor)
    expect(replay[1]?.cursor).toBeLessThan(replay[2]!.cursor)
  })

  it('returns only the latest version of each record', () => {
    store.appendIfNewer(patient('p1', 'Old', '2026-01-01T00:00:00Z'))
    store.appendIfNewer(patient('p1', 'New', '2026-01-02T00:00:00Z'))
    const replay = store.replaySince(orgA, 0)
    expect(replay).toHaveLength(1)
    const rec = replay[0]?.record as { familyName: string }
    expect(rec.familyName).toBe('New')
  })

  it('honours sinceCursor', () => {
    const a = store.appendIfNewer(patient('p1', 'A', '2026-01-01T00:00:00Z'))
    expect('cursor' in a).toBe(true)
    if (!('cursor' in a)) return
    store.appendIfNewer(patient('p2', 'B', '2026-01-02T00:00:00Z'))

    const replay = store.replaySince(orgA, a.cursor)
    expect(replay).toHaveLength(1)
    const rec = replay[0]?.record as { familyName: string }
    expect(rec.familyName).toBe('B')
  })

  it('isolates orgs', () => {
    store.appendIfNewer(patient('p1', 'A', '2026-01-01T00:00:00Z'))
    store.appendIfNewer({ ...patient('p9', 'X', '2026-01-01T00:00:00Z'), orgId: orgB })
    expect(store.replaySince(orgA, 0)).toHaveLength(1)
    expect(store.replaySince(orgB, 0)).toHaveLength(1)
  })
})

describe('log-store head', () => {
  it('returns 0 for an empty org', () => {
    expect(store.head(orgA)).toBe(0)
  })

  it('returns the largest cursor for the given org', () => {
    store.appendIfNewer(patient('p1', 'A', '2026-01-01T00:00:00Z'))
    const b = store.appendIfNewer(patient('p2', 'B', '2026-01-02T00:00:00Z'))
    expect('cursor' in b).toBe(true)
    if (!('cursor' in b)) return
    expect(store.head(orgA)).toBe(b.cursor)
  })

  it('does not leak between orgs', () => {
    store.appendIfNewer({ ...patient('p1', 'A', '2026-01-01T00:00:00Z'), orgId: orgB })
    expect(store.head(orgA)).toBe(0)
    expect(store.head(orgB)).toBeGreaterThan(0)
  })
})

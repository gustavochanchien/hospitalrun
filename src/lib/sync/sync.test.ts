import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
import type { Patient } from '@/lib/db/schema'
import { setLanTransport } from './transport-router'
import type { LanTransport, WriteAck } from './lan-transport'

// Mock Supabase client before importing sync
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
  isHubLocalMode: vi.fn(() => false),
}))

// Import after mocking
const { flushSyncQueue, getLastCloudSyncAt } = await import('./sync')
const { supabase } = await import('@/lib/supabase/client')

const LAST_CLOUD_SYNC_KEY = 'hr_last_cloud_sync'

function fakeLan(overrides: Partial<LanTransport> = {}): LanTransport {
  const fake: LanTransport = {
    start: vi.fn(),
    stop: vi.fn(),
    state: () => 'connected',
    cursor: () => 0,
    writeRecord: vi.fn(async (): Promise<WriteAck> => ({ ok: true, cursor: 1, skipped: false })),
    ...overrides,
  }
  return fake
}

const orgId = 'org-sync'

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: crypto.randomUUID(),
    orgId,
    mrn: null,
    prefix: null,
    givenName: 'Sync',
    familyName: 'Test',
    suffix: null,
    dateOfBirth: null,
    isApproximateDateOfBirth: null,
    sex: null,
    bloodType: null,
    occupation: null,
    preferredLanguage: null,
    phone: null,
    email: null,
    address: null,
    status: 'active',
    deletedAt: null,
    createdAt: '',
    updatedAt: '',
    _synced: false,
    _deleted: false,
    ...overrides,
  }
}

beforeEach(async () => {
  await db.transaction('rw', db.patients, db.syncQueue, async () => {
    await db.patients.clear()
    await db.syncQueue.clear()
  })
  localStorage.removeItem(LAST_CLOUD_SYNC_KEY)
  vi.clearAllMocks()
})

afterEach(() => {
  // Restore navigator.onLine
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
  // Clear any registered LAN transport so tests don't bleed into each other
  setLanTransport(null)
})

describe('flushSyncQueue', () => {
  it('does nothing when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })

    const patient = makePatient()
    await dbPut('patients', patient, 'insert')
    await flushSyncQueue()

    // Queue should still have the entry
    const queue = await db.syncQueue.toArray()
    expect(queue).toHaveLength(1)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('does nothing when syncQueue is empty', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
    await flushSyncQueue()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('calls supabase.from().upsert() for each queued record', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })

    const patient = makePatient()
    await dbPut('patients', patient, 'insert')

    await flushSyncQueue()

    expect(supabase.from).toHaveBeenCalledWith('patients')
  })

  it('marks the record as _synced after successful push', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })

    const patient = makePatient()
    await dbPut('patients', patient, 'insert')

    await flushSyncQueue()

    const stored = await db.patients.get(patient.id)
    expect(stored?._synced).toBe(true)
  })

  it('removes the entry from syncQueue after success', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })

    const patient = makePatient()
    await dbPut('patients', patient, 'insert')

    await flushSyncQueue()

    const queue = await db.syncQueue.toArray()
    expect(queue).toHaveLength(0)
  })

  it('falls back to LAN transport when offline and a transport is registered', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })
    const lan = fakeLan()
    setLanTransport(lan)

    const patient = makePatient()
    await dbPut('patients', patient, 'insert')

    await flushSyncQueue()

    expect(lan.writeRecord).toHaveBeenCalledTimes(1)
    expect(supabase.from).not.toHaveBeenCalled()
    const queue = await db.syncQueue.toArray()
    expect(queue).toHaveLength(0)
    const stored = await db.patients.get(patient.id)
    expect(stored?._synced).toBe(true)
  })

  it('falls back to LAN transport when cloud upsert errors', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
    vi.mocked(supabase.from).mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: new Error('cloud down') }),
    } as never)
    const lan = fakeLan()
    setLanTransport(lan)

    const patient = makePatient()
    await dbPut('patients', patient, 'insert')

    await flushSyncQueue()

    expect(supabase.from).toHaveBeenCalled()
    expect(lan.writeRecord).toHaveBeenCalledTimes(1)
    const queue = await db.syncQueue.toArray()
    expect(queue).toHaveLength(0)
  })

  it('leaves queue intact when both cloud and LAN fail', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
    vi.mocked(supabase.from).mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: new Error('cloud down') }),
    } as never)
    setLanTransport(
      fakeLan({
        writeRecord: vi.fn(async (): Promise<WriteAck> => ({
          ok: false,
          code: 'lan/error',
          message: 'lan down too',
        })),
      }),
    )

    const patient = makePatient()
    await dbPut('patients', patient, 'insert')

    await flushSyncQueue()

    const queue = await db.syncQueue.toArray()
    expect(queue).toHaveLength(1)
  })

  it('stops processing on supabase error and leaves queue intact', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })

    // Make the mock return an error
    vi.mocked(supabase.from).mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: new Error('network error') }),
    } as never)

    const patient = makePatient()
    await dbPut('patients', patient, 'insert')

    await flushSyncQueue()

    // Queue entry should remain since push failed
    const queue = await db.syncQueue.toArray()
    expect(queue).toHaveLength(1)
  })

  it('records a last-cloud-sync timestamp after a successful cloud push', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
    // Reset supabase.from to the success-returning default — earlier tests
    // may have overridden it via mockReturnValue.
    vi.mocked(supabase.from).mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    } as never)

    const before = Date.now()
    expect(getLastCloudSyncAt()).toBeNull()

    const patient = makePatient()
    await dbPut('patients', patient, 'insert')
    await flushSyncQueue()

    const at = getLastCloudSyncAt()
    expect(at).not.toBeNull()
    expect(at!).toBeGreaterThanOrEqual(before)
  })

  it('records a timestamp when flushing an empty queue while online', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
    expect(getLastCloudSyncAt()).toBeNull()

    await flushSyncQueue()

    expect(getLastCloudSyncAt()).not.toBeNull()
  })

  it('does not record a timestamp when offline with an empty queue', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })

    await flushSyncQueue()

    expect(getLastCloudSyncAt()).toBeNull()
  })
})

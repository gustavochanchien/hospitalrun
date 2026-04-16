import { describe, it, expect, beforeEach } from 'vitest'
import type { Patient } from './schema'
import { dbPut, dbDelete, diffFields, recordPatientHistory } from './write'
import { db } from './index'

const orgId = 'org-test'

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: crypto.randomUUID(),
    orgId,
    mrn: null,
    prefix: null,
    givenName: 'John',
    familyName: 'Doe',
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
  // Clear all tables before each test
  await db.transaction('rw', db.patients, db.syncQueue, async () => {
    await db.patients.clear()
    await db.syncQueue.clear()
  })
})

describe('dbPut (insert)', () => {
  it('writes the record to the target table', async () => {
    const patient = makePatient()
    await dbPut('patients', patient, 'insert')

    const stored = await db.patients.get(patient.id)
    expect(stored).toBeDefined()
    expect(stored?.givenName).toBe('John')
  })

  it('sets _synced to false', async () => {
    const patient = makePatient({ _synced: true })
    await dbPut('patients', patient, 'insert')

    const stored = await db.patients.get(patient.id)
    expect(stored?._synced).toBe(false)
  })

  it('sets createdAt and updatedAt on insert', async () => {
    const patient = makePatient()
    await dbPut('patients', patient, 'insert')

    const stored = await db.patients.get(patient.id)
    expect(stored?.createdAt).not.toBe('')
    expect(stored?.updatedAt).not.toBe('')
  })

  it('does not overwrite createdAt on update', async () => {
    const patient = makePatient()
    await dbPut('patients', patient, 'insert')
    const first = await db.patients.get(patient.id)
    const originalCreatedAt = first?.createdAt
    expect(originalCreatedAt).not.toBe('')

    // Use the stored record (with real timestamps) as the base for the update
    await dbPut('patients', { ...first!, givenName: 'Jane' }, 'update')
    const updated = await db.patients.get(patient.id)
    expect(updated?.createdAt).toBe(originalCreatedAt)
    expect(updated?.givenName).toBe('Jane')
  })

  it('adds an entry to syncQueue', async () => {
    const patient = makePatient()
    await dbPut('patients', patient, 'insert')

    const queue = await db.syncQueue.toArray()
    expect(queue).toHaveLength(1)
    expect(queue[0].tableName).toBe('patients')
    expect(queue[0].recordId).toBe(patient.id)
    expect(queue[0].operation).toBe('insert')
  })
})

describe('dbDelete', () => {
  it('soft-deletes the record (_deleted = true)', async () => {
    const patient = makePatient()
    await dbPut('patients', patient, 'insert')
    await db.syncQueue.clear() // reset queue

    await dbDelete('patients', patient.id)

    const stored = await db.patients.get(patient.id)
    expect(stored?._deleted).toBe(true)
    expect(stored?.deletedAt).not.toBeNull()
  })

  it('sets _synced to false on delete', async () => {
    const patient = makePatient()
    await dbPut('patients', patient, 'insert')
    await db.syncQueue.clear()

    await dbDelete('patients', patient.id)
    const stored = await db.patients.get(patient.id)
    expect(stored?._synced).toBe(false)
  })

  it('adds a delete entry to syncQueue', async () => {
    const patient = makePatient()
    await dbPut('patients', patient, 'insert')
    await db.syncQueue.clear()

    await dbDelete('patients', patient.id)

    const queue = await db.syncQueue.toArray()
    expect(queue).toHaveLength(1)
    expect(queue[0].operation).toBe('delete')
    expect(queue[0].recordId).toBe(patient.id)
  })
})

describe('diffFields', () => {
  it('returns entries only for fields that changed', () => {
    expect(
      diffFields({ a: '1', b: '2' }, { a: '1', b: '3' }, ['a', 'b']),
    ).toEqual([{ fieldName: 'b', oldValue: '2', newValue: '3' }])
  })

  it('handles null/undefined previous', () => {
    expect(diffFields(null, { a: 'x' }, ['a'])).toEqual([
      { fieldName: 'a', oldValue: null, newValue: 'x' },
    ])
  })

  it('returns [] when nothing changed', () => {
    expect(diffFields({ a: '1' }, { a: '1' }, ['a'])).toEqual([])
  })
})

describe('recordPatientHistory', () => {
  beforeEach(async () => {
    await db.patientHistory.clear()
  })

  it('is a no-op when changes are empty', async () => {
    await recordPatientHistory({
      orgId: 'o',
      patientId: 'p',
      changedBy: null,
      changes: [],
    })
    expect(await db.patientHistory.count()).toBe(0)
  })

  it('writes one row per change with a shared timestamp', async () => {
    await recordPatientHistory({
      orgId: 'org-1',
      patientId: 'pat-1',
      changedBy: 'u1',
      changes: [
        { fieldName: 'givenName', oldValue: 'A', newValue: 'B' },
        { fieldName: 'familyName', oldValue: 'X', newValue: 'Y' },
      ],
    })
    const rows = await db.patientHistory
      .where('patientId')
      .equals('pat-1')
      .toArray()
    expect(rows).toHaveLength(2)
    expect(rows[0].changedAt).toBe(rows[1].changedAt)
    expect(rows[0].orgId).toBe('org-1')
    expect(rows.map((r) => r.fieldName).sort()).toEqual([
      'familyName',
      'givenName',
    ])
  })
})

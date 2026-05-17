import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { useAuthStore } from '@/features/auth/auth.store'
import { db } from './index'
import { recordAccessEvent } from './access-log'
import { dbDelete, dbPut } from './write'

function signIn(role = 'doctor') {
  useAuthStore.setState({
    user: { id: 'user-1', email: 'doc@example.com' } as User,
    orgId: 'org-1',
    role,
    isLoading: false,
    session: null,
    issuer: null,
    hubAccessToken: null,
  })
}

function signOut() {
  useAuthStore.setState({
    user: null,
    orgId: null,
    role: null,
    session: null,
    isLoading: false,
    issuer: null,
    hubAccessToken: null,
  })
}

beforeEach(async () => {
  await db.transaction(
    'rw',
    db.accessLogs,
    db.patients,
    db.labs,
    db.syncQueue,
    async () => {
      await db.accessLogs.clear()
      await db.patients.clear()
      await db.labs.clear()
      await db.syncQueue.clear()
    },
  )
  signIn()
})

describe('recordAccessEvent', () => {
  it('writes an access log entry with identity from the auth store', async () => {
    await recordAccessEvent({
      action: 'view',
      resourceType: 'patient',
      resourceId: 'pat-1',
      patientId: 'pat-1',
    })

    const rows = await db.accessLogs.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: 'view',
      resourceType: 'patient',
      resourceId: 'pat-1',
      patientId: 'pat-1',
      orgId: 'org-1',
      userId: 'user-1',
      userEmail: 'doc@example.com',
      userRole: 'doctor',
      _synced: false,
    })
    expect(rows[0].id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(rows[0].occurredAt).not.toBe('')
  })

  it('enqueues the entry for sync', async () => {
    await recordAccessEvent({
      action: 'view',
      resourceType: 'patient',
      resourceId: 'pat-1',
      patientId: 'pat-1',
    })
    const queue = await db.syncQueue.toArray()
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({
      tableName: 'accessLogs',
      operation: 'insert',
    })
  })

  it('is a no-op when the user is not signed in', async () => {
    signOut()
    await recordAccessEvent({ action: 'view', resourceType: 'patient' })
    expect(await db.accessLogs.count()).toBe(0)
    expect(await db.syncQueue.count()).toBe(0)
  })

  it('does not throw if Dexie write fails', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const original = db.accessLogs.add
    db.accessLogs.add = vi.fn().mockRejectedValue(new Error('boom')) as never
    await expect(
      recordAccessEvent({ action: 'view', resourceType: 'patient' }),
    ).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalled()
    db.accessLogs.add = original
    spy.mockRestore()
  })
})

describe('dbPut / dbDelete auto-emit', () => {
  it('writes an audit entry when creating a PHI record', async () => {
    await dbPut(
      'patients',
      {
        id: 'pat-1',
        orgId: 'org-1',
        mrn: null,
        prefix: null,
        givenName: 'A',
        familyName: 'B',
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
      },
      'insert',
    )
    const logs = await db.accessLogs.toArray()
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      action: 'create',
      resourceType: 'patient',
      resourceId: 'pat-1',
      patientId: 'pat-1',
    })
  })

  it('writes an audit entry on update with the correct patientId', async () => {
    await db.labs.put({
      id: 'lab-1',
      orgId: 'org-1',
      patientId: 'pat-9',
      visitId: null,
      code: null,
      type: 'CBC',
      status: 'requested',
      requestedBy: null,
      requestedAt: new Date().toISOString(),
      completedAt: null,
      canceledAt: null,
      result: null,
      numericValue: null,
      unit: null,
      notes: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _synced: true,
      _deleted: false,
    })
    const lab = (await db.labs.get('lab-1'))!
    await dbPut('labs', { ...lab, result: 'positive' }, 'update')
    const logs = await db.accessLogs.toArray()
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      action: 'update',
      resourceType: 'lab',
      resourceId: 'lab-1',
      patientId: 'pat-9',
    })
  })

  it('writes an audit entry on soft-delete that includes patientId', async () => {
    await db.labs.put({
      id: 'lab-2',
      orgId: 'org-1',
      patientId: 'pat-9',
      visitId: null,
      code: null,
      type: 'CBC',
      status: 'requested',
      requestedBy: null,
      requestedAt: new Date().toISOString(),
      completedAt: null,
      canceledAt: null,
      result: null,
      numericValue: null,
      unit: null,
      notes: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _synced: true,
      _deleted: false,
    })
    await dbDelete('labs', 'lab-2')
    const logs = await db.accessLogs.toArray()
    expect(logs.find((l) => l.action === 'delete')).toMatchObject({
      action: 'delete',
      resourceType: 'lab',
      resourceId: 'lab-2',
      patientId: 'pat-9',
    })
  })

  it('does NOT emit an audit entry for non-PHI tables', async () => {
    await dbPut(
      'orgFeatures',
      {
        id: 'of-1',
        orgId: 'org-1',
        feature: 'billing',
        enabled: true,
        deletedAt: null,
        createdAt: '',
        updatedAt: '',
        _synced: false,
        _deleted: false,
      },
      'insert',
    )
    expect(await db.accessLogs.count()).toBe(0)
  })

  it('skipAudit suppresses emission (for inbound sync writes)', async () => {
    await dbPut(
      'patients',
      {
        id: 'pat-3',
        orgId: 'org-1',
        mrn: null,
        prefix: null,
        givenName: 'A',
        familyName: 'B',
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
      },
      'insert',
      { skipAudit: true },
    )
    expect(await db.accessLogs.count()).toBe(0)
  })
})

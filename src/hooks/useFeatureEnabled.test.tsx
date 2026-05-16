import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { useFeatureEnabled, useEnabledFeatures } from './useFeatureEnabled'
import type { OrgFeature, UserFeature } from '@/lib/db/schema'

const orgId = 'org-ff-1'
const userId = 'user-ff-1'

function nowIso() {
  return new Date().toISOString()
}

async function setOrgFeature(feature: string, enabled: boolean) {
  const row: OrgFeature = {
    id: `org-${feature}`,
    orgId,
    feature,
    enabled,
    deletedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    _synced: false,
    _deleted: false,
  }
  await dbPut('orgFeatures', row, 'insert')
}

async function setUserGrant(feature: string, granted: boolean) {
  const row: UserFeature = {
    id: `user-${feature}`,
    userId,
    orgId,
    feature,
    granted,
    deletedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    _synced: false,
    _deleted: false,
  }
  await dbPut('userFeatures', row, 'insert')
}

function signIn(role: 'admin' | 'doctor' | 'nurse' | 'user') {
  useAuthStore.setState({
    user: { id: userId, email: 'a@b.com' } as never,
    session: null,
    orgId,
    role,
    isLoading: false,
  })
}

beforeEach(async () => {
  await db.transaction('rw', db.orgFeatures, db.userFeatures, db.syncQueue, async () => {
    await db.orgFeatures.clear()
    await db.userFeatures.clear()
    await db.syncQueue.clear()
  })
  signIn('user')
})

describe('useFeatureEnabled', () => {
  it('returns false when no org row exists', async () => {
    const { result } = renderHook(() => useFeatureEnabled('billing'))
    await waitFor(() => expect(result.current).toBe(false))
  })

  it('returns false when org-enabled but user is not granted (non-admin)', async () => {
    await setOrgFeature('billing', true)
    const { result } = renderHook(() => useFeatureEnabled('billing'))
    await waitFor(() => expect(result.current).toBe(false))
  })

  it('returns false when org-disabled even if user is granted', async () => {
    await setOrgFeature('billing', false)
    await setUserGrant('billing', true)
    const { result } = renderHook(() => useFeatureEnabled('billing'))
    await waitFor(() => expect(result.current).toBe(false))
  })

  it('returns true when both org-enabled and user-granted', async () => {
    await setOrgFeature('billing', true)
    await setUserGrant('billing', true)
    const { result } = renderHook(() => useFeatureEnabled('billing'))
    await waitFor(() => expect(result.current).toBe(true))
  })

  it('admins bypass user-level grant (still need org-enabled)', async () => {
    signIn('admin')
    await setOrgFeature('billing', true)
    const { result } = renderHook(() => useFeatureEnabled('billing'))
    await waitFor(() => expect(result.current).toBe(true))
  })

  it('admins still gated by org enablement', async () => {
    signIn('admin')
    await setOrgFeature('billing', false)
    const { result } = renderHook(() => useFeatureEnabled('billing'))
    await waitFor(() => expect(result.current).toBe(false))
  })
})

describe('useEnabledFeatures', () => {
  it('returns only features that are both org-enabled and user-granted', async () => {
    await setOrgFeature('billing', true)
    await setOrgFeature('inventory', true)
    await setOrgFeature('pdf-export', false)
    await setUserGrant('billing', true)
    // inventory granted=false; pdf-export not granted

    const { result } = renderHook(() => useEnabledFeatures())
    await waitFor(() => expect(result.current).toEqual(['billing']))
  })

  it('admins see every org-enabled feature regardless of grants', async () => {
    signIn('admin')
    await setOrgFeature('billing', true)
    await setOrgFeature('inventory', true)
    await setOrgFeature('pdf-export', false)

    const { result } = renderHook(() => useEnabledFeatures())
    await waitFor(() =>
      expect([...result.current].sort()).toEqual(['billing', 'inventory']),
    )
  })
})

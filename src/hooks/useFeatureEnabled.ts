import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuthStore } from '@/features/auth/auth.store'
import { FEATURES, type Feature } from '@/lib/features'

/**
 * Two-tier feature gating:
 *   1. The org has the feature enabled in `org_features`.
 *   2. The user is granted the feature in `user_features` (admins bypass).
 *
 * Returns `false` until the relevant Dexie rows are loaded, which keeps
 * gated UI hidden during initial hydration rather than flashing in.
 */
export function useFeatureEnabled(feature: Feature): boolean {
  const orgId = useAuthStore((s) => s.orgId)
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const role = useAuthStore((s) => s.role)

  const orgEnabled = useLiveQuery(
    async () => {
      if (!orgId) return false
      const row = await db.orgFeatures.where('[orgId+feature]').equals([orgId, feature]).first()
      return !!row && row.enabled && !row._deleted
    },
    [orgId, feature],
    false,
  )

  const userGranted = useLiveQuery(
    async () => {
      if (!orgId || !userId) return false
      if (role === 'admin') return true
      const row = await db.userFeatures
        .where('[userId+orgId+feature]')
        .equals([userId, orgId, feature])
        .first()
      return !!row && row.granted && !row._deleted
    },
    [orgId, userId, role, feature],
    false,
  )

  return !!orgEnabled && !!userGranted
}

/**
 * Convenience hook: which features are currently enabled+granted for
 * this user. Used by the sidebar to filter optional nav items.
 */
export function useEnabledFeatures(): readonly Feature[] {
  const orgId = useAuthStore((s) => s.orgId)
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const role = useAuthStore((s) => s.role)

  return (
    useLiveQuery(
      async () => {
        if (!orgId) return []
        const orgRows = await db.orgFeatures.where('orgId').equals(orgId).toArray()
        const enabledForOrg = new Set(
          orgRows.filter((r) => r.enabled && !r._deleted).map((r) => r.feature),
        )
        if (role === 'admin') {
          return FEATURES.filter((f) => enabledForOrg.has(f))
        }
        if (!userId) return []
        const userRows = await db.userFeatures
          .where('[userId+orgId+feature]')
          .between([userId, orgId, ''], [userId, orgId, '￿'])
          .toArray()
        const grantedForUser = new Set(
          userRows.filter((r) => r.granted && !r._deleted).map((r) => r.feature),
        )
        return FEATURES.filter((f) => enabledForOrg.has(f) && grantedForUser.has(f))
      },
      [orgId, userId, role],
      [],
    ) ?? []
  )
}

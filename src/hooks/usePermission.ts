import { useLiveQuery } from 'dexie-react-hooks'
import { useAuthStore } from '@/features/auth/auth.store'
import { db } from '@/lib/db'
import { hasPermission, type OrgRolePerms, type Permission } from '@/lib/permissions'

/**
 * Returns whether the signed-in user's role grants `permission`.
 *
 * Resolves against the live `org_roles` table (admins can edit role
 * permissions at runtime). When that table hasn't hydrated yet — for
 * example, immediately after first signup — `hasPermission` falls back
 * to built-in defaults from `src/lib/permissions.ts`. Admin is always
 * true, regardless of stored permissions.
 */
export function usePermission(permission: Permission): boolean {
  const role = useAuthStore((s) => s.role)
  const orgId = useAuthStore((s) => s.orgId)

  const orgRoles = useLiveQuery<OrgRolePerms[] | undefined>(
    async () => {
      if (!orgId) return undefined
      const rows = await db.orgRoles
        .where('orgId')
        .equals(orgId)
        .filter((r) => !r._deleted)
        .toArray()
      return rows.map((r) => ({ roleKey: r.roleKey, permissions: r.permissions }))
    },
    [orgId],
  )

  return hasPermission(role, permission, orgRoles)
}

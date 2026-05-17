import { dbDelete, dbPut } from '@/lib/db/write'
import { supabase } from '@/lib/supabase/client'
import {
  BUILTIN_ROLE_DEFAULTS,
  isBuiltinRoleKey,
  PERMISSIONS,
  type Permission,
} from '@/lib/permissions'
import type { OrgRole } from '@/lib/db/schema'

/**
 * Slugify a label into a stable, immutable role_key. Lowercase, replace
 * non-alphanumerics with `_`, collapse runs, trim. Empty result → ''.
 */
export function slugifyRoleKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Permission groups for the role editor — purely a UI grouping. The
 * group's t-key is `permissionGroups.<groupKey>`; each permission's
 * t-key is `permissionLabels.<permission>`.
 */
export const PERMISSION_GROUPS: Array<{
  groupKey: string
  permissions: Permission[]
}> = [
  {
    groupKey: 'patients',
    permissions: ['read:patients', 'write:patients', 'write:allergy', 'write:diagnosis', 'write:related_person'],
  },
  {
    groupKey: 'appointments',
    permissions: ['read:appointments', 'write:appointments', 'delete:appointment'],
  },
  {
    groupKey: 'visits',
    permissions: ['read:visit', 'write:visit', 'write:note'],
  },
  {
    groupKey: 'labs',
    permissions: ['read:labs', 'write:labs', 'complete:lab', 'cancel:lab'],
  },
  {
    groupKey: 'medications',
    permissions: ['read:medications', 'write:medications', 'complete:medication', 'cancel:medication'],
  },
  {
    groupKey: 'imaging',
    permissions: ['read:imaging', 'write:imaging'],
  },
  {
    groupKey: 'care',
    permissions: ['read:care_plan', 'write:care_plan', 'read:care_goal', 'write:care_goal'],
  },
  {
    groupKey: 'incidents',
    permissions: ['read:incidents', 'write:incident', 'resolve:incident', 'read:incident_widgets'],
  },
  {
    groupKey: 'billing',
    permissions: ['read:billing', 'write:billing', 'record:payment', 'void:invoice', 'manage:charge_items'],
  },
  {
    groupKey: 'inventory',
    permissions: ['read:inventory', 'write:inventory', 'receive:stock', 'adjust:stock'],
  },
  {
    groupKey: 'settings',
    permissions: ['read:settings', 'write:settings', 'manage:roles'],
  },
  {
    groupKey: 'audit',
    permissions: ['read:audit_log', 'export:audit_log'],
  },
]

// Verify every permission is grouped exactly once (catches additions to
// PERMISSIONS that forget to update PERMISSION_GROUPS).
const _grouped = new Set(PERMISSION_GROUPS.flatMap((g) => g.permissions))
const _missing = PERMISSIONS.filter((p) => !_grouped.has(p))
if (_missing.length > 0 && import.meta.env.DEV) {
  console.warn(
    `[roles.ts] Permissions missing from PERMISSION_GROUPS: ${_missing.join(', ')}`,
  )
}

export interface RoleDraft {
  label: string
  roleKey: string
  permissions: Permission[]
}

export interface SaveRoleArgs {
  orgId: string
  draft: RoleDraft
  existing?: OrgRole
}

/**
 * Create or update an `org_roles` row through the standard dbPut path.
 * For new rows, the synthetic id matches the (org, role_key) tuple.
 */
export async function saveRole({ orgId, draft, existing }: SaveRoleArgs): Promise<void> {
  if (existing) {
    await dbPut(
      'orgRoles',
      {
        ...existing,
        label: draft.label.trim(),
        permissions: draft.permissions,
      },
      'update',
    )
    return
  }

  await dbPut(
    'orgRoles',
    {
      id: crypto.randomUUID(),
      orgId,
      roleKey: draft.roleKey,
      label: draft.label.trim(),
      permissions: draft.permissions,
      isBuiltin: false,
      isLocked: false,
      deletedAt: null,
      createdAt: '',
      updatedAt: '',
      _synced: false,
      _deleted: false,
    },
    'insert',
  )
}

/**
 * Count assignments of a role across `profiles` and `org_members`
 * (pending invites) in Supabase. Used to decide whether a delete needs
 * a reassignment step. Profiles and org_members aren't synced to Dexie
 * locally, so we query Supabase directly. Best-effort — falls back to
 * `total: 0` if either query errors (we'd rather offer the simple
 * delete path than block the user on a network hiccup).
 */
export async function countRoleAssignments(
  orgId: string,
  roleKey: string,
): Promise<{ profiles: number; members: number; total: number }> {
  const profilesQuery = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('role', roleKey)
  const membersQuery = await supabase
    .from('org_members')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('role', roleKey)
    .is('accepted_at', null)

  const profiles = profilesQuery.count ?? 0
  const members = membersQuery.count ?? 0
  return { profiles, members, total: profiles + members }
}

/**
 * Soft-delete an org_roles row. Caller is responsible for handling
 * holders (via reassignment) before calling this — the guard trigger
 * server-side will reject deletes of locked rows.
 */
export async function deleteRole(roleId: string): Promise<void> {
  await dbDelete('orgRoles', roleId)
}

/**
 * Reset a built-in role's permissions to the defaults from
 * BUILTIN_ROLE_DEFAULTS. No-op for custom roles.
 */
export function defaultPermissionsForKey(roleKey: string): Permission[] {
  if (isBuiltinRoleKey(roleKey)) {
    return [...BUILTIN_ROLE_DEFAULTS[roleKey].permissions]
  }
  return []
}

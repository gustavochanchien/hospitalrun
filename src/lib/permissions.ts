export const PERMISSIONS = [
  'read:patients',
  'write:patients',
  'read:appointments',
  'write:appointments',
  'delete:appointment',
  'write:allergy',
  'write:diagnosis',
  'read:labs',
  'write:labs',
  'complete:lab',
  'cancel:lab',
  'read:medications',
  'write:medications',
  'complete:medication',
  'cancel:medication',
  'read:imaging',
  'write:imaging',
  'read:incidents',
  'write:incident',
  'resolve:incident',
  'read:incident_widgets',
  'write:care_plan',
  'read:care_plan',
  'write:care_goal',
  'read:care_goal',
  'write:visit',
  'read:visit',
  'write:note',
  'write:related_person',
  'read:settings',
  'write:settings',
  'read:billing',
  'write:billing',
  'void:invoice',
  'record:payment',
  'manage:charge_items',
  'read:inventory',
  'write:inventory',
  'adjust:stock',
  'receive:stock',
  'read:audit_log',
  'export:audit_log',
  'manage:roles',
] as const

export type Permission = (typeof PERMISSIONS)[number]

/**
 * Shape of a row from the `org_roles` Dexie table that this module needs.
 * Imported by callers as `OrgRolePerms` so they can pass a minimal slice.
 */
export interface OrgRolePerms {
  roleKey: string
  permissions: string[]
}

export const BUILTIN_ROLE_KEYS = [
  'admin',
  'doctor',
  'nurse',
  'user',
  'check_in_desk',
  'pharmacist',
] as const

export type BuiltinRoleKey = (typeof BUILTIN_ROLE_KEYS)[number]

const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS]

const CLINICAL_PERMISSIONS: Permission[] = [
  'read:patients',
  'write:patients',
  'read:appointments',
  'write:appointments',
  'delete:appointment',
  'write:allergy',
  'write:diagnosis',
  'read:labs',
  'write:labs',
  'complete:lab',
  'cancel:lab',
  'read:medications',
  'write:medications',
  'complete:medication',
  'cancel:medication',
  'read:imaging',
  'write:imaging',
  'read:incidents',
  'write:incident',
  'resolve:incident',
  'read:incident_widgets',
  'write:care_plan',
  'read:care_plan',
  'write:care_goal',
  'read:care_goal',
  'write:visit',
  'read:visit',
  'write:note',
  'write:related_person',
  'read:billing',
  'write:billing',
  'record:payment',
  'read:inventory',
  'write:inventory',
  'receive:stock',
]

const READ_PERMISSIONS: Permission[] = [
  'read:patients',
  'read:appointments',
  'read:labs',
  'read:medications',
  'read:imaging',
  'read:incidents',
  'read:care_plan',
  'read:care_goal',
  'read:visit',
  'read:billing',
  'read:inventory',
]

const CHECK_IN_DESK_PERMISSIONS: Permission[] = [
  'read:patients',
  'write:patients',
  'read:appointments',
  'write:appointments',
  'delete:appointment',
  'write:related_person',
  'read:visit',
  'read:billing',
]

const PHARMACIST_PERMISSIONS: Permission[] = [
  'read:patients',
  'read:medications',
  'write:medications',
  'complete:medication',
  'cancel:medication',
  'read:inventory',
  'write:inventory',
  'adjust:stock',
  'receive:stock',
  'read:visit',
]

/**
 * Defaults for the six built-in roles. The SQL seed in
 * supabase/migrations/00001_initial_schema.sql (`bootstrap_current_user`)
 * must mirror these arrays. This map is also the fallback used by
 * `hasPermission` when the live `org_roles` table hasn't hydrated yet
 * (e.g. immediately after first signup), and the source for the
 * "Reset to defaults" button in the role editor.
 *
 * Admin's array is informational only — `hasPermission` short-circuits
 * to true for role === 'admin' regardless of what's stored.
 */
export const BUILTIN_ROLE_DEFAULTS: Record<
  BuiltinRoleKey,
  { label: string; permissions: Permission[] }
> = {
  admin: { label: 'Admin', permissions: ALL_PERMISSIONS },
  doctor: { label: 'Doctor', permissions: CLINICAL_PERMISSIONS },
  nurse: { label: 'Nurse', permissions: CLINICAL_PERMISSIONS },
  user: { label: 'Viewer', permissions: READ_PERMISSIONS },
  check_in_desk: { label: 'Check-In Desk', permissions: CHECK_IN_DESK_PERMISSIONS },
  pharmacist: { label: 'Pharmacist', permissions: PHARMACIST_PERMISSIONS },
}

export function isBuiltinRoleKey(key: string): key is BuiltinRoleKey {
  return (BUILTIN_ROLE_KEYS as readonly string[]).includes(key)
}

/**
 * Check whether `role` grants `permission`.
 *
 * Resolution order:
 * 1. `role == null` → false.
 * 2. `role === 'admin'` → always true. RLS depends on the admin role
 *    existing and admins should not silently lose access when a new
 *    permission is added to PERMISSIONS.
 * 3. Look up the role in `orgRoles` (the org's editable role table).
 * 4. If not found AND it's a built-in key, fall back to defaults — this
 *    handles the window between first signup and Dexie hydration.
 * 5. Otherwise → false.
 */
export function hasPermission(
  role: string | null,
  permission: Permission,
  orgRoles?: readonly OrgRolePerms[],
): boolean {
  if (!role) return false
  if (role === 'admin') return true

  const stored = orgRoles?.find((r) => r.roleKey === role)
  if (stored) return stored.permissions.includes(permission)

  if (isBuiltinRoleKey(role)) {
    return BUILTIN_ROLE_DEFAULTS[role].permissions.includes(permission)
  }

  return false
}

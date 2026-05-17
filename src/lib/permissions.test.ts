import { describe, it, expect } from 'vitest'
import {
  hasPermission,
  PERMISSIONS,
  BUILTIN_ROLE_DEFAULTS,
  isBuiltinRoleKey,
  type OrgRolePerms,
} from './permissions'

describe('hasPermission', () => {
  it('returns false for null role', () => {
    expect(hasPermission(null, 'read:patients')).toBe(false)
  })

  it('returns false for unknown role with no orgRoles', () => {
    expect(hasPermission('receptionist', 'read:patients')).toBe(false)
  })

  it('admin has all permissions regardless of stored array', () => {
    // Even if admin's stored permissions are empty, admin is always true.
    const orgRoles: OrgRolePerms[] = [{ roleKey: 'admin', permissions: [] }]
    expect(hasPermission('admin', 'read:patients', orgRoles)).toBe(true)
    expect(hasPermission('admin', 'manage:roles', orgRoles)).toBe(true)
    expect(hasPermission('admin', 'write:settings')).toBe(true)
  })

  it('falls back to BUILTIN_ROLE_DEFAULTS when orgRoles is empty', () => {
    expect(hasPermission('user', 'read:patients')).toBe(true)
    expect(hasPermission('user', 'write:patients')).toBe(false)
    expect(hasPermission('doctor', 'complete:lab')).toBe(true)
    expect(hasPermission('doctor', 'write:settings')).toBe(false)
    expect(hasPermission('nurse', 'write:note')).toBe(true)
  })

  it('uses stored permissions when role is found in orgRoles', () => {
    const orgRoles: OrgRolePerms[] = [
      { roleKey: 'doctor', permissions: ['read:patients'] },
    ]
    // Custom override: doctor was trimmed to read-only.
    expect(hasPermission('doctor', 'read:patients', orgRoles)).toBe(true)
    expect(hasPermission('doctor', 'write:patients', orgRoles)).toBe(false)
  })

  it('handles custom (non-builtin) roles via orgRoles', () => {
    const orgRoles: OrgRolePerms[] = [
      { roleKey: 'triage_nurse', permissions: ['read:patients', 'write:patients'] },
    ]
    expect(hasPermission('triage_nurse', 'read:patients', orgRoles)).toBe(true)
    expect(hasPermission('triage_nurse', 'write:patients', orgRoles)).toBe(true)
    expect(hasPermission('triage_nurse', 'complete:lab', orgRoles)).toBe(false)
  })

  it('returns false for custom role not in orgRoles', () => {
    expect(hasPermission('triage_nurse', 'read:patients', [])).toBe(false)
    expect(hasPermission('triage_nurse', 'read:patients')).toBe(false)
  })

  it('check_in_desk default has appointment + patient write but not labs', () => {
    expect(hasPermission('check_in_desk', 'write:patients')).toBe(true)
    expect(hasPermission('check_in_desk', 'write:appointments')).toBe(true)
    expect(hasPermission('check_in_desk', 'delete:appointment')).toBe(true)
    expect(hasPermission('check_in_desk', 'write:related_person')).toBe(true)
    expect(hasPermission('check_in_desk', 'read:labs')).toBe(false)
    expect(hasPermission('check_in_desk', 'write:medications')).toBe(false)
  })

  it('pharmacist default has medications + inventory but not patient write', () => {
    expect(hasPermission('pharmacist', 'read:patients')).toBe(true)
    expect(hasPermission('pharmacist', 'write:medications')).toBe(true)
    expect(hasPermission('pharmacist', 'complete:medication')).toBe(true)
    expect(hasPermission('pharmacist', 'adjust:stock')).toBe(true)
    expect(hasPermission('pharmacist', 'write:patients')).toBe(false)
    expect(hasPermission('pharmacist', 'write:labs')).toBe(false)
  })

  it('manage:roles is gated to admin only by default', () => {
    expect(hasPermission('admin', 'manage:roles')).toBe(true)
    expect(hasPermission('doctor', 'manage:roles')).toBe(false)
    expect(hasPermission('user', 'manage:roles')).toBe(false)
  })
})

describe('BUILTIN_ROLE_DEFAULTS integrity', () => {
  it('every default permission is in the PERMISSIONS tuple', () => {
    const valid = new Set<string>(PERMISSIONS)
    for (const [key, def] of Object.entries(BUILTIN_ROLE_DEFAULTS)) {
      for (const perm of def.permissions) {
        expect(valid.has(perm), `${key} has unknown permission "${perm}"`).toBe(true)
      }
    }
  })

  it('isBuiltinRoleKey correctly identifies all 6 keys', () => {
    expect(isBuiltinRoleKey('admin')).toBe(true)
    expect(isBuiltinRoleKey('doctor')).toBe(true)
    expect(isBuiltinRoleKey('check_in_desk')).toBe(true)
    expect(isBuiltinRoleKey('pharmacist')).toBe(true)
    expect(isBuiltinRoleKey('triage_nurse')).toBe(false)
  })
})

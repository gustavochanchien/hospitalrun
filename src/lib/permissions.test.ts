import { describe, it, expect } from 'vitest'
import { hasPermission } from './permissions'

describe('hasPermission', () => {
  it('returns false for null role', () => {
    expect(hasPermission(null, 'read:patients')).toBe(false)
  })

  it('returns false for unknown role', () => {
    expect(hasPermission('receptionist', 'read:patients')).toBe(false)
  })

  it('admin has all permissions', () => {
    expect(hasPermission('admin', 'read:patients')).toBe(true)
    expect(hasPermission('admin', 'write:settings')).toBe(true)
    expect(hasPermission('admin', 'resolve:incident')).toBe(true)
    expect(hasPermission('admin', 'complete:lab')).toBe(true)
  })

  it('user role has only read permissions', () => {
    expect(hasPermission('user', 'read:patients')).toBe(true)
    expect(hasPermission('user', 'read:labs')).toBe(true)
    expect(hasPermission('user', 'write:patients')).toBe(false)
    expect(hasPermission('user', 'write:settings')).toBe(false)
    expect(hasPermission('user', 'complete:lab')).toBe(false)
  })

  it('doctor has clinical permissions but not settings', () => {
    expect(hasPermission('doctor', 'write:patients')).toBe(true)
    expect(hasPermission('doctor', 'complete:lab')).toBe(true)
    expect(hasPermission('doctor', 'resolve:incident')).toBe(true)
    expect(hasPermission('doctor', 'write:settings')).toBe(false)
    expect(hasPermission('doctor', 'read:settings')).toBe(false)
  })

  it('nurse has same clinical permissions as doctor', () => {
    expect(hasPermission('nurse', 'write:patients')).toBe(true)
    expect(hasPermission('nurse', 'write:note')).toBe(true)
    expect(hasPermission('nurse', 'write:settings')).toBe(false)
  })
})

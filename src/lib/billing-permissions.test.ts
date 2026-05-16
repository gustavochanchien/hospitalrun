import { describe, it, expect } from 'vitest'
import { hasPermission, PERMISSIONS } from './permissions'

describe('billing permissions', () => {
  it('PERMISSIONS tuple includes all five billing strings', () => {
    expect(PERMISSIONS).toContain('read:billing')
    expect(PERMISSIONS).toContain('write:billing')
    expect(PERMISSIONS).toContain('void:invoice')
    expect(PERMISSIONS).toContain('record:payment')
    expect(PERMISSIONS).toContain('manage:charge_items')
  })

  describe('admin', () => {
    it('has all billing permissions', () => {
      expect(hasPermission('admin', 'read:billing')).toBe(true)
      expect(hasPermission('admin', 'write:billing')).toBe(true)
      expect(hasPermission('admin', 'void:invoice')).toBe(true)
      expect(hasPermission('admin', 'record:payment')).toBe(true)
      expect(hasPermission('admin', 'manage:charge_items')).toBe(true)
    })
  })

  describe('doctor', () => {
    it('can read billing', () => expect(hasPermission('doctor', 'read:billing')).toBe(true))
    it('can write billing', () => expect(hasPermission('doctor', 'write:billing')).toBe(true))
    it('can record payment', () => expect(hasPermission('doctor', 'record:payment')).toBe(true))
    it('cannot void invoices', () => expect(hasPermission('doctor', 'void:invoice')).toBe(false))
    it('cannot manage charge items', () => expect(hasPermission('doctor', 'manage:charge_items')).toBe(false))
  })

  describe('nurse', () => {
    it('can read billing', () => expect(hasPermission('nurse', 'read:billing')).toBe(true))
    it('can write billing', () => expect(hasPermission('nurse', 'write:billing')).toBe(true))
    it('can record payment', () => expect(hasPermission('nurse', 'record:payment')).toBe(true))
    it('cannot void invoices', () => expect(hasPermission('nurse', 'void:invoice')).toBe(false))
    it('cannot manage charge items', () => expect(hasPermission('nurse', 'manage:charge_items')).toBe(false))
  })

  describe('user', () => {
    it('can read billing', () => expect(hasPermission('user', 'read:billing')).toBe(true))
    it('cannot write billing', () => expect(hasPermission('user', 'write:billing')).toBe(false))
    it('cannot void invoices', () => expect(hasPermission('user', 'void:invoice')).toBe(false))
    it('cannot record payment', () => expect(hasPermission('user', 'record:payment')).toBe(false))
    it('cannot manage charge items', () => expect(hasPermission('user', 'manage:charge_items')).toBe(false))
  })

  it('null role returns false for any billing permission', () => {
    expect(hasPermission(null, 'read:billing')).toBe(false)
  })
})

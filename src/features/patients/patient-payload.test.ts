import { describe, it, expect } from 'vitest'
import { diffPatientFields, formToPatientFields } from './patient-payload'
import type { Patient } from '@/lib/db/schema'

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: 'p',
    orgId: 'o',
    mrn: null,
    prefix: null,
    givenName: 'A',
    familyName: 'B',
    suffix: null,
    dateOfBirth: null,
    sex: null,
    bloodType: null,
    occupation: null,
    preferredLanguage: null,
    phone: null,
    email: null,
    address: null,
    maritalStatus: null,
    educationLevel: null,
    nationalId: null,
    nationalIdType: null,
    numberOfChildren: null,
    numberOfHouseholdMembers: null,
    isHeadOfHousehold: false,
    isApproximateDateOfBirth: null,
    status: 'active',
    deletedAt: null,
    createdAt: '',
    updatedAt: '',
    _synced: false,
    _deleted: false,
    ...overrides,
  }
}

describe('formToPatientFields', () => {
  it('coerces empty strings to null for nullable text fields', () => {
    const out = formToPatientFields({
      givenName: 'A',
      familyName: 'B',
      prefix: '',
      nationalId: '',
      phone: '',
    })
    expect(out.prefix).toBeNull()
    expect(out.nationalId).toBeNull()
    expect(out.phone).toBeNull()
  })

  it('preserves boolean false for isHeadOfHousehold', () => {
    const out = formToPatientFields({ givenName: 'A', familyName: 'B' })
    expect(out.isHeadOfHousehold).toBe(false)
  })

  it('parses numeric fields from strings', () => {
    const out = formToPatientFields({
      givenName: 'A',
      familyName: 'B',
      numberOfChildren: '3',
      numberOfHouseholdMembers: '6',
    })
    expect(out.numberOfChildren).toBe(3)
    expect(out.numberOfHouseholdMembers).toBe(6)
  })

  it('treats empty numeric strings as null', () => {
    const out = formToPatientFields({
      givenName: 'A',
      familyName: 'B',
      numberOfChildren: '',
      numberOfHouseholdMembers: '',
    })
    expect(out.numberOfChildren).toBeNull()
    expect(out.numberOfHouseholdMembers).toBeNull()
  })
})

describe('diffPatientFields', () => {
  it('returns no changes when nothing changed', () => {
    const prev = makePatient({ phone: '555' })
    const next = makePatient({ phone: '555' })
    expect(diffPatientFields(prev, next)).toEqual([])
  })

  it('detects a phone change', () => {
    const prev = makePatient({ phone: '555' })
    const next = makePatient({ phone: '999' })
    const changes = diffPatientFields(prev, next)
    expect(changes).toEqual([
      { fieldName: 'phone', oldValue: '555', newValue: '999' },
    ])
  })

  it('detects address change via JSON comparison', () => {
    const prev = makePatient({ address: { street: '1 Main', city: 'A', state: 'CA', zip: '1' } })
    const next = makePatient({ address: { street: '2 Main', city: 'A', state: 'CA', zip: '1' } })
    const changes = diffPatientFields(prev, next)
    expect(changes).toHaveLength(1)
    expect(changes[0].fieldName).toBe('address')
    expect(changes[0].oldValue).toContain('1 Main')
    expect(changes[0].newValue).toContain('2 Main')
  })

  it('does not record address change when contents are equivalent', () => {
    const prev = makePatient({ address: { street: 'A', city: 'B', state: 'C', zip: 'D' } })
    const next = makePatient({ address: { street: 'A', city: 'B', state: 'C', zip: 'D' } })
    expect(diffPatientFields(prev, next)).toEqual([])
  })

  it('detects isHeadOfHousehold flip', () => {
    const prev = makePatient({ isHeadOfHousehold: false })
    const next = makePatient({ isHeadOfHousehold: true })
    const changes = diffPatientFields(prev, next)
    expect(changes).toEqual([
      { fieldName: 'isHeadOfHousehold', oldValue: 'false', newValue: 'true' },
    ])
  })
})

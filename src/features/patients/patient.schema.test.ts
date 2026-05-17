import { describe, it, expect } from 'vitest'
import { patientFormSchema } from './patient.schema'

describe('patientFormSchema', () => {
  it('requires givenName', () => {
    const result = patientFormSchema.safeParse({ givenName: '', familyName: 'Doe' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('First name is required')
    }
  })

  it('requires familyName', () => {
    const result = patientFormSchema.safeParse({ givenName: 'John', familyName: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Last name is required')
    }
  })

  it('validates email format', () => {
    const result = patientFormSchema.safeParse({
      givenName: 'John',
      familyName: 'Doe',
      email: 'not-an-email',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid email')
    }
  })

  it('accepts a valid minimal record', () => {
    const result = patientFormSchema.safeParse({ givenName: 'John', familyName: 'Doe' })
    expect(result.success).toBe(true)
  })

  it('accepts a full valid record', () => {
    const result = patientFormSchema.safeParse({
      givenName: 'John',
      familyName: 'Doe',
      prefix: 'Mr.',
      suffix: 'Jr.',
      dateOfBirth: '1990-01-15',
      sex: 'male',
      bloodType: 'O+',
      maritalStatus: 'married',
      educationLevel: 'tertiary',
      nationalId: 'ID-123',
      nationalIdType: 'national_id',
      numberOfChildren: '2',
      numberOfHouseholdMembers: '4',
      isHeadOfHousehold: true,
      phone: '555-1234',
      email: 'john@example.com',
      address: { street: '123 Main St', city: 'Anytown', state: 'CA', zip: '12345' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid sex value', () => {
    const result = patientFormSchema.safeParse({
      givenName: 'John',
      familyName: 'Doe',
      sex: 'alien',
    })
    expect(result.success).toBe(false)
  })

  it('allows empty email (optional)', () => {
    const result = patientFormSchema.safeParse({
      givenName: 'John',
      familyName: 'Doe',
      email: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects out-of-enum marital status', () => {
    const result = patientFormSchema.safeParse({
      givenName: 'John',
      familyName: 'Doe',
      maritalStatus: 'engaged',
    })
    expect(result.success).toBe(false)
  })

  it('rejects out-of-enum education level', () => {
    const result = patientFormSchema.safeParse({
      givenName: 'John',
      familyName: 'Doe',
      educationLevel: 'phd',
    })
    expect(result.success).toBe(false)
  })

  it('accepts numberOfChildren as a numeric string', () => {
    const result = patientFormSchema.safeParse({
      givenName: 'John',
      familyName: 'Doe',
      numberOfChildren: '3',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.numberOfChildren).toBe('3')
  })

  it('accepts empty numberOfChildren', () => {
    const result = patientFormSchema.safeParse({
      givenName: 'John',
      familyName: 'Doe',
      numberOfChildren: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-digit numberOfChildren input', () => {
    const result = patientFormSchema.safeParse({
      givenName: 'John',
      familyName: 'Doe',
      numberOfChildren: '-1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects unreasonably large household size', () => {
    const result = patientFormSchema.safeParse({
      givenName: 'John',
      familyName: 'Doe',
      numberOfHouseholdMembers: '9999',
    })
    expect(result.success).toBe(false)
  })

  it('allows isHeadOfHousehold to be omitted', () => {
    const result = patientFormSchema.safeParse({
      givenName: 'John',
      familyName: 'Doe',
    })
    expect(result.success).toBe(true)
  })
})

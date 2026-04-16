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
})

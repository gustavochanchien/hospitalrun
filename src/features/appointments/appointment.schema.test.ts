import { describe, it, expect } from 'vitest'
import { appointmentFormSchema, APPOINTMENT_TYPES } from './appointment.schema'

describe('appointmentFormSchema', () => {
  const base = {
    patientId: 'patient-123',
    startTime: '2026-04-14T09:00',
    endTime: '2026-04-14T10:00',
  }

  it('requires patientId', () => {
    const result = appointmentFormSchema.safeParse({ ...base, patientId: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Patient is required')
    }
  })

  it('requires startTime', () => {
    const result = appointmentFormSchema.safeParse({ ...base, startTime: '' })
    expect(result.success).toBe(false)
  })

  it('requires endTime', () => {
    const result = appointmentFormSchema.safeParse({ ...base, endTime: '' })
    expect(result.success).toBe(false)
  })

  it('rejects end time before start time', () => {
    const result = appointmentFormSchema.safeParse({
      ...base,
      startTime: '2026-04-14T10:00',
      endTime: '2026-04-14T09:00',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('End time must be after start time')
    }
  })

  it('rejects equal start and end time', () => {
    const result = appointmentFormSchema.safeParse({
      ...base,
      startTime: '2026-04-14T09:00',
      endTime: '2026-04-14T09:00',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a valid appointment', () => {
    const result = appointmentFormSchema.safeParse(base)
    expect(result.success).toBe(true)
  })

  it('accepts a valid appointment with type', () => {
    const result = appointmentFormSchema.safeParse({ ...base, type: 'checkup' })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown type', () => {
    const result = appointmentFormSchema.safeParse({ ...base, type: 'unknown-type' })
    expect(result.success).toBe(false)
  })

  it('APPOINTMENT_TYPES contains expected values', () => {
    expect(APPOINTMENT_TYPES).toContain('checkup')
    expect(APPOINTMENT_TYPES).toContain('emergency')
    expect(APPOINTMENT_TYPES).toContain('follow up')
    expect(APPOINTMENT_TYPES).toContain('routine')
    expect(APPOINTMENT_TYPES).toContain('walk in')
  })
})

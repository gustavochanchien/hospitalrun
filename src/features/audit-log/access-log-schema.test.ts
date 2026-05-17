import { describe, it, expect } from 'vitest'
import { accessLogRowSchema } from './access-log-schema'

const valid = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-1e2f3a4b5c6d',
  org_id: 'a1b2c3d4-e5f6-4a7b-8c9d-1e2f3a4b5c6e',
  user_id: 'a1b2c3d4-e5f6-4a7b-8c9d-1e2f3a4b5c6f',
  user_email: 'doc@example.com',
  user_role: 'doctor',
  action: 'view',
  resource_type: 'patient',
  resource_id: 'a1b2c3d4-e5f6-4a7b-8c9d-1e2f3a4b5c70',
  patient_id: 'a1b2c3d4-e5f6-4a7b-8c9d-1e2f3a4b5c70',
  context: { tab: 'labs' },
  client_id: 'device-1',
  occurred_at: '2026-05-16T10:00:00Z',
  created_at: '2026-05-16T10:00:00Z',
}

describe('accessLogRowSchema', () => {
  it('parses a well-formed row', () => {
    expect(accessLogRowSchema.parse(valid)).toEqual(valid)
  })

  it('rejects an unknown action', () => {
    const bad = { ...valid, action: 'tamper' }
    expect(accessLogRowSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects an unknown resource_type', () => {
    const bad = { ...valid, resource_type: 'spaceship' }
    expect(accessLogRowSchema.safeParse(bad).success).toBe(false)
  })

  it('allows nullable identity columns', () => {
    const row = { ...valid, user_id: null, user_email: null, resource_id: null, patient_id: null, context: null, client_id: null }
    expect(accessLogRowSchema.safeParse(row).success).toBe(true)
  })
})

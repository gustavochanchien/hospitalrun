import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { searchCodes } from './search'
import type { CodeSystem } from '@/lib/db/schema'

const FIXTURES: CodeSystem[] = [
  { id: 'icd10:E11.9', system: 'icd10', code: 'E11.9', display: 'Type 2 diabetes mellitus without complications', searchText: 'e11.9 type 2 diabetes mellitus without complications' },
  { id: 'icd10:I10', system: 'icd10', code: 'I10', display: 'Essential (primary) hypertension', searchText: 'i10 essential (primary) hypertension' },
  { id: 'icd10:J45.9', system: 'icd10', code: 'J45.9', display: 'Asthma, unspecified', searchText: 'j45.9 asthma, unspecified' },
  { id: 'icd10:M54.5', system: 'icd10', code: 'M54.5', display: 'Low back pain', searchText: 'm54.5 low back pain' },
]

beforeEach(async () => {
  await db.codeSystems.clear()
  await db.codeSystems.bulkPut(FIXTURES)
})

describe('searchCodes', () => {
  it('returns matching codes for a query', async () => {
    const results = await searchCodes('icd10', 'diabetes')
    expect(results).toHaveLength(1)
    expect(results[0].code).toBe('E11.9')
  })

  it('matches by code prefix', async () => {
    const results = await searchCodes('icd10', 'E11')
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].code).toBe('E11.9')
  })

  it('returns empty array for empty query', async () => {
    const results = await searchCodes('icd10', '')
    expect(results).toHaveLength(0)
  })

  it('limits results to 20', async () => {
    // Seed 25 identical-ish entries to test the limit
    const extra: CodeSystem[] = Array.from({ length: 25 }, (_, i) => ({
      id: `icd10:Z${String(i).padStart(2, '0')}`,
      system: 'icd10' as const,
      code: `Z${String(i).padStart(2, '0')}`,
      display: `Test condition ${i}`,
      searchText: `z${String(i).padStart(2, '0')} test condition ${i}`,
    }))
    await db.codeSystems.bulkPut(extra)

    const results = await searchCodes('icd10', 'test')
    expect(results.length).toBeLessThanOrEqual(20)
  })

  it('ranks code-prefix matches first', async () => {
    // "J45" should come before "asthma" display match from E11.9 (which has no "J" prefix)
    const results = await searchCodes('icd10', 'j45')
    expect(results[0].code).toBe('J45.9')
  })

  it('returns no results for unrelated query', async () => {
    const results = await searchCodes('icd10', 'xyzxyz')
    expect(results).toHaveLength(0)
  })
})

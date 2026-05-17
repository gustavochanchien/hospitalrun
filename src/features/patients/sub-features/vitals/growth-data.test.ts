import { describe, it, expect } from 'vitest'
import {
  selectAgeRange,
  ageInMonths,
  buildChartPoints,
  type GrowthReferenceFile,
} from './growth-data'

const reference: GrowthReferenceFile = {
  sex: 'boys',
  ageRange: '0-2',
  ageUnit: 'months',
  percentiles: [3, 15, 50, 85, 97],
  metrics: {
    weight: {
      unit: 'kg',
      rows: [
        [0, 2.5, 2.9, 3.3, 3.9, 4.3],
        [12, 7.7, 8.6, 9.6, 10.7, 11.8],
        [24, 9.7, 10.8, 12.2, 13.6, 14.8],
      ],
    },
  },
}

describe('selectAgeRange', () => {
  it.each([
    [0, '0-2'],
    [24, '0-2'],
    [25, '2-5'],
    [60, '2-5'],
    [120, '5-19'],
  ])('age %i months → %s', (age, expected) => {
    expect(selectAgeRange(age)).toBe(expected)
  })
})

describe('ageInMonths', () => {
  it('computes whole-month difference', () => {
    // date-fns counts whole-month boundaries; use mid-month dates to avoid
    // boundary surprises across local timezones.
    expect(ageInMonths('2024-01-15', new Date(2025, 0, 16))).toBe(12)
  })
  it('returns null for malformed DOB', () => {
    expect(ageInMonths('not-a-date', new Date())).toBe(null)
  })
})

describe('buildChartPoints', () => {
  it('returns reference rows with patient series filled where matching', () => {
    const patient = [{ ageMonths: 12, value: 10.1 }]
    const points = buildChartPoints(reference, 'weight', patient)
    expect(points).toHaveLength(3)
    const at12 = points.find((p) => p.ageMonths === 12)
    expect(at12?.patient).toBe(10.1)
    const at24 = points.find((p) => p.ageMonths === 24)
    expect(at24?.patient).toBeNull()
  })

  it('interpolates reference values when patient ages fall between reference rows', () => {
    const patient = [{ ageMonths: 6, value: 6.2 }]
    const points = buildChartPoints(reference, 'weight', patient)
    const at6 = points.find((p) => p.ageMonths === 6)
    expect(at6).toBeDefined()
    // Linear midpoint between row[0] (p50=3.3) and row[12] (p50=9.6) at age 6 is ~6.45
    expect(at6!.p50).toBeGreaterThan(3.3)
    expect(at6!.p50).toBeLessThan(9.6)
    expect(at6!.patient).toBe(6.2)
  })

  it('returns empty when metric is missing from reference', () => {
    expect(buildChartPoints(reference, 'height', [])).toEqual([])
  })
})

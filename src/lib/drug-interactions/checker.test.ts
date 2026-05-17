import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkInteractions, _resetInteractionCache } from './checker'

const MOCK_DATA = {
  version: '1.0',
  updated: '2025-01-01',
  source: 'test',
  interactions: [
    { drugs: ['warfarin', 'aspirin'], severity: 'major', description: 'Bleeding risk' },
    { drugs: ['simvastatin', 'clarithromycin'], severity: 'contraindicated', description: 'Myopathy risk' },
    { drugs: ['metformin', 'alcohol'], severity: 'major', description: 'Lactic acidosis' },
  ],
}

beforeEach(() => {
  _resetInteractionCache()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => MOCK_DATA,
  }))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('checkInteractions', () => {
  it('returns empty array when fewer than 2 medications', async () => {
    expect(await checkInteractions(['Warfarin 5mg'])).toEqual([])
    expect(await checkInteractions([])).toEqual([])
  })

  it('finds a known interaction pair', async () => {
    const results = await checkInteractions(['Warfarin 5mg', 'Aspirin 81mg'])
    expect(results).toHaveLength(1)
    expect(results[0].severity).toBe('major')
    expect(results[0].description).toBe('Bleeding risk')
  })

  it('is symmetric — finds B→A when pair is stored as A,B', async () => {
    const results = await checkInteractions(['Aspirin 81mg', 'Warfarin 5mg'])
    expect(results).toHaveLength(1)
    expect(results[0].severity).toBe('major')
  })

  it('returns no false positive for unrelated drugs', async () => {
    const results = await checkInteractions(['Amoxicillin 500mg', 'Paracetamol 1g'])
    expect(results).toHaveLength(0)
  })

  it('returns correct severity level', async () => {
    const results = await checkInteractions(['Simvastatin 20mg', 'Clarithromycin 500mg'])
    expect(results[0].severity).toBe('contraindicated')
  })

  it('returns empty array for single medication', async () => {
    expect(await checkInteractions(['Metformin 500mg'])).toEqual([])
  })

  it('sorts by severity — contraindicated before major', async () => {
    const results = await checkInteractions([
      'Warfarin 5mg',
      'Aspirin 81mg',
      'Simvastatin 20mg',
      'Clarithromycin 500mg',
    ])
    expect(results[0].severity).toBe('contraindicated')
    expect(results[1].severity).toBe('major')
  })

  it('deduplicates symmetric pairs', async () => {
    const results = await checkInteractions(['Warfarin 5mg', 'Aspirin 81mg', 'Ibuprofen'])
    // warfarin+aspirin is one pair; no ibuprofen entry in mock data
    expect(results).toHaveLength(1)
  })

  it('preserves original medication names in result', async () => {
    const results = await checkInteractions(['Warfarin 5mg', 'Aspirin 81mg'])
    expect(results[0].drug1).toBe('Warfarin 5mg')
    expect(results[0].drug2).toBe('Aspirin 81mg')
  })
})

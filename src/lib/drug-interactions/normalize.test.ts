import { describe, expect, it } from 'vitest'
import { normalizeDrugName } from './normalize'

describe('normalizeDrugName', () => {
  it('lowercases and trims', () => {
    expect(normalizeDrugName('  Aspirin  ')).toBe('aspirin')
  })

  it('strips trailing dosage with mg', () => {
    expect(normalizeDrugName('Aspirin 81mg')).toBe('aspirin')
  })

  it('strips trailing dosage with mcg', () => {
    expect(normalizeDrugName('Levothyroxine 50mcg')).toBe('levothyroxine')
  })

  it('strips trailing dosage with g', () => {
    expect(normalizeDrugName('Metformin 1g')).toBe('metformin')
  })

  it('strips hcl suffix', () => {
    expect(normalizeDrugName('Metformin HCl')).toBe('metformin')
  })

  it('strips hydrochloride suffix', () => {
    expect(normalizeDrugName('Ciprofloxacin hydrochloride')).toBe('ciprofloxacin')
  })

  it('strips sodium suffix', () => {
    expect(normalizeDrugName('Naproxen sodium')).toBe('naproxen')
  })

  it('strips sulfate suffix', () => {
    expect(normalizeDrugName('Morphine sulfate')).toBe('morphine')
  })

  it('handles already-normalized name unchanged', () => {
    expect(normalizeDrugName('warfarin')).toBe('warfarin')
  })

  it('handles mixed dosage and salt', () => {
    expect(normalizeDrugName('Furosemide 40mg')).toBe('furosemide')
  })
})

import { describe, it, expect } from 'vitest'
import type { Lab, Vital } from '@/lib/db/schema'
import {
  buildSeriesFromSelection,
  buildSeriesOptions,
  labSeriesOptionId,
  vitalSeriesOptionId,
} from './trend-data'

function vital(over: Partial<Vital>): Vital {
  return {
    id: over.id ?? 'v-1',
    orgId: 'org',
    patientId: 'p-1',
    visitId: null,
    recordedAt: '2026-01-01T10:00:00.000Z',
    recordedBy: null,
    heightCm: null,
    weightKg: null,
    temperatureC: null,
    heartRate: null,
    respiratoryRate: null,
    systolic: null,
    diastolic: null,
    oxygenSat: null,
    painScale: null,
    headCircumferenceCm: null,
    notes: null,
    deletedAt: null,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    _synced: true,
    _deleted: false,
    ...over,
  }
}

function lab(over: Partial<Lab>): Lab {
  return {
    id: over.id ?? 'l-1',
    orgId: 'org',
    patientId: 'p-1',
    visitId: null,
    code: null,
    type: 'glucose',
    status: 'completed',
    requestedBy: null,
    requestedAt: '2026-01-01T10:00:00.000Z',
    completedAt: '2026-01-01T11:00:00.000Z',
    canceledAt: null,
    result: null,
    numericValue: null,
    unit: null,
    notes: null,
    deletedAt: null,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T11:00:00.000Z',
    _synced: true,
    _deleted: false,
    ...over,
  }
}

const tLabel = (k: string) => k

describe('buildSeriesOptions', () => {
  it('includes only vital fields that have at least one numeric reading', () => {
    const vitals = [
      vital({ id: 'v-1', recordedAt: '2026-01-01T10:00:00.000Z', heartRate: 72 }),
      vital({ id: 'v-2', recordedAt: '2026-01-02T10:00:00.000Z', heartRate: 80, systolic: 120 }),
    ]
    const opts = buildSeriesOptions(vitals, [], tLabel)
    const ids = opts.map((o) => o.id)
    expect(ids).toContain(vitalSeriesOptionId('heartRate'))
    expect(ids).toContain(vitalSeriesOptionId('systolic'))
    expect(ids).not.toContain(vitalSeriesOptionId('weightKg'))
  })

  it('groups labs by code (preferred) and falls back to type', () => {
    const labs = [
      lab({ id: 'l-1', code: 'GLU', type: 'glucose', numericValue: 5.4, unit: 'mmol/L' }),
      lab({ id: 'l-2', code: 'GLU', type: 'glucose', numericValue: 6.1, unit: 'mmol/L' }),
      lab({ id: 'l-3', code: null, type: 'sodium', numericValue: 140, unit: 'mEq/L' }),
      lab({ id: 'l-4', code: 'GLU', type: 'glucose', numericValue: null }),
    ]
    const opts = buildSeriesOptions([], labs, tLabel)
    expect(opts.find((o) => o.id === labSeriesOptionId('GLU'))).toMatchObject({
      unit: 'mmol/L',
      source: 'lab',
    })
    expect(opts.find((o) => o.id === labSeriesOptionId('sodium'))).toMatchObject({
      unit: 'mEq/L',
      source: 'lab',
    })
    expect(opts.filter((o) => o.source === 'lab')).toHaveLength(2)
  })

  it('omits labs without a finite numericValue', () => {
    const labs = [lab({ id: 'l-1', code: 'GLU', numericValue: null })]
    const opts = buildSeriesOptions([], labs, tLabel)
    expect(opts).toEqual([])
  })
})

describe('buildSeriesFromSelection', () => {
  it('produces sorted points for a vital field and a lab code', () => {
    const vitals = [
      vital({ id: 'v-2', recordedAt: '2026-01-03T10:00:00.000Z', heartRate: 80 }),
      vital({ id: 'v-1', recordedAt: '2026-01-01T10:00:00.000Z', heartRate: 72 }),
    ]
    const labs = [
      lab({ id: 'l-2', code: 'GLU', completedAt: '2026-01-04T10:00:00.000Z', numericValue: 6.1, unit: 'mmol/L' }),
      lab({ id: 'l-1', code: 'GLU', completedAt: '2026-01-02T10:00:00.000Z', numericValue: 5.4, unit: 'mmol/L' }),
    ]
    const options = buildSeriesOptions(vitals, labs, tLabel)
    const series = buildSeriesFromSelection(
      [vitalSeriesOptionId('heartRate'), labSeriesOptionId('GLU')],
      vitals,
      labs,
      options,
    )
    expect(series).toHaveLength(2)
    expect(series[0].points.map((p) => p.value)).toEqual([72, 80])
    expect(series[1].points.map((p) => p.value)).toEqual([5.4, 6.1])
    expect(series[0].color).not.toBe(series[1].color)
  })

  it('returns an empty series array when no ids are selected', () => {
    expect(buildSeriesFromSelection([], [], [], [])).toEqual([])
  })

  it('falls back to requestedAt when a lab has no completedAt', () => {
    const labs = [
      lab({
        id: 'l-1',
        code: 'GLU',
        completedAt: null,
        requestedAt: '2026-01-05T08:00:00.000Z',
        numericValue: 5.5,
      }),
    ]
    const options = buildSeriesOptions([], labs, tLabel)
    const series = buildSeriesFromSelection([labSeriesOptionId('GLU')], [], labs, options)
    expect(series[0].points[0].at).toBe('2026-01-05T08:00:00.000Z')
  })
})

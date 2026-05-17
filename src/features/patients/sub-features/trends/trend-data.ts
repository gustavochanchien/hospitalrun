import type { Lab, Vital } from '@/lib/db/schema'
import type { TrendSeries, TrendSeriesPoint } from '@/components/trend-chart'
import { TREND_PALETTE } from '@/components/trend-chart'

export type VitalFieldKey =
  | 'heightCm'
  | 'weightKg'
  | 'temperatureC'
  | 'heartRate'
  | 'respiratoryRate'
  | 'systolic'
  | 'diastolic'
  | 'oxygenSat'
  | 'painScale'
  | 'headCircumferenceCm'

export const VITAL_FIELD_KEYS: VitalFieldKey[] = [
  'heightCm',
  'weightKg',
  'temperatureC',
  'heartRate',
  'respiratoryRate',
  'systolic',
  'diastolic',
  'oxygenSat',
  'painScale',
  'headCircumferenceCm',
]

export const VITAL_FIELD_UNIT: Record<VitalFieldKey, string> = {
  heightCm: 'cm',
  weightKg: 'kg',
  temperatureC: '°C',
  heartRate: 'bpm',
  respiratoryRate: '/min',
  systolic: 'mmHg',
  diastolic: 'mmHg',
  oxygenSat: '%',
  painScale: '',
  headCircumferenceCm: 'cm',
}

export const VITAL_FIELD_LABEL_KEY: Record<VitalFieldKey, string> = {
  heightCm: 'fields.height',
  weightKg: 'fields.weight',
  temperatureC: 'fields.temperature',
  heartRate: 'fields.heartRate',
  respiratoryRate: 'fields.respiratoryRate',
  systolic: 'fields.systolic',
  diastolic: 'fields.diastolic',
  oxygenSat: 'fields.oxygenSat',
  painScale: 'fields.painScale',
  headCircumferenceCm: 'fields.headCircumference',
}

export interface SeriesOption {
  id: string
  label: string
  unit: string | null
  source: 'vital' | 'lab'
}

export function vitalSeriesOptionId(field: VitalFieldKey): string {
  return `vital:${field}`
}

export function labSeriesOptionId(codeOrType: string): string {
  return `lab:${codeOrType}`
}

/** Build the list of pickable series from a patient's data. */
export function buildSeriesOptions(
  vitals: Vital[],
  labs: Lab[],
  vitalLabel: (field: VitalFieldKey) => string,
): SeriesOption[] {
  const options: SeriesOption[] = []
  for (const field of VITAL_FIELD_KEYS) {
    const has = vitals.some((v) => {
      const raw = v[field]
      return typeof raw === 'number' && Number.isFinite(raw)
    })
    if (!has) continue
    options.push({
      id: vitalSeriesOptionId(field),
      label: vitalLabel(field),
      unit: VITAL_FIELD_UNIT[field] || null,
      source: 'vital',
    })
  }
  const byCode = new Map<string, { label: string; unit: string | null }>()
  for (const lab of labs) {
    if (typeof lab.numericValue !== 'number' || !Number.isFinite(lab.numericValue)) continue
    const key = lab.code ?? lab.type
    if (!key) continue
    if (!byCode.has(key)) {
      byCode.set(key, {
        label: lab.code ? `${lab.code} — ${lab.type}` : lab.type,
        unit: lab.unit ?? null,
      })
    }
  }
  for (const [key, meta] of byCode) {
    options.push({
      id: labSeriesOptionId(key),
      label: meta.label,
      unit: meta.unit,
      source: 'lab',
    })
  }
  return options
}

/** Resolve selected option ids into TrendChart-shaped series with palette colors. */
export function buildSeriesFromSelection(
  selectedIds: string[],
  vitals: Vital[],
  labs: Lab[],
  options: SeriesOption[],
): TrendSeries[] {
  const series: TrendSeries[] = []
  const byId = new Map(options.map((o) => [o.id, o]))
  selectedIds.forEach((id, index) => {
    const option = byId.get(id)
    if (!option) return
    const color = TREND_PALETTE[index % TREND_PALETTE.length]
    if (option.source === 'vital') {
      const field = id.slice('vital:'.length) as VitalFieldKey
      const points: TrendSeriesPoint[] = []
      for (const v of vitals) {
        const raw = v[field]
        if (typeof raw === 'number' && Number.isFinite(raw)) {
          points.push({ at: v.recordedAt, value: raw })
        }
      }
      points.sort((a, b) => a.at.localeCompare(b.at))
      series.push({ key: id, name: option.label, unit: option.unit, color, points })
    } else {
      const key = id.slice('lab:'.length)
      const points: TrendSeriesPoint[] = []
      for (const l of labs) {
        if (typeof l.numericValue !== 'number' || !Number.isFinite(l.numericValue)) continue
        const matches = (l.code ?? l.type) === key
        if (!matches) continue
        const at = l.completedAt ?? l.requestedAt
        points.push({ at, value: l.numericValue })
      }
      points.sort((a, b) => a.at.localeCompare(b.at))
      series.push({ key: id, name: option.label, unit: option.unit, color, points })
    }
  })
  return series
}

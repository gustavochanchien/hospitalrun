import { differenceInMonths, parseISO } from 'date-fns'

export type GrowthMetric = 'weight' | 'height' | 'headCircumference'

export interface GrowthReferenceFile {
  _notice?: string
  sex: 'boys' | 'girls'
  ageRange: '0-2' | '2-5' | '5-19'
  ageUnit: 'months'
  percentiles: number[]
  metrics: Partial<Record<GrowthMetric, { unit: string; rows: number[][] }>>
}

export interface GrowthChartPoint {
  ageMonths: number
  p3: number
  p15: number
  p50: number
  p85: number
  p97: number
  patient?: number | null
}

export function selectAgeRange(ageMonths: number): GrowthReferenceFile['ageRange'] {
  if (ageMonths <= 24) return '0-2'
  if (ageMonths <= 60) return '2-5'
  return '5-19'
}

export function ageInMonths(dob: string, at: Date): number | null {
  try {
    const parsed = parseISO(dob)
    if (Number.isNaN(parsed.getTime())) return null
    const months = differenceInMonths(at, parsed)
    return Number.isFinite(months) ? months : null
  } catch {
    return null
  }
}

export function loadGrowthReference(
  sex: 'boys' | 'girls',
  ageMonths: number,
): Promise<GrowthReferenceFile> {
  const range = selectAgeRange(ageMonths)
  return fetch(`${import.meta.env.BASE_URL}growth-charts/who-${range}-${sex}.json`).then(
    (res) => {
      if (!res.ok) throw new Error(`Failed to load growth chart (${res.status})`)
      return res.json() as Promise<GrowthReferenceFile>
    },
  )
}

export interface PatientGrowthPoint {
  ageMonths: number
  value: number
}

export function buildChartPoints(
  reference: GrowthReferenceFile,
  metric: GrowthMetric,
  patient: PatientGrowthPoint[],
): GrowthChartPoint[] {
  const metricData = reference.metrics[metric]
  if (!metricData) return []
  const refByAge = new Map<number, number[]>()
  for (const row of metricData.rows) {
    refByAge.set(row[0], row.slice(1))
  }
  const ages = new Set<number>(metricData.rows.map((r) => r[0]))
  for (const p of patient) ages.add(p.ageMonths)
  const sorted = [...ages].sort((a, b) => a - b)

  const points: GrowthChartPoint[] = []
  for (const age of sorted) {
    const refRow = refByAge.get(age) ?? interpolateRow(metricData.rows, age)
    if (!refRow) continue
    const patientPoint = patient.find((p) => p.ageMonths === age)
    points.push({
      ageMonths: age,
      p3: refRow[0],
      p15: refRow[1],
      p50: refRow[2],
      p85: refRow[3],
      p97: refRow[4],
      patient: patientPoint?.value ?? null,
    })
  }
  return points
}

function interpolateRow(rows: number[][], age: number): number[] | null {
  if (rows.length === 0) return null
  if (age <= rows[0][0]) return rows[0].slice(1)
  if (age >= rows[rows.length - 1][0]) return rows[rows.length - 1].slice(1)
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i][0]
    const b = rows[i + 1][0]
    if (age >= a && age <= b) {
      const t = (age - a) / (b - a)
      return rows[i].slice(1).map((v, idx) => +(v + (rows[i + 1][idx + 1] - v) * t).toFixed(2))
    }
  }
  return null
}

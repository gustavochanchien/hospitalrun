import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'

export interface TrendSeriesPoint {
  /** ISO timestamp */
  at: string
  value: number
}

export interface TrendSeries {
  /** Unique field key used for the chart's dataKey */
  key: string
  name: string
  unit: string | null
  color: string
  points: TrendSeriesPoint[]
}

interface TrendChartProps {
  series: TrendSeries[]
  /** Sparkline mode: compact, no axes/legend, single height-tight line */
  sparkline?: boolean
  /** Pixel height. Defaults: 280 (chart), 60 (sparkline) */
  height?: number
  /** Optional ISO date strings to clip the displayed range */
  rangeStart?: string | null
  rangeEnd?: string | null
}

interface ChartRow {
  ts: number
  [seriesKey: string]: number | null
}

const PALETTE = [
  'hsl(221 83% 53%)',
  'hsl(142 71% 45%)',
  'hsl(346 84% 51%)',
] as const

export const TREND_PALETTE = PALETTE

function buildRows(series: TrendSeries[], start: number | null, end: number | null): ChartRow[] {
  const byTs = new Map<number, ChartRow>()
  for (const s of series) {
    for (const p of s.points) {
      const ts = Date.parse(p.at)
      if (!Number.isFinite(ts)) continue
      if (start !== null && ts < start) continue
      if (end !== null && ts > end) continue
      const existing = byTs.get(ts)
      if (existing) {
        existing[s.key] = p.value
      } else {
        const row: ChartRow = { ts }
        for (const other of series) row[other.key] = null
        row[s.key] = p.value
        byTs.set(ts, row)
      }
    }
  }
  return [...byTs.values()].sort((a, b) => a.ts - b.ts)
}

export function TrendChart({
  series,
  sparkline = false,
  height,
  rangeStart = null,
  rangeEnd = null,
}: TrendChartProps) {
  const data = useMemo(() => {
    const startMs = rangeStart ? Date.parse(rangeStart) : null
    const endMs = rangeEnd ? Date.parse(rangeEnd) : null
    return buildRows(series, startMs, endMs)
  }, [series, rangeStart, rangeEnd])

  const resolvedHeight = height ?? (sparkline ? 60 : 280)

  if (data.length === 0) {
    return null
  }

  return (
    <ResponsiveContainer width="100%" height={resolvedHeight}>
      <LineChart
        data={data}
        margin={
          sparkline
            ? { top: 4, right: 4, bottom: 4, left: 4 }
            : { top: 8, right: 16, bottom: 8, left: 0 }
        }
      >
        {!sparkline && <CartesianGrid strokeDasharray="3 3" />}
        <XAxis
          dataKey="ts"
          type="number"
          domain={['dataMin', 'dataMax']}
          scale="time"
          tickFormatter={(v: number) => format(new Date(v), 'MMM d')}
          fontSize={12}
          hide={sparkline}
        />
        <YAxis fontSize={12} domain={['auto', 'auto']} hide={sparkline} />
        {!sparkline && (
          <Tooltip
            labelFormatter={(label) => {
              const v = typeof label === 'number' ? label : Number(label)
              return Number.isFinite(v) ? format(new Date(v), 'MMM d, yyyy h:mm a') : ''
            }}
            formatter={(value, _name, entry) => {
              const key = (entry as { dataKey?: string } | undefined)?.dataKey
              const s = series.find((x) => x.key === key)
              const v = typeof value === 'number' ? value : Number(value)
              const display = Number.isFinite(v) ? v.toString() : '—'
              return [s?.unit ? `${display} ${s.unit}` : display, s?.name ?? key ?? '']
            }}
          />
        )}
        {!sparkline && series.length > 1 && <Legend />}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={sparkline ? 1.5 : 2}
            dot={sparkline ? false : { r: 3 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

/**
 * Display helper: format an ISO timestamp as a short date+time string in the
 * tooltip when only individual points need labeling outside the chart.
 */
export function formatTrendDate(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy h:mm a')
  } catch {
    return iso
  }
}

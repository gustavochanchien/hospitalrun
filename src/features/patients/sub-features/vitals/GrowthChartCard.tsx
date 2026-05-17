import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { Patient, Vital } from '@/lib/db/schema'
import {
  ageInMonths,
  buildChartPoints,
  loadGrowthReference,
  type GrowthMetric,
  type GrowthReferenceFile,
} from './growth-data'

interface GrowthChartCardProps {
  patient: Patient
  vitals: Vital[]
}

const PEDIATRIC_AGE_LIMIT_MONTHS = 19 * 12

function patientSex(patient: Patient): 'boys' | 'girls' | null {
  if (patient.sex === 'male') return 'boys'
  if (patient.sex === 'female') return 'girls'
  return null
}

const METRIC_FIELD: Record<GrowthMetric, keyof Vital> = {
  weight: 'weightKg',
  height: 'heightCm',
  headCircumference: 'headCircumferenceCm',
}

export function GrowthChartCard({ patient, vitals }: GrowthChartCardProps) {
  const { t } = useTranslation('vitals')
  const sex = patientSex(patient)
  const ageMonthsNow = patient.dateOfBirth ? ageInMonths(patient.dateOfBirth, new Date()) : null
  const eligible =
    sex !== null &&
    ageMonthsNow !== null &&
    ageMonthsNow >= 0 &&
    ageMonthsNow <= PEDIATRIC_AGE_LIMIT_MONTHS

  const [metric, setMetric] = useState<GrowthMetric>('weight')
  const requestKey = eligible && sex && ageMonthsNow !== null ? `${sex}:${ageMonthsNow}` : null
  const [state, setState] = useState<{
    key: string | null
    reference: GrowthReferenceFile | null
    error: boolean
  }>({ key: null, reference: null, error: false })

  const settled = state.key === requestKey
  const loading = requestKey !== null && !settled
  const error = settled && state.error
  const reference = settled ? state.reference : null

  useEffect(() => {
    if (!requestKey || sex === null || ageMonthsNow === null) return
    let cancelled = false
    loadGrowthReference(sex, ageMonthsNow).then(
      (data) => {
        if (!cancelled) setState({ key: requestKey, reference: data, error: false })
      },
      () => {
        if (!cancelled) setState({ key: requestKey, reference: null, error: true })
      },
    )
    return () => {
      cancelled = true
    }
  }, [requestKey, sex, ageMonthsNow])

  if (!eligible) {
    return (
      <Card data-testid="growth-chart-na">
        <CardHeader>
          <CardTitle>{t('growth.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('growth.notApplicable')}</p>
        </CardContent>
      </Card>
    )
  }

  const dob = patient.dateOfBirth
  const patientPoints = dob
    ? vitals
        .map((v) => {
          const m = ageInMonths(dob, new Date(v.recordedAt))
          const raw = v[METRIC_FIELD[metric]]
          if (m === null || raw === null || raw === undefined) return null
          return { ageMonths: m, value: Number(raw) }
        })
        .filter((p): p is { ageMonths: number; value: number } => p !== null)
        .sort((a, b) => a.ageMonths - b.ageMonths)
    : []

  const metricAvailable =
    reference !== null && reference.metrics[metric] !== undefined
  const data = reference && metricAvailable ? buildChartPoints(reference, metric, patientPoints) : []

  return (
    <Card data-testid="growth-chart-card">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle>{t('growth.title')}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{t('growth.description')}</p>
        </div>
        <Select value={metric} onValueChange={(v) => setMetric(v as GrowthMetric)}>
          <SelectTrigger className="w-[180px]" aria-label={t('growth.title')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weight">{t('growth.metric.weight')}</SelectItem>
            <SelectItem value="height">{t('growth.metric.height')}</SelectItem>
            <SelectItem value="headCircumference">
              {t('growth.metric.headCircumference')}
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading && <Skeleton className="h-64 w-full" />}
        {error && (
          <p className="text-sm text-destructive">{t('growth.loading')}</p>
        )}
        {!loading && !error && reference && !metricAvailable && (
          <p className="text-sm text-muted-foreground">{t('growth.notApplicable')}</p>
        )}
        {!loading && !error && reference && metricAvailable && patientPoints.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('growth.noMeasurements')}</p>
        )}
        {!loading && !error && reference && metricAvailable && data.length > 0 && (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="ageMonths"
                fontSize={12}
                label={{ value: t('growth.ageMonths'), position: 'insideBottom', offset: -2 }}
              />
              <YAxis fontSize={12} domain={['auto', 'auto']} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="p3" name={t('growth.percentile', { value: 3 })} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 2" dot={false} />
              <Line type="monotone" dataKey="p15" name={t('growth.percentile', { value: 15 })} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 2" dot={false} />
              <Line type="monotone" dataKey="p50" name={t('growth.percentile', { value: 50 })} stroke="hsl(var(--muted-foreground))" dot={false} />
              <Line type="monotone" dataKey="p85" name={t('growth.percentile', { value: 85 })} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 2" dot={false} />
              <Line type="monotone" dataKey="p97" name={t('growth.percentile', { value: 97 })} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 2" dot={false} />
              <Line
                type="monotone"
                dataKey="patient"
                name={t('growth.patientSeries')}
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 4 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TrendChart } from '@/components/trend-chart'
import {
  buildSeriesFromSelection,
  buildSeriesOptions,
  type VitalFieldKey,
} from './trends/trend-data'

interface PatientTrendsProps {
  patientId: string
}

const MAX_SERIES = 3

export function PatientTrends({ patientId }: PatientTrendsProps) {
  const { t } = useTranslation('trends')
  const { t: tVitals } = useTranslation('vitals')
  const [selected, setSelected] = useState<string[]>([])
  const [rangeStart, setRangeStart] = useState<string>('')
  const [rangeEnd, setRangeEnd] = useState<string>('')

  const vitals = useLiveQuery(
    () =>
      db.vitals
        .where({ patientId })
        .filter((v) => !v._deleted)
        .toArray()
        .then((rows) => rows.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))),
    [patientId],
  )
  const labs = useLiveQuery(
    () =>
      db.labs
        .where({ patientId })
        .filter((l) => !l._deleted)
        .toArray(),
    [patientId],
  )

  const options = useMemo(() => {
    if (!vitals || !labs) return []
    return buildSeriesOptions(vitals, labs, (field) =>
      tVitals(getVitalLabelKey(field)),
    )
  }, [vitals, labs, tVitals])

  const series = useMemo(() => {
    if (!vitals || !labs) return []
    return buildSeriesFromSelection(selected, vitals, labs, options)
  }, [selected, vitals, labs, options])

  if (vitals === undefined || labs === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">{t('loading')}</p>
  }

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= MAX_SERIES) return prev
      return [...prev, id]
    })
  }

  const limitReached = selected.length >= MAX_SERIES

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{t('title')}</h3>
      </div>

      {options.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('noNumericData')}</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('picker.title')}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('picker.description', { max: MAX_SERIES })}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {options.map((opt) => {
                  const checked = selected.includes(opt.id)
                  const disabled = !checked && limitReached
                  return (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-2 rounded-md border p-2 text-sm ${
                        disabled ? 'opacity-50' : 'cursor-pointer hover:bg-accent'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() => toggle(opt.id)}
                        aria-label={opt.label}
                      />
                      <span className="flex-1">{opt.label}</span>
                      {opt.unit && (
                        <span className="text-xs text-muted-foreground">{opt.unit}</span>
                      )}
                    </label>
                  )
                })}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="trends-from">{t('range.from')}</Label>
                  <Input
                    id="trends-from"
                    type="date"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="trends-to">{t('range.to')}</Label>
                  <Input
                    id="trends-to"
                    type="date"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('chart.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {series.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t('pickPrompt')}
                </p>
              ) : series.every((s) => s.points.length === 0) ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t('emptyAfterFilter')}
                </p>
              ) : (
                <div data-testid="trend-chart">
                  <TrendChart
                    series={series}
                    rangeStart={rangeStart ? `${rangeStart}T00:00:00.000Z` : null}
                    rangeEnd={rangeEnd ? `${rangeEnd}T23:59:59.999Z` : null}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function getVitalLabelKey(field: VitalFieldKey): string {
  const map: Record<VitalFieldKey, string> = {
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
  return map[field]
}

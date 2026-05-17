import { useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendChart, TREND_PALETTE } from '@/components/trend-chart'
import type { TrendSeries } from '@/components/trend-chart'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PermissionGuard } from '@/components/ui/permission-guard'
import { PdfExportButton } from '@/components/pdf-export-button'
import { PrintButton } from '@/components/print-button'
import { resolveOrgName } from '@/lib/pdf/org'
import { recordAccessEvent } from '@/lib/db/access-log'
import { db } from '@/lib/db'
import { dbPut, dbDelete } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { useLogAccess } from '@/hooks/useLogAccess'

interface LabDetailPageProps {
  labId: string
}

export function LabDetailPage({ labId }: LabDetailPageProps) {
  const { t } = useTranslation('labs')
  const navigate = useNavigate()
  const orgId = useAuthStore((s) => s.orgId)
  const [resultText, setResultText] = useState('')
  const [numericText, setNumericText] = useState('')
  const [unitText, setUnitText] = useState('')
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const lab = useLiveQuery(() => db.labs.get(labId), [labId])
  const patient = useLiveQuery(
    () => (lab?.patientId ? db.patients.get(lab.patientId) : undefined),
    [lab?.patientId],
  )

  const sparklineSeriesCode = lab?.code ?? null
  const sparklinePatientId = lab?.patientId ?? null
  const sparklineLabs = useLiveQuery(async () => {
    if (!sparklinePatientId || !sparklineSeriesCode) return []
    return db.labs
      .where({ patientId: sparklinePatientId })
      .filter(
        (l) =>
          !l._deleted &&
          l.code === sparklineSeriesCode &&
          typeof l.numericValue === 'number' &&
          Number.isFinite(l.numericValue),
      )
      .toArray()
  }, [sparklinePatientId, sparklineSeriesCode])

  const sparklineSeries = useMemo<TrendSeries[]>(() => {
    if (!lab || !sparklineLabs || sparklineLabs.length < 2) return []
    const points = sparklineLabs
      .map((l) => ({
        at: l.completedAt ?? l.requestedAt,
        value: l.numericValue as number,
      }))
      .sort((a, b) => a.at.localeCompare(b.at))
    return [
      {
        key: 'lab',
        name: lab.code ?? lab.type,
        unit: lab.unit ?? null,
        color: TREND_PALETTE[0],
        points,
      },
    ]
  }, [lab, sparklineLabs])
  useLogAccess({
    action: 'view',
    resourceType: 'lab',
    resourceId: labId,
    patientId: lab?.patientId,
    enabled: !!lab && !lab._deleted,
  })

  if (lab === undefined) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  if (!lab || lab._deleted) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <p className="text-muted-foreground">{t('notFound')}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/labs">{t('backToLabs')}</Link>
        </Button>
      </div>
    )
  }

  const patientName = patient
    ? `${patient.givenName} ${patient.familyName}`
    : 'Unknown Patient'

  const statusVariant =
    lab.status === 'requested'
      ? 'default'
      : lab.status === 'completed'
        ? 'secondary'
        : 'destructive'

  function parseNumericInput(raw: string): number | null {
    if (raw.trim() === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }

  async function handleComplete() {
    if (!resultText.trim()) {
      toast.error(t('detail.resultRequired'))
      return
    }
    setIsSaving(true)
    try {
      await dbPut(
        'labs',
        {
          ...lab!,
          status: 'completed' as const,
          completedAt: new Date().toISOString(),
          result: resultText.trim(),
          numericValue: parseNumericInput(numericText),
          unit: unitText.trim() || null,
        },
        'update',
      )
      toast.success(t('detail.labCompleted'))
      setCompleteDialogOpen(false)
      setResultText('')
      setNumericText('')
      setUnitText('')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCancel() {
    setIsSaving(true)
    try {
      await dbPut(
        'labs',
        {
          ...lab!,
          status: 'canceled' as const,
          canceledAt: new Date().toISOString(),
        },
        'update',
      )
      toast.success(t('detail.labCanceled'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveResult() {
    if (!resultText.trim()) {
      toast.error(t('detail.resultRequiredShort'))
      return
    }
    setIsSaving(true)
    try {
      await dbPut(
        'labs',
        {
          ...lab!,
          status: 'completed' as const,
          completedAt: new Date().toISOString(),
          result: resultText.trim(),
          numericValue: parseNumericInput(numericText),
          unit: unitText.trim() || null,
        },
        'update',
      )
      toast.success(t('detail.resultSaved'))
      setResultText('')
      setNumericText('')
      setUnitText('')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    await dbDelete('labs', labId)
    toast.success(t('detail.labDeleted'))
    await navigate({ to: '/labs' })
  }

  return (
    <div className="space-y-6 p-6">
      {/* Lab Info Card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <CardTitle className="text-xl">{t('detail.cardTitle')}</CardTitle>
          <Badge variant={statusVariant}>{lab.status}</Badge>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium text-muted-foreground">{t('fields.patient')}</p>
              <Link
                to="/patients/$patientId"
                params={{ patientId: lab.patientId }}
                className="text-primary hover:underline"
              >
                {patientName}
              </Link>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">{t('fields.type')}</p>
              <p>{lab.type}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">{t('fields.code')}</p>
              <p>{lab.code ?? '—'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">{t('fields.requestedBy')}</p>
              <p>{lab.requestedBy ?? '—'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">{t('fields.requestedAt')}</p>
              <p>{format(parseISO(lab.requestedAt), 'MMM d, yyyy h:mm a')}</p>
            </div>
            {lab.completedAt && (
              <div>
                <p className="font-medium text-muted-foreground">{t('fields.completedAt')}</p>
                <p>{format(parseISO(lab.completedAt), 'MMM d, yyyy h:mm a')}</p>
              </div>
            )}
            {lab.canceledAt && (
              <div>
                <p className="font-medium text-muted-foreground">{t('fields.canceledAt')}</p>
                <p>{format(parseISO(lab.canceledAt), 'MMM d, yyyy h:mm a')}</p>
              </div>
            )}
            {lab.notes && (
              <div className="sm:col-span-2">
                <p className="font-medium text-muted-foreground">{t('fields.notes')}</p>
                <p className="whitespace-pre-wrap">{lab.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Result Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t('detail.resultCardTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {lab.status === 'completed' && lab.result ? (
            <div className="space-y-2">
              {typeof lab.numericValue === 'number' && (
                <p className="text-lg font-semibold">
                  {lab.numericValue}
                  {lab.unit ? ` ${lab.unit}` : ''}
                </p>
              )}
              <p className="whitespace-pre-wrap">{lab.result}</p>
            </div>
          ) : lab.status === 'requested' ? (
            <div className="space-y-3">
              <Label htmlFor="result-input">{t('detail.enterResult')}</Label>
              <Textarea
                id="result-input"
                placeholder={t('detail.resultPlaceholder')}
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="result-numeric">{t('detail.numericValue')}</Label>
                  <Input
                    id="result-numeric"
                    type="number"
                    inputMode="decimal"
                    placeholder={t('detail.numericValuePlaceholder')}
                    value={numericText}
                    onChange={(e) => setNumericText(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="result-unit">{t('detail.unit')}</Label>
                  <Input
                    id="result-unit"
                    placeholder={t('detail.unitPlaceholder')}
                    value={unitText}
                    onChange={(e) => setUnitText(e.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={handleSaveResult}
                disabled={isSaving || !resultText.trim()}
              >
                {isSaving ? t('form.saving') : t('detail.saveResult')}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground">{t('detail.noResultAvailable')}</p>
          )}
        </CardContent>
      </Card>

      {sparklineSeries.length > 0 && (
        <Card data-testid="lab-history-sparkline">
          <CardHeader>
            <CardTitle>{t('detail.historyTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart series={sparklineSeries} />
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3" data-print-actions>
        {lab.status === 'requested' && (
          <>
            <PermissionGuard permission="complete:lab">
              <Button onClick={() => setCompleteDialogOpen(true)}>
                {t('detail.complete')}
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="cancel:lab">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                {t('detail.cancelLab')}
              </Button>
            </PermissionGuard>
          </>
        )}
        <PdfExportButton
          filename={`lab-${lab.code ?? lab.id}`}
          onBeforeGenerate={() =>
            void recordAccessEvent({
              action: 'export',
              resourceType: 'lab',
              resourceId: lab.id,
              patientId: lab.patientId,
              context: { format: 'pdf' },
            })
          }
          buildDocument={async () => {
            const orgName = await resolveOrgName(orgId)
            const { LabReportPdf } = await import('./pdf/LabReportPdf')
            return (
              <LabReportPdf
                orgName={orgName}
                lab={lab}
                patient={patient ?? null}
                generatedAt={new Date()}
                locale={i18n.language}
              />
            )
          }}
        />
        <PrintButton
          onBeforePrint={() =>
            void recordAccessEvent({
              action: 'print',
              resourceType: 'lab',
              resourceId: lab.id,
              patientId: lab.patientId,
            })
          }
        />
        <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
          {t('detail.delete')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this record?"
        description="This action cannot be undone. The record will be permanently removed."
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
      />

      {/* Complete Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('detail.completeDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="complete-result">{t('detail.resultLabel')}</Label>
            <Textarea
              id="complete-result"
              placeholder={t('detail.resultPlaceholder')}
              value={resultText}
              onChange={(e) => setResultText(e.target.value)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="complete-numeric">{t('detail.numericValue')}</Label>
                <Input
                  id="complete-numeric"
                  type="number"
                  inputMode="decimal"
                  placeholder={t('detail.numericValuePlaceholder')}
                  value={numericText}
                  onChange={(e) => setNumericText(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="complete-unit">{t('detail.unit')}</Label>
                <Input
                  id="complete-unit"
                  placeholder={t('detail.unitPlaceholder')}
                  value={unitText}
                  onChange={(e) => setUnitText(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCompleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              disabled={isSaving || !resultText.trim()}
            >
              {isSaving ? t('form.saving') : t('detail.saveAndComplete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

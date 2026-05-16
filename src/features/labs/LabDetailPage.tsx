import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PermissionGuard } from '@/components/ui/permission-guard'
import { db } from '@/lib/db'
import { dbPut, dbDelete } from '@/lib/db/write'

interface LabDetailPageProps {
  labId: string
}

export function LabDetailPage({ labId }: LabDetailPageProps) {
  const { t } = useTranslation('labs')
  const navigate = useNavigate()
  const [resultText, setResultText] = useState('')
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const lab = useLiveQuery(() => db.labs.get(labId), [labId])
  const patient = useLiveQuery(
    () => (lab?.patientId ? db.patients.get(lab.patientId) : undefined),
    [lab?.patientId],
  )

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
        },
        'update',
      )
      toast.success(t('detail.labCompleted'))
      setCompleteDialogOpen(false)
      setResultText('')
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
        },
        'update',
      )
      toast.success(t('detail.resultSaved'))
      setResultText('')
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
            <p className="whitespace-pre-wrap">{lab.result}</p>
          ) : lab.status === 'requested' ? (
            <div className="space-y-3">
              <Label htmlFor="result-input">{t('detail.enterResult')}</Label>
              <Textarea
                id="result-input"
                placeholder={t('detail.resultPlaceholder')}
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
              />
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

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
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

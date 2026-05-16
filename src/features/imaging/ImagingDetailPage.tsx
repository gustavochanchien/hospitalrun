import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { db } from '@/lib/db'
import { dbPut, dbDelete } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import {
  getImagingSignedUrl,
  removeImagingFile,
  uploadImagingFile,
} from '@/lib/supabase/storage'

interface ImagingDetailPageProps {
  imagingId: string
}

function statusVariant(status: string) {
  switch (status) {
    case 'requested':
      return 'default' as const
    case 'completed':
      return 'secondary' as const
    case 'canceled':
      return 'destructive' as const
    default:
      return 'secondary' as const
  }
}

export function ImagingDetailPage({ imagingId }: ImagingDetailPageProps) {
  const { t } = useTranslation('imaging')
  const navigate = useNavigate()
  const orgId = useAuthStore((state) => state.orgId)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const imaging = useLiveQuery(() => db.imaging.get(imagingId), [imagingId])
  const patient = useLiveQuery(
    () => (imaging?.patientId ? db.patients.get(imaging.patientId) : undefined),
    [imaging?.patientId],
  )

  const storagePath = imaging?.storagePath ?? null

  useEffect(() => {
    if (!storagePath) {
      setPreviewUrl(null)
      setPreviewError(null)
      return
    }
    let cancelled = false
    setPreviewError(null)
    getImagingSignedUrl(storagePath)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Failed to load image'
        setPreviewError(message)
        setPreviewUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [storagePath])

  if (imaging === undefined) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!imaging || imaging._deleted) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <p className="text-muted-foreground">{t('notFound')}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/imaging">{t('backToImaging')}</Link>
        </Button>
      </div>
    )
  }

  const patientName = patient
    ? `${patient.givenName} ${patient.familyName}`
    : 'Unknown Patient'

  async function handleComplete() {
    if (!imaging) return
    await dbPut(
      'imaging',
      {
        ...imaging,
        status: 'completed' as const,
        completedOn: new Date().toISOString(),
      },
      'update',
    )
    toast.success(t('detail.markedCompleted'))
  }

  async function handleCancel() {
    if (!imaging) return
    await dbPut(
      'imaging',
      {
        ...imaging,
        status: 'canceled' as const,
        canceledOn: new Date().toISOString(),
      },
      'update',
    )
    toast.success(t('detail.requestCanceled'))
  }

  async function handleDelete() {
    if (imaging?.storagePath) {
      try {
        await removeImagingFile(imaging.storagePath)
      } catch {
        // Swallow — the DB record is still authoritative and storage RLS
        // may reject deletes if the file is already gone.
      }
    }
    await dbDelete('imaging', imagingId)
    toast.success(t('detail.requestDeleted'))
    await navigate({ to: '/imaging' })
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !imaging) return
    if (!orgId) {
      toast.error(t('detail.missingOrg'))
      return
    }
    setUploading(true)
    try {
      if (imaging.storagePath) {
        try {
          await removeImagingFile(imaging.storagePath)
        } catch {
          // ignore — we still want to proceed with the new upload
        }
      }
      const path = await uploadImagingFile(orgId, imagingId, file)
      await dbPut('imaging', { ...imaging, storagePath: path }, 'update')
      toast.success(t('detail.imageUploaded'))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('detail.uploadFailed')
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  async function handleRemoveImage() {
    if (!imaging?.storagePath) return
    try {
      await removeImagingFile(imaging.storagePath)
    } catch {
      // ignore — proceed with clearing the DB reference
    }
    await dbPut('imaging', { ...imaging, storagePath: null }, 'update')
    toast.success(t('detail.imageRemoved'))
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <CardTitle className="text-xl">{t('detail.cardTitle')}</CardTitle>
          <Badge variant={statusVariant(imaging.status)}>{imaging.status}</Badge>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium text-muted-foreground">{t('fields.patient')}</p>
              <Link
                to="/patients/$patientId"
                params={{ patientId: imaging.patientId }}
                className="text-primary hover:underline"
              >
                {patientName}
              </Link>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">{t('fields.type')}</p>
              <p>{imaging.type}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">{t('fields.code')}</p>
              <p>{imaging.code ?? '—'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">{t('fields.requestedBy')}</p>
              <p>{imaging.requestedBy ?? '—'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">{t('fields.requestedOn')}</p>
              <p>{format(parseISO(imaging.requestedOn), 'MMM d, yyyy h:mm a')}</p>
            </div>
            {imaging.completedOn && (
              <div>
                <p className="font-medium text-muted-foreground">{t('fields.completedOn')}</p>
                <p>{format(parseISO(imaging.completedOn), 'MMM d, yyyy h:mm a')}</p>
              </div>
            )}
            {imaging.canceledOn && (
              <div>
                <p className="font-medium text-muted-foreground">{t('fields.canceledOn')}</p>
                <p>{format(parseISO(imaging.canceledOn), 'MMM d, yyyy h:mm a')}</p>
              </div>
            )}
            <div className="sm:col-span-2">
              <p className="font-medium text-muted-foreground">{t('fields.notes')}</p>
              <p className="whitespace-pre-wrap">{imaging.notes ?? '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t('detail.imageCardTitle')}</CardTitle>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleUpload(e)}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading
                ? t('detail.uploading')
                : imaging.storagePath
                  ? t('detail.replace')
                  : t('detail.upload')}
            </Button>
            {imaging.storagePath && (
              <Button
                variant="ghost"
                size="sm"
                disabled={uploading}
                onClick={() => void handleRemoveImage()}
              >
                {t('detail.remove')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!imaging.storagePath && (
            <p className="text-sm text-muted-foreground">
              {t('detail.noImage')}
            </p>
          )}
          {imaging.storagePath && previewError && (
            <p className="text-sm text-destructive">{previewError}</p>
          )}
          {imaging.storagePath && !previewError && !previewUrl && (
            <Skeleton className="h-48 w-full" />
          )}
          {previewUrl && (
            <img
              src={previewUrl}
              alt="imaging"
              className="max-w-full rounded border"
            />
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {imaging.status === 'requested' && (
          <>
            <Button onClick={() => void handleComplete()}>{t('detail.complete')}</Button>
            <Button variant="outline" onClick={() => void handleCancel()}>
              {t('detail.cancel')}
            </Button>
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
    </div>
  )
}

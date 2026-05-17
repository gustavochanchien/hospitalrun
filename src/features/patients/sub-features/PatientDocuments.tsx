import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { db } from '@/lib/db'
import { dbPut, dbDelete } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { usePermission } from '@/hooks/usePermission'
import { isHubLocalMode } from '@/lib/supabase/client'
import {
  uploadPatientDocumentFile,
  getPatientDocumentSignedUrl,
  removePatientDocumentFile,
} from '@/lib/supabase/documents'
import type { PatientDocument, PatientDocumentCategory } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

interface PatientDocumentsProps {
  patientId: string
}

const CATEGORIES: PatientDocumentCategory[] = ['consent', 'referral', 'scan', 'other']

interface FormState {
  file: File | null
  title: string
  category: PatientDocumentCategory
  description: string
}

const EMPTY_FORM: FormState = {
  file: null,
  title: '',
  category: 'other',
  description: '',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PatientDocuments({ patientId }: PatientDocumentsProps) {
  const { t } = useTranslation('documents')
  const canRead = usePermission('read:documents')
  const canWrite = usePermission('write:documents')
  const canDelete = usePermission('delete:document')

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<PatientDocument | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const documents = useLiveQuery(
    () =>
      db.patientDocuments
        .where({ patientId })
        .filter((r) => !r._deleted)
        .toArray()
        .then((rows) => rows.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))),
    [patientId],
  )

  if (!canRead) {
    return (
      <p className="p-4 text-sm text-muted-foreground" role="status">
        {t('permissionDenied')}
      </p>
    )
  }

  if (documents === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">{t('loading')}</p>
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setFormError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.file) {
      setFormError(t('errors.fileRequired'))
      return
    }
    if (!form.title.trim()) {
      setFormError(t('errors.titleRequired'))
      return
    }
    const orgId = useAuthStore.getState().orgId ?? ''
    const userId = useAuthStore.getState().user?.id ?? null
    if (!orgId) {
      setFormError(t('errors.missingOrg'))
      return
    }
    const id = crypto.randomUUID()
    setUploading(true)
    try {
      const storagePath = await uploadPatientDocumentFile(orgId, id, form.file)
      await dbPut(
        'patientDocuments',
        {
          id,
          orgId,
          patientId,
          visitId: null,
          category: form.category,
          title: form.title.trim(),
          description: form.description.trim() || null,
          storagePath,
          mimeType: form.file.type || 'application/octet-stream',
          sizeBytes: form.file.size,
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
          deletedAt: null,
        },
        'insert',
      )
      resetForm()
      setOpen(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('errors.uploadFailed')
      setFormError(message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    const doc = documents?.find((d) => d.id === id)
    if (doc?.storagePath) {
      try {
        await removePatientDocumentFile(doc.storagePath)
      } catch {
        // ignore — the Dexie record is still authoritative
      }
    }
    await dbDelete('patientDocuments', id)
    setPendingDeleteId(null)
  }

  const localHub = isHubLocalMode()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{t('title')}</h3>
        {canWrite && !localHub ? (
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o)
              if (!o) resetForm()
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">{t('upload.button')}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{t('upload.title')}</DialogTitle>
              </DialogHeader>
              <form noValidate onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="doc-file">{t('fields.file')}</Label>
                  <Input
                    id="doc-file"
                    ref={fileInputRef}
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null
                      setForm((prev) => ({
                        ...prev,
                        file,
                        title: prev.title || (file?.name ?? ''),
                      }))
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doc-title">{t('fields.title')}</Label>
                  <Input
                    id="doc-title"
                    required
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doc-category">{t('fields.category')}</Label>
                  <Select
                    value={form.category}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        category: value as PatientDocumentCategory,
                      }))
                    }
                  >
                    <SelectTrigger id="doc-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {t(`categories.${c}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doc-description">{t('fields.description')}</Label>
                  <Textarea
                    id="doc-description"
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    rows={3}
                  />
                </div>
                {formError && (
                  <p role="alert" className="text-sm text-destructive">
                    {formError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={uploading}
                  >
                    {t('cancel')}
                  </Button>
                  <Button type="submit" disabled={uploading}>
                    {uploading ? t('uploading') : t('save')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {canWrite && localHub && (
        <p className="text-sm text-muted-foreground" role="status">
          {t('localHub.uploadDisabled')}
        </p>
      )}

      {documents.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('noResults')}</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.uploadedAt')}</TableHead>
                <TableHead>{t('table.title')}</TableHead>
                <TableHead>{t('table.category')}</TableHead>
                <TableHead>{t('table.size')}</TableHead>
                <TableHead className="w-[180px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">
                    {format(parseISO(r.uploadedAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>{t(`categories.${r.category}`)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatBytes(r.sizeBytes)}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setPreviewDoc(r)}>
                      {t('preview.action')}
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDeleteId(r.id)}
                      >
                        {t('delete')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PreviewDialog doc={previewDoc} onClose={() => setPreviewDoc(null)} />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingDeleteId(null)
        }}
        title={t('confirmDelete.title')}
        description={t('confirmDelete.description')}
        onConfirm={() => {
          if (pendingDeleteId) void handleDelete(pendingDeleteId)
        }}
      />
    </div>
  )
}

interface PreviewDialogProps {
  doc: PatientDocument | null
  onClose: () => void
}

function PreviewDialog({ doc, onClose }: PreviewDialogProps) {
  const { t } = useTranslation('documents')
  return (
    <Dialog open={doc !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{doc?.title ?? t('preview.title')}</DialogTitle>
        </DialogHeader>
        {doc && <PreviewBody key={doc.id} doc={doc} />}
      </DialogContent>
    </Dialog>
  )
}

interface PreviewBodyProps {
  doc: PatientDocument
}

function PreviewBody({ doc }: PreviewBodyProps) {
  const { t } = useTranslation('documents')
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'ready'; url: string } | { kind: 'error'; message: string }
  >({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    getPatientDocumentSignedUrl(doc.storagePath)
      .then((signed) => {
        if (!cancelled) setState({ kind: 'ready', url: signed })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : t('preview.error')
        setState({ kind: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [doc.storagePath, t])

  const isImage = doc.mimeType.startsWith('image/')
  const isPdf = doc.mimeType === 'application/pdf'

  return (
    <div className="space-y-4">
      {state.kind === 'error' && <p className="text-sm text-destructive">{state.message}</p>}
      {state.kind === 'loading' && <Skeleton className="h-96 w-full" />}
      {state.kind === 'ready' && isImage && (
        <img
          src={state.url}
          alt={doc.title}
          className="max-h-[80vh] w-full rounded border object-contain"
        />
      )}
      {state.kind === 'ready' && isPdf && (
        <iframe src={state.url} title={doc.title} className="h-[80vh] w-full rounded border" />
      )}
      {state.kind === 'ready' && !isImage && !isPdf && (
        <div className="space-y-2 py-6 text-center">
          <p className="text-sm text-muted-foreground">{t('preview.unsupported')}</p>
          <Button asChild>
            <a href={state.url} target="_blank" rel="noopener noreferrer">
              {t('preview.download')}
            </a>
          </Button>
        </div>
      )}
    </div>
  )
}

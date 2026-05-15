import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { db } from '@/lib/db'
import { dbPut, dbDelete } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  RichTextEditor,
  normalizeToHtml,
  sanitizeRichText,
} from '@/components/rich-text-editor'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface PatientNotesProps {
  patientId: string
  visitId?: string | null
}

export function PatientNotes({
  patientId,
  visitId = null,
}: PatientNotesProps) {
  const { t } = useTranslation('patient')
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const notes = useLiveQuery(
    () =>
      db.notes
        .where({ patientId })
        .filter((n) => !n._deleted && (!visitId || n.visitId === visitId))
        .toArray(),
    [patientId, visitId],
  )

  function resetForm() {
    setContent('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return

    const { orgId, user } = useAuthStore.getState()
    await dbPut(
      'notes',
      {
        id: crypto.randomUUID(),
        orgId: orgId ?? '',
        patientId,
        visitId: visitId ?? null,
        content: content.trim(),
        authorId: user?.id ?? null,
        deletedAt: null,
      },
      'insert',
    )
    resetForm()
    setOpen(false)
  }

  if (notes === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">{t('subFeatures.common.loading')}</p>
  }

  const sortedNotes = [...notes].sort(
    (a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime(),
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{t('subFeatures.notes.title')}</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">{t('subFeatures.notes.newAction')}</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('subFeatures.notes.newAction')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="note-content">{t('subFeatures.notes.fields.content')}</Label>
                <RichTextEditor
                  id="note-content"
                  value={content}
                  onChange={setContent}
                  placeholder={t('subFeatures.notes.placeholders.content')}
                />
              </div>
              <Button type="submit" className="w-full">
                {t('subFeatures.notes.create')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {sortedNotes.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('subFeatures.notes.noResults')}
        </p>
      ) : (
        <div className="space-y-3">
          {sortedNotes.map((note) => (
            <Card key={note.id}>
              <CardContent className="space-y-2">
                <div
                  className="prose prose-sm max-w-none text-sm"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeRichText(normalizeToHtml(note.content)),
                  }}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span>
                      {format(parseISO(note.createdAt), 'MMM d, yyyy h:mm a')}
                    </span>
                    {note.authorId && (
                      <span>{t('subFeatures.notes.authorPrefix', { author: note.authorId })}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingDeleteId(note.id)}
                  >
                    {t('subFeatures.common.delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null) }}
        onConfirm={async () => {
          if (pendingDeleteId) {
            await dbDelete('notes', pendingDeleteId)
            setPendingDeleteId(null)
          }
        }}
      />
    </div>
  )
}

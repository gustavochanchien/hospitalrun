import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { Link } from '@tanstack/react-router'
import { db } from '@/lib/db'
import { dbPut, dbDelete } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Badge } from '@/components/ui/badge'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface PatientImagingProps {
  patientId: string
  visitId?: string | null
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

export function PatientImaging({ patientId, visitId = null }: PatientImagingProps) {
  const { t } = useTranslation('patient')
  const [open, setOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [type, setType] = useState('')
  const [code, setCode] = useState('')
  const [notes, setNotes] = useState('')

  const imagingRequests = useLiveQuery(
    () =>
      db.imaging
        .where({ patientId })
        .filter((i) => !i._deleted && (!visitId || i.visitId === visitId))
        .toArray(),
    [patientId, visitId],
  )

  function resetForm() {
    setType('')
    setCode('')
    setNotes('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!type.trim()) return

    const { orgId, user } = useAuthStore.getState()
    await dbPut(
      'imaging',
      {
        id: crypto.randomUUID(),
        orgId: orgId ?? '',
        patientId,
        visitId: visitId ?? null,
        code: code || null,
        type: type.trim(),
        status: 'requested' as const,
        requestedBy: (user?.user_metadata?.full_name as string) ?? user?.id ?? null,
        requestedOn: new Date().toISOString(),
        completedOn: null,
        canceledOn: null,
        notes: notes || null,
        storagePath: null,
        deletedAt: null,
      },
      'insert',
    )
    resetForm()
    setOpen(false)
  }

  async function handleDelete(id: string) {
    await dbDelete('imaging', id)
    setPendingDeleteId(null)
  }

  if (imagingRequests === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">{t('subFeatures.common.loading')}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{t('subFeatures.imaging.title')}</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">{t('subFeatures.imaging.newAction')}</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('subFeatures.imaging.newAction')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="img-type">{t('subFeatures.imaging.fields.type')}</Label>
                <Input
                  id="img-type"
                  required
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder={t('subFeatures.imaging.placeholders.type')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="img-code">{t('subFeatures.imaging.fields.code')}</Label>
                <Input
                  id="img-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t('subFeatures.imaging.placeholders.code')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="img-notes">{t('subFeatures.imaging.fields.notes')}</Label>
                <Textarea
                  id="img-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                {t('subFeatures.imaging.create')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {imagingRequests.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('subFeatures.imaging.noResults')}
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('subFeatures.imaging.fields.type')}</TableHead>
                <TableHead>{t('subFeatures.imaging.fields.code')}</TableHead>
                <TableHead>{t('subFeatures.imaging.fields.status')}</TableHead>
                <TableHead>{t('subFeatures.imaging.fields.requestedOn')}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {imagingRequests.map((img) => (
                <TableRow key={img.id}>
                  <TableCell>
                    <Link
                      to="/imaging/$imagingId"
                      params={{ imagingId: img.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {img.type}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {img.code ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(img.status)}>
                      {img.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(parseISO(img.requestedOn), 'MMM d, yyyy h:mm a')}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDeleteId(img.id)}
                    >
                      {t('subFeatures.common.delete')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(isOpen) => { if (!isOpen) setPendingDeleteId(null) }}
        onConfirm={() => {
          if (pendingDeleteId) void handleDelete(pendingDeleteId)
        }}
      />
    </div>
  )
}

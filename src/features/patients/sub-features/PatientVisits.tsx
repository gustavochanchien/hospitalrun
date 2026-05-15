import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { Link } from '@tanstack/react-router'
import { db } from '@/lib/db'
import { dbPut, dbDelete } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { Button } from '@/components/ui/button'
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface PatientVisitsProps {
  patientId: string
}

type VisitStatus = 'planned' | 'in-progress' | 'finished' | 'cancelled' | 'arrived' | 'triaged' | 'on-leave'

function statusVariant(status: string) {
  switch (status) {
    case 'planned':
      return 'default' as const
    case 'in-progress':
      return 'secondary' as const
    case 'finished':
      return 'outline' as const
    case 'cancelled':
      return 'destructive' as const
    default:
      return 'secondary' as const
  }
}

const STATUS_OPTION_KEY: Record<VisitStatus, string> = {
  planned: 'planned',
  'in-progress': 'inProgress',
  finished: 'finished',
  cancelled: 'cancelled',
  arrived: 'arrived',
  triaged: 'triaged',
  'on-leave': 'onLeave',
}

const VISIT_STATUSES: VisitStatus[] = [
  'planned',
  'in-progress',
  'finished',
  'cancelled',
  'arrived',
  'triaged',
  'on-leave',
]

export function PatientVisits({ patientId }: PatientVisitsProps) {
  const { t } = useTranslation('patient')
  const [open, setOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [type, setType] = useState('')
  const [status, setStatus] = useState<VisitStatus>('planned')
  const [reason, setReason] = useState('')
  const [startDatetime, setStartDatetime] = useState('')
  const [endDatetime, setEndDatetime] = useState('')
  const [location, setLocation] = useState('')

  const visits = useLiveQuery(
    () =>
      db.visits
        .where({ patientId })
        .filter((v) => !v._deleted)
        .toArray(),
    [patientId],
  )

  function resetForm() {
    setType('')
    setStatus('planned')
    setReason('')
    setStartDatetime('')
    setEndDatetime('')
    setLocation('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const orgId = useAuthStore.getState().orgId ?? ''
    await dbPut(
      'visits',
      {
        id: crypto.randomUUID(),
        orgId,
        patientId,
        type: type || null,
        status,
        reason: reason || null,
        startDatetime: startDatetime ? new Date(startDatetime).toISOString() : null,
        endDatetime: endDatetime ? new Date(endDatetime).toISOString() : null,
        location: location || null,
        notes: null,
        deletedAt: null,
      },
      'insert',
    )
    resetForm()
    setOpen(false)
  }

  if (visits === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">{t('subFeatures.common.loading')}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{t('subFeatures.visits.title')}</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">{t('subFeatures.visits.newAction')}</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('subFeatures.visits.newAction')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="visit-type">{t('subFeatures.visits.fields.type')}</Label>
                <Input
                  id="visit-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder={t('subFeatures.visits.placeholders.type')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visit-status">{t('subFeatures.visits.fields.status')}</Label>
                <Select
                  value={status}
                  onValueChange={(val) => setStatus(val as VisitStatus)}
                >
                  <SelectTrigger className="w-full" id="visit-status">
                    <SelectValue placeholder={t('subFeatures.visits.placeholders.status')} />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`subFeatures.visits.statusOption.${STATUS_OPTION_KEY[s]}` as `subFeatures.visits.statusOption.${string}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="visit-reason">{t('subFeatures.visits.fields.reason')}</Label>
                <Textarea
                  id="visit-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('subFeatures.visits.placeholders.reason')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visit-start">{t('subFeatures.visits.fields.start')}</Label>
                <Input
                  id="visit-start"
                  type="datetime-local"
                  value={startDatetime}
                  onChange={(e) => setStartDatetime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visit-end">{t('subFeatures.visits.fields.end')}</Label>
                <Input
                  id="visit-end"
                  type="datetime-local"
                  value={endDatetime}
                  onChange={(e) => setEndDatetime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visit-location">{t('subFeatures.visits.fields.location')}</Label>
                <Input
                  id="visit-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t('subFeatures.visits.placeholders.location')}
                />
              </div>
              <Button type="submit" className="w-full">
                {t('subFeatures.visits.create')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {visits.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('subFeatures.visits.noResults')}
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('subFeatures.visits.fields.type')}</TableHead>
                <TableHead>{t('subFeatures.visits.fields.status')}</TableHead>
                <TableHead>{t('subFeatures.visits.fields.reason')}</TableHead>
                <TableHead>{t('subFeatures.visits.fields.start')}</TableHead>
                <TableHead>{t('subFeatures.visits.fields.end')}</TableHead>
                <TableHead>{t('subFeatures.visits.fields.location')}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visits.map((visit) => (
                <TableRow key={visit.id}>
                  <TableCell>
                    <Link
                      to="/visits/$visitId"
                      params={{ visitId: visit.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {visit.type ?? t('subFeatures.visits.fallbackName')}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(visit.status)}>
                      {visit.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {visit.reason ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {visit.startDatetime
                      ? format(parseISO(visit.startDatetime), 'MMM d, yyyy h:mm a')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {visit.endDatetime
                      ? format(parseISO(visit.endDatetime), 'MMM d, yyyy h:mm a')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {visit.location ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDeleteId(visit.id)}
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
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null) }}
        onConfirm={async () => {
          if (pendingDeleteId) {
            await dbDelete('visits', pendingDeleteId)
            setPendingDeleteId(null)
          }
        }}
      />
    </div>
  )
}

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RichTextEditor } from '@/components/rich-text-editor'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { CareGoal } from '@/lib/db/schema'

type AchievementStatus = CareGoal['achievementStatus']
type Priority = NonNullable<CareGoal['priority']>

const ACHIEVEMENT_STATUSES: AchievementStatus[] = [
  'in-progress',
  'improving',
  'worsening',
  'no-change',
  'no-progress',
  'not-achieving',
  'sustaining',
  'achieved',
  'not-attainable',
]

const PRIORITIES: Priority[] = ['low', 'medium', 'high']

interface PatientCareGoalsProps {
  patientId: string
}

export function PatientCareGoals({ patientId }: PatientCareGoalsProps) {
  const { t } = useTranslation('patient')
  const [open, setOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [achievementStatus, setAchievementStatus] = useState<AchievementStatus>('in-progress')
  const [priority, setPriority] = useState<Priority | ''>('')
  const [startDate, setStartDate] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<string>('')

  const careGoals = useLiveQuery(
    () =>
      db.careGoals
        .where('patientId')
        .equals(patientId)
        .filter((g) => !g._deleted)
        .toArray(),
    [patientId],
  )

  function resetForm() {
    setDescription('')
    setAchievementStatus('in-progress')
    setPriority('')
    setStartDate('')
    setTargetDate('')
    setNotes('')
    setStatus('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return

    const orgId = useAuthStore.getState().orgId ?? ''
    const record: CareGoal = {
      id: crypto.randomUUID(),
      orgId,
      patientId,
      description: description.trim(),
      achievementStatus,
      priority: priority || null,
      startDate: startDate || null,
      targetDate: targetDate || null,
      notes: notes.trim() || null,
      status: (status as CareGoal['status']) || null,
      deletedAt: null,
      createdAt: '',
      updatedAt: '',
      _synced: false,
      _deleted: false,
    }

    await dbPut('careGoals', record, 'insert')
    resetForm()
    setOpen(false)
  }

  function achievementBadgeVariant(status: AchievementStatus) {
    switch (status) {
      case 'achieved':
        return 'default' as const
      case 'not-attainable':
      case 'not-achieving':
        return 'destructive' as const
      default:
        return 'secondary' as const
    }
  }

  function priorityBadgeVariant(p: Priority) {
    switch (p) {
      case 'high':
        return 'destructive' as const
      case 'medium':
        return 'default' as const
      case 'low':
        return 'secondary' as const
    }
  }

  if (careGoals === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">{t('subFeatures.common.loading')}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('subFeatures.careGoals.title')}</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">{t('subFeatures.careGoals.newAction')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('subFeatures.careGoals.newAction')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cg-description">{t('subFeatures.careGoals.fields.descriptionRequired')}</Label>
                <RichTextEditor
                  id="cg-description"
                  value={description}
                  onChange={setDescription}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cg-achievementStatus">{t('subFeatures.careGoals.fields.achievementStatus')}</Label>
                <Select
                  value={achievementStatus}
                  onValueChange={(v) => setAchievementStatus(v as AchievementStatus)}
                >
                  <SelectTrigger id="cg-achievementStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACHIEVEMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cg-priority">{t('subFeatures.careGoals.fields.priority')}</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as Priority)}
                >
                  <SelectTrigger id="cg-priority">
                    <SelectValue placeholder={t('subFeatures.careGoals.placeholders.priority')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cg-status">{t('subFeatures.careGoals.fields.status')}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="cg-status">
                    <SelectValue placeholder={t('subFeatures.careGoals.placeholders.status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proposed">proposed</SelectItem>
                    <SelectItem value="planned">planned</SelectItem>
                    <SelectItem value="accepted">accepted</SelectItem>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="on-hold">on-hold</SelectItem>
                    <SelectItem value="completed">completed</SelectItem>
                    <SelectItem value="cancelled">cancelled</SelectItem>
                    <SelectItem value="rejected">rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cg-startDate">{t('subFeatures.careGoals.fields.startDate')}</Label>
                  <Input
                    id="cg-startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cg-targetDate">{t('subFeatures.careGoals.fields.targetDate')}</Label>
                  <Input
                    id="cg-targetDate"
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cg-notes">{t('subFeatures.careGoals.fields.notes')}</Label>
                <RichTextEditor
                  id="cg-notes"
                  value={notes}
                  onChange={setNotes}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t('subFeatures.careGoals.cancel')}
                </Button>
                <Button type="submit">{t('subFeatures.careGoals.save')}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {careGoals.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('subFeatures.careGoals.noResults')}
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('subFeatures.careGoals.headers.description')}</TableHead>
                <TableHead>{t('subFeatures.careGoals.headers.status')}</TableHead>
                <TableHead>{t('subFeatures.careGoals.headers.achievementStatus')}</TableHead>
                <TableHead>{t('subFeatures.careGoals.headers.priority')}</TableHead>
                <TableHead>{t('subFeatures.careGoals.headers.startDate')}</TableHead>
                <TableHead>{t('subFeatures.careGoals.headers.targetDate')}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {careGoals.map((goal) => (
                <TableRow key={goal.id}>
                  <TableCell className="font-medium">{goal.description}</TableCell>
                  <TableCell>
                    {goal.status ? (
                      <Badge variant="secondary">{goal.status}</Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={achievementBadgeVariant(goal.achievementStatus)}>
                      {goal.achievementStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {goal.priority ? (
                      <Badge variant={priorityBadgeVariant(goal.priority)}>
                        {goal.priority}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {goal.startDate
                      ? format(parseISO(goal.startDate), 'MMM d, yyyy')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {goal.targetDate
                      ? format(parseISO(goal.targetDate), 'MMM d, yyyy')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setPendingDeleteId(goal.id)}
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
            await dbDelete('careGoals', pendingDeleteId)
            setPendingDeleteId(null)
          }
        }}
      />
    </div>
  )
}

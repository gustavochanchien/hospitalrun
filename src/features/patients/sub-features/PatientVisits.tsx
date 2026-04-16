import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
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

export function PatientVisits({ patientId }: PatientVisitsProps) {
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
    return <p className="p-4 text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Visits</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">New Visit</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Visit</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="visit-type">Type</Label>
                <Input
                  id="visit-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="e.g. Inpatient, Outpatient, Emergency"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visit-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(val) => setStatus(val as VisitStatus)}
                >
                  <SelectTrigger className="w-full" id="visit-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="finished">Finished</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="arrived">Arrived</SelectItem>
                    <SelectItem value="triaged">Triaged</SelectItem>
                    <SelectItem value="on-leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="visit-reason">Reason</Label>
                <Textarea
                  id="visit-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for visit"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visit-start">Start</Label>
                <Input
                  id="visit-start"
                  type="datetime-local"
                  value={startDatetime}
                  onChange={(e) => setStartDatetime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visit-end">End</Label>
                <Input
                  id="visit-end"
                  type="datetime-local"
                  value={endDatetime}
                  onChange={(e) => setEndDatetime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visit-location">Location</Label>
                <Input
                  id="visit-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Room 201, Ward B"
                />
              </div>
              <Button type="submit" className="w-full">
                Create Visit
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {visits.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No visits found.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Location</TableHead>
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
                      {visit.type ?? 'Visit'}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(visit.status)}>
                      {visit.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {visit.reason ?? '\u2014'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {visit.startDatetime
                      ? format(parseISO(visit.startDatetime), 'MMM d, yyyy h:mm a')
                      : '\u2014'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {visit.endDatetime
                      ? format(parseISO(visit.endDatetime), 'MMM d, yyyy h:mm a')
                      : '\u2014'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {visit.location ?? '\u2014'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDeleteId(visit.id)}
                    >
                      Delete
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

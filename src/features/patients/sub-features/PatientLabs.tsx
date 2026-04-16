import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
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

interface PatientLabsProps {
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

export function PatientLabs({ patientId, visitId = null }: PatientLabsProps) {
  const [open, setOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [type, setType] = useState('')
  const [code, setCode] = useState('')
  const [notes, setNotes] = useState('')

  const labs = useLiveQuery(
    () =>
      db.labs
        .where({ patientId })
        .filter((l) => !l._deleted && (!visitId || l.visitId === visitId))
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
    const fullName = (user?.user_metadata?.full_name as string) ?? user?.id ?? null
    await dbPut(
      'labs',
      {
        id: crypto.randomUUID(),
        orgId: orgId ?? '',
        patientId,
        visitId: visitId ?? null,
        code: code || null,
        type: type.trim(),
        status: 'requested' as const,
        requestedBy: fullName,
        requestedAt: new Date().toISOString(),
        completedAt: null,
        canceledAt: null,
        result: null,
        notes: notes || null,
        deletedAt: null,
      },
      'insert',
    )
    resetForm()
    setOpen(false)
  }

  async function handleDelete(id: string) {
    await dbDelete('labs', id)
    setPendingDeleteId(null)
  }

  if (labs === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Labs</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">New Lab</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Lab</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lab-type">Type</Label>
                <Input
                  id="lab-type"
                  required
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="e.g. CBC, BMP, Lipid Panel"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lab-code">Code</Label>
                <Input
                  id="lab-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. 85025"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lab-notes">Notes</Label>
                <Textarea
                  id="lab-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                Create Lab
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {labs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No labs found.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested At</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {labs.map((lab) => (
                <TableRow key={lab.id}>
                  <TableCell>
                    <Link
                      to="/labs/$labId"
                      params={{ labId: lab.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {lab.type}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lab.code ?? '\u2014'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(lab.status)}>
                      {lab.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(parseISO(lab.requestedAt), 'MMM d, yyyy h:mm a')}
                  </TableCell>
                  <TableCell
                    className="max-w-[200px] truncate text-muted-foreground"
                    title={lab.result ?? undefined}
                  >
                    {lab.result ?? '\u2014'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDeleteId(lab.id)}
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
        onOpenChange={(isOpen) => { if (!isOpen) setPendingDeleteId(null) }}
        onConfirm={() => {
          if (pendingDeleteId) void handleDelete(pendingDeleteId)
        }}
      />
    </div>
  )
}

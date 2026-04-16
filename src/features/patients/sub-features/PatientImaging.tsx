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
    return <p className="p-4 text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Imaging</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">New Imaging</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Imaging</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="img-type">Type</Label>
                <Input
                  id="img-type"
                  required
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="e.g. X-Ray, CT Scan, MRI"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="img-code">Code</Label>
                <Input
                  id="img-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. 71046"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="img-notes">Notes</Label>
                <Textarea
                  id="img-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                Create Imaging
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {imagingRequests.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No imaging requests found.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested On</TableHead>
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
                    {img.code ?? '\u2014'}
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

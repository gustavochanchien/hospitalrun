import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
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
        <p className="text-muted-foreground">Lab not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/labs">Back to Labs</Link>
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
      toast.error('Please enter a result before completing.')
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
      toast.success('Lab completed')
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
      toast.success('Lab canceled')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveResult() {
    if (!resultText.trim()) {
      toast.error('Please enter a result.')
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
      toast.success('Result saved')
      setResultText('')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    await dbDelete('labs', labId)
    toast.success('Lab deleted')
    await navigate({ to: '/labs' })
  }

  return (
    <div className="space-y-6 p-6">
      {/* Lab Info Card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <CardTitle className="text-xl">Lab Details</CardTitle>
          <Badge variant={statusVariant}>{lab.status}</Badge>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium text-muted-foreground">Patient</p>
              <Link
                to="/patients/$patientId"
                params={{ patientId: lab.patientId }}
                className="text-primary hover:underline"
              >
                {patientName}
              </Link>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Type</p>
              <p>{lab.type}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Code</p>
              <p>{lab.code ?? '\u2014'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Requested By</p>
              <p>{lab.requestedBy ?? '\u2014'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Requested At</p>
              <p>{format(parseISO(lab.requestedAt), 'MMM d, yyyy h:mm a')}</p>
            </div>
            {lab.completedAt && (
              <div>
                <p className="font-medium text-muted-foreground">Completed At</p>
                <p>{format(parseISO(lab.completedAt), 'MMM d, yyyy h:mm a')}</p>
              </div>
            )}
            {lab.canceledAt && (
              <div>
                <p className="font-medium text-muted-foreground">Canceled At</p>
                <p>{format(parseISO(lab.canceledAt), 'MMM d, yyyy h:mm a')}</p>
              </div>
            )}
            {lab.notes && (
              <div className="sm:col-span-2">
                <p className="font-medium text-muted-foreground">Notes</p>
                <p className="whitespace-pre-wrap">{lab.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Result Section */}
      <Card>
        <CardHeader>
          <CardTitle>Result</CardTitle>
        </CardHeader>
        <CardContent>
          {lab.status === 'completed' && lab.result ? (
            <p className="whitespace-pre-wrap">{lab.result}</p>
          ) : lab.status === 'requested' ? (
            <div className="space-y-3">
              <Label htmlFor="result-input">Enter Result</Label>
              <Textarea
                id="result-input"
                placeholder="Enter lab result..."
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
              />
              <Button
                onClick={handleSaveResult}
                disabled={isSaving || !resultText.trim()}
              >
                {isSaving ? 'Saving...' : 'Save Result'}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground">No result available.</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {lab.status === 'requested' && (
          <>
            <PermissionGuard permission="complete:lab">
              <Button onClick={() => setCompleteDialogOpen(true)}>
                Complete
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="cancel:lab">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel Lab
              </Button>
            </PermissionGuard>
          </>
        )}
        <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
          Delete
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
            <DialogTitle>Complete Lab</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="complete-result">Result *</Label>
            <Textarea
              id="complete-result"
              placeholder="Enter lab result..."
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
              {isSaving ? 'Saving...' : 'Save & Complete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

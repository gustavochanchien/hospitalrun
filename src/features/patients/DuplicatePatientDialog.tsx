import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from '@tanstack/react-router'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { db } from '@/lib/db'

interface DuplicatePatientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  givenName: string
  familyName: string
  onConfirm: () => void
}

export function DuplicatePatientDialog({
  open,
  onOpenChange,
  givenName,
  familyName,
  onConfirm,
}: DuplicatePatientDialogProps) {
  const givenLower = givenName.toLowerCase()
  const familyLower = familyName.toLowerCase()

  const duplicates = useLiveQuery(
    () =>
      db.patients
        .filter(
          (p) =>
            !p._deleted &&
            p.givenName.toLowerCase().includes(givenLower) &&
            p.familyName.toLowerCase().includes(familyLower),
        )
        .limit(10)
        .toArray(),
    [givenLower, familyLower],
  )

  if (!duplicates || duplicates.length === 0) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Possible Duplicate Patient</AlertDialogTitle>
          <AlertDialogDescription>
            We found {duplicates.length} existing patient
            {duplicates.length > 1 ? 's' : ''} with a similar name. Do you
            still want to create a new patient?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-48 space-y-2 overflow-y-auto py-2">
          {duplicates.map((p) => (
            <Link
              key={p.id}
              to="/patients/$patientId"
              params={{ patientId: p.id }}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
              onClick={() => onOpenChange(false)}
            >
              <span className="font-medium">
                {p.givenName} {p.familyName}
              </span>
              {p.mrn && (
                <span className="text-muted-foreground">MRN: {p.mrn}</span>
              )}
            </Link>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Create Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

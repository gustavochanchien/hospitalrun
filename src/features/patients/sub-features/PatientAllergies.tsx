import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
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

interface PatientAllergiesProps {
  patientId: string
}

type Severity = 'mild' | 'moderate' | 'severe'

function severityVariant(severity: Severity | null) {
  switch (severity) {
    case 'mild':
      return 'secondary' as const
    case 'moderate':
      return 'default' as const
    case 'severe':
      return 'destructive' as const
    default:
      return 'outline' as const
  }
}

export function PatientAllergies({ patientId }: PatientAllergiesProps) {
  const [open, setOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [allergen, setAllergen] = useState('')
  const [reaction, setReaction] = useState('')
  const [severity, setSeverity] = useState<Severity | ''>('')

  const allergies = useLiveQuery(
    () =>
      db.allergies
        .where({ patientId })
        .filter((a) => !a._deleted)
        .toArray(),
    [patientId],
  )

  function resetForm() {
    setAllergen('')
    setReaction('')
    setSeverity('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allergen) return

    const orgId = useAuthStore.getState().orgId ?? ''
    await dbPut(
      'allergies',
      {
        id: crypto.randomUUID(),
        orgId,
        patientId,
        allergen,
        reaction: reaction || null,
        severity: severity || null,
        notedAt: null,
        deletedAt: null,
      },
      'insert',
    )
    resetForm()
    setOpen(false)
  }

  async function handleDelete(id: string) {
    await dbDelete('allergies', id)
    setPendingDeleteId(null)
  }

  if (allergies === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Allergies</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">New Allergy</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Allergy</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="allergy-allergen">Allergen</Label>
                <Input
                  id="allergy-allergen"
                  required
                  value={allergen}
                  onChange={(e) => setAllergen(e.target.value)}
                  placeholder="e.g. Penicillin"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="allergy-reaction">Reaction</Label>
                <Input
                  id="allergy-reaction"
                  value={reaction}
                  onChange={(e) => setReaction(e.target.value)}
                  placeholder="e.g. Hives, Anaphylaxis"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="allergy-severity">Severity</Label>
                <Select
                  value={severity}
                  onValueChange={(v) => setSeverity(v as Severity)}
                >
                  <SelectTrigger id="allergy-severity">
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">
                Create Allergy
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {allergies.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No allergies found.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Allergen</TableHead>
                <TableHead>Reaction</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {allergies.map((allergy) => (
                <TableRow key={allergy.id}>
                  <TableCell className="font-medium">
                    {allergy.allergen}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {allergy.reaction ?? '\u2014'}
                  </TableCell>
                  <TableCell>
                    {allergy.severity ? (
                      <Badge variant={severityVariant(allergy.severity)}>
                        {allergy.severity}
                      </Badge>
                    ) : (
                      '\u2014'
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDeleteId(allergy.id)}
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

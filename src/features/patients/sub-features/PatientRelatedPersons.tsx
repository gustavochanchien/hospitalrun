import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { RelatedPerson } from '@/lib/db/schema'

interface PatientRelatedPersonsProps {
  patientId: string
}

export function PatientRelatedPersons({ patientId }: PatientRelatedPersonsProps) {
  const [open, setOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [givenName, setGivenName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const relatedPersons = useLiveQuery(
    () =>
      db.relatedPersons
        .where('patientId')
        .equals(patientId)
        .filter((r) => !r._deleted)
        .toArray(),
    [patientId],
  )

  function resetForm() {
    setGivenName('')
    setFamilyName('')
    setRelationship('')
    setPhone('')
    setEmail('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!givenName.trim() || !familyName.trim()) return

    const orgId = useAuthStore.getState().orgId ?? ''
    const record: RelatedPerson = {
      id: crypto.randomUUID(),
      orgId,
      patientId,
      givenName: givenName.trim(),
      familyName: familyName.trim(),
      relationship: relationship.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: null,
      deletedAt: null,
      createdAt: '',
      updatedAt: '',
      _synced: false,
      _deleted: false,
    }

    await dbPut('relatedPersons', record, 'insert')
    resetForm()
    setOpen(false)
  }

  if (relatedPersons === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Related Persons</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">New Related Person</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Related Person</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rp-givenName">First Name *</Label>
                <Input
                  id="rp-givenName"
                  value={givenName}
                  onChange={(e) => setGivenName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-familyName">Last Name *</Label>
                <Input
                  id="rp-familyName"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-relationship">Relationship</Label>
                <Input
                  id="rp-relationship"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-phone">Phone</Label>
                <Input
                  id="rp-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-email">Email</Label>
                <Input
                  id="rp-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {relatedPersons.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No related persons recorded.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Relationship</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {relatedPersons.map((rp) => (
                <TableRow key={rp.id}>
                  <TableCell className="font-medium">
                    {rp.givenName} {rp.familyName}
                  </TableCell>
                  <TableCell>{rp.relationship ?? '\u2014'}</TableCell>
                  <TableCell>{rp.phone ?? '\u2014'}</TableCell>
                  <TableCell>{rp.email ?? '\u2014'}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setPendingDeleteId(rp.id)}
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
            await dbDelete('relatedPersons', pendingDeleteId)
            setPendingDeleteId(null)
          }
        }}
      />
    </div>
  )
}

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { Link2 } from 'lucide-react'
import { db } from '@/lib/db'
import { dbPut, dbDelete } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PatientPicker } from '@/components/patient-picker'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { Patient, RelatedPerson } from '@/lib/db/schema'

interface PatientRelatedPersonsProps {
  patientId: string
}

const RELATIONSHIP_SUGGESTIONS = [
  'spouse',
  'partner',
  'parent',
  'child',
  'sibling',
  'guardian',
  'grandparent',
  'grandchild',
  'head-of-household',
  'friend',
  'emergency-contact',
  'other',
]

export function PatientRelatedPersons({ patientId }: PatientRelatedPersonsProps) {
  const { t } = useTranslation('patient')
  const [open, setOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [givenName, setGivenName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [linkedPatientId, setLinkedPatientId] = useState<string | null>(null)
  const [isPrimaryContact, setIsPrimaryContact] = useState(false)

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
    setLinkedPatientId(null)
    setIsPrimaryContact(false)
  }

  function handleLinkedPatientChange(p: Patient | null) {
    setLinkedPatientId(p?.id ?? null)
    if (p) {
      if (!givenName.trim()) setGivenName(p.givenName)
      if (!familyName.trim()) setFamilyName(p.familyName)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!givenName.trim() || !familyName.trim()) return

    const orgId = useAuthStore.getState().orgId ?? ''

    if (isPrimaryContact) {
      const others = (relatedPersons ?? []).filter(
        (r) => r.isPrimaryContact && !r._deleted,
      )
      for (const other of others) {
        await dbPut('relatedPersons', { ...other, isPrimaryContact: false }, 'update')
      }
    }

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
      linkedPatientId,
      isPrimaryContact,
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
    return <p className="p-4 text-sm text-muted-foreground">{t('subFeatures.common.loading')}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('subFeatures.relatedPersons.title')}</h3>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v) }}>
          <DialogTrigger asChild>
            <Button size="sm">{t('subFeatures.relatedPersons.newAction')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('subFeatures.relatedPersons.newAction')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rp-linkedPatient">
                  {t('subFeatures.relatedPersons.fields.linkedPatient')}
                </Label>
                <PatientPicker
                  id="rp-linkedPatient"
                  value={linkedPatientId}
                  onChange={handleLinkedPatientChange}
                  excludePatientId={patientId}
                  placeholder={t('subFeatures.relatedPersons.placeholders.selectPatient')}
                  searchPlaceholder={t('subFeatures.relatedPersons.placeholders.selectPatient')}
                  noResultsLabel={t('subFeatures.relatedPersons.placeholders.noPatients')}
                  clearable
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-givenName">{t('subFeatures.relatedPersons.fields.givenNameRequired')}</Label>
                <Input
                  id="rp-givenName"
                  value={givenName}
                  onChange={(e) => setGivenName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-familyName">{t('subFeatures.relatedPersons.fields.familyNameRequired')}</Label>
                <Input
                  id="rp-familyName"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-relationship">{t('subFeatures.relatedPersons.fields.relationship')}</Label>
                <Input
                  id="rp-relationship"
                  list="rp-relationship-suggestions"
                  placeholder={t('subFeatures.relatedPersons.placeholders.relationship')}
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                />
                <datalist id="rp-relationship-suggestions">
                  {RELATIONSHIP_SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-phone">{t('subFeatures.relatedPersons.fields.phone')}</Label>
                <Input
                  id="rp-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-email">{t('subFeatures.relatedPersons.fields.email')}</Label>
                <Input
                  id="rp-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rp-primary"
                  checked={isPrimaryContact}
                  onCheckedChange={(c) => setIsPrimaryContact(c === true)}
                />
                <Label htmlFor="rp-primary" className="text-sm font-normal cursor-pointer">
                  {t('subFeatures.relatedPersons.fields.primaryContact')}
                </Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t('subFeatures.relatedPersons.cancel')}
                </Button>
                <Button type="submit">{t('subFeatures.relatedPersons.save')}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {relatedPersons.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('subFeatures.relatedPersons.noResults')}
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('subFeatures.relatedPersons.fields.name')}</TableHead>
                <TableHead>{t('subFeatures.relatedPersons.fields.relationship')}</TableHead>
                <TableHead>{t('subFeatures.relatedPersons.fields.phone')}</TableHead>
                <TableHead>{t('subFeatures.relatedPersons.fields.email')}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {relatedPersons.map((rp) => (
                <TableRow key={rp.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      {rp.linkedPatientId ? (
                        <Link
                          to="/patients/$patientId"
                          params={{ patientId: rp.linkedPatientId }}
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          <Link2 className="h-3.5 w-3.5 text-muted-foreground" aria-label={t('subFeatures.relatedPersons.badges.linked')} />
                          {rp.givenName} {rp.familyName}
                        </Link>
                      ) : (
                        <span>{rp.givenName} {rp.familyName}</span>
                      )}
                      {rp.isPrimaryContact && (
                        <Badge variant="secondary" className="text-xs">
                          {t('subFeatures.relatedPersons.badges.primary')}
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{rp.relationship ?? '—'}</TableCell>
                  <TableCell>{rp.phone ?? '—'}</TableCell>
                  <TableCell>{rp.email ?? '—'}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setPendingDeleteId(rp.id)}
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
            await dbDelete('relatedPersons', pendingDeleteId)
            setPendingDeleteId(null)
          }
        }}
      />
    </div>
  )
}

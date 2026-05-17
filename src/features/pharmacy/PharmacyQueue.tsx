import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { PermissionGuard } from '@/components/ui/permission-guard'
import { db } from '@/lib/db'
import type { Medication } from '@/lib/db/schema'
import { DispenseDialog } from './DispenseDialog'

export function PharmacyQueue() {
  const { t } = useTranslation('pharmacy')
  const [selected, setSelected] = useState<Medication | null>(null)

  const medications = useLiveQuery(
    () =>
      db.medications
        .filter(
          (m) =>
            !m._deleted &&
            m.status === 'active' &&
            m.inventoryItemId !== null,
        )
        .toArray(),
    [],
  )

  const patientIds = useMemo(
    () => Array.from(new Set((medications ?? []).map((m) => m.patientId))),
    [medications],
  )
  const itemIds = useMemo(
    () =>
      Array.from(
        new Set(
          (medications ?? [])
            .map((m) => m.inventoryItemId)
            .filter((id): id is string => id !== null),
        ),
      ),
    [medications],
  )

  const patients = useLiveQuery(
    () => db.patients.where('id').anyOf(patientIds).toArray(),
    [patientIds.join('|')],
  )
  const items = useLiveQuery(
    () => db.inventoryItems.where('id').anyOf(itemIds).toArray(),
    [itemIds.join('|')],
  )

  if (medications === undefined) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (medications.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        {t('queue.empty')}
      </p>
    )
  }

  const patientById = new Map((patients ?? []).map((p) => [p.id, p]))
  const itemById = new Map((items ?? []).map((i) => [i.id, i]))

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('queue.columns.patient')}</TableHead>
            <TableHead>{t('queue.columns.medication')}</TableHead>
            <TableHead>{t('queue.columns.item')}</TableHead>
            <TableHead className="text-right">{t('queue.columns.onHand')}</TableHead>
            <TableHead className="text-right">{t('queue.columns.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {medications.map((med) => {
            const patient = patientById.get(med.patientId)
            const item = med.inventoryItemId
              ? itemById.get(med.inventoryItemId)
              : undefined
            return (
              <TableRow key={med.id}>
                <TableCell>
                  {patient
                    ? `${patient.givenName} ${patient.familyName}`
                    : t('queue.unknownPatient')}
                </TableCell>
                <TableCell>{med.name}</TableCell>
                <TableCell>{item?.name ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {item ? `${item.onHand.toFixed(2)} ${item.unit}` : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <PermissionGuard permission="dispense:medication">
                    <Button size="sm" onClick={() => setSelected(med)}>
                      {t('queue.dispense')}
                    </Button>
                  </PermissionGuard>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {selected && (
        <DispenseDialog
          medication={selected}
          open={!!selected}
          onOpenChange={(open) => !open && setSelected(null)}
        />
      )}
    </>
  )
}

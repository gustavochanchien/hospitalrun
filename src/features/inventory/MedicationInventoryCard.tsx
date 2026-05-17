import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Link } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FeatureGate } from '@/components/ui/feature-gate'
import { PermissionGuard } from '@/components/ui/permission-guard'
import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import type { Medication } from '@/lib/db/schema'
import { dispenseMedication } from '@/features/pharmacy/dispense'

const ROUTES = ['oral', 'topical', 'inhaled', 'injection', 'rectal', 'ophthalmic', 'otic'] as const

interface MedicationInventoryCardProps {
  medication: Medication
}

const UNLINKED = '__unlinked__'

export function MedicationInventoryCard({
  medication,
}: MedicationInventoryCardProps) {
  const { t } = useTranslation('inventory')
  const { t: tPharm } = useTranslation('pharmacy')
  const [dispenseOpen, setDispenseOpen] = useState(false)
  const [dispenseQty, setDispenseQty] = useState('1')
  const [dosageInstructions, setDosageInstructions] = useState(
    medication.dosageInstructions ?? '',
  )
  const [route, setRoute] = useState(medication.route ?? '')
  const [frequency, setFrequency] = useState(medication.frequency ?? '')
  const [submitting, setSubmitting] = useState(false)

  const items = useLiveQuery(
    () => db.inventoryItems.filter((i) => !i._deleted && i.active).toArray(),
    [],
  )

  const linked = useLiveQuery(
    () =>
      medication.inventoryItemId
        ? db.inventoryItems.get(medication.inventoryItemId)
        : undefined,
    [medication.inventoryItemId],
  )

  async function handleLinkChange(value: string) {
    const newId = value === UNLINKED ? null : value
    await dbPut(
      'medications',
      { ...medication, inventoryItemId: newId },
      'update',
    )
  }

  async function handleDispense() {
    const qty = Number(dispenseQty)
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error(t('validation.quantityPositive'))
      return
    }
    const orgId = useAuthStore.getState().orgId
    if (!orgId || !medication.inventoryItemId) return

    setSubmitting(true)
    try {
      await dispenseMedication({
        kind: 'queue',
        orgId,
        medication,
        quantity: qty,
        dosageInstructions: dosageInstructions.trim() || null,
        route: route || null,
        frequency: frequency.trim() || null,
      })
      toast.success(t('dialog.recorded'))
      setDispenseOpen(false)
      setDispenseQty('1')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FeatureGate feature="inventory">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('patientTab.title')}</CardTitle>
          <CardDescription>
            {linked
              ? `${linked.name} — ${linked.onHand.toFixed(2)} ${linked.unit}`
              : t('list.empty')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <PermissionGuard permission="write:inventory">
              <div className="space-y-1">
                <Label htmlFor="med-inventory-link">{t('list.title')}</Label>
                <Select
                  value={medication.inventoryItemId ?? UNLINKED}
                  onValueChange={handleLinkChange}
                >
                  <SelectTrigger id="med-inventory-link" className="w-[260px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNLINKED}>{t('lowStock.empty')}</SelectItem>
                    {items?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </PermissionGuard>
            {linked && (
              <>
                <PermissionGuard permission="receive:stock">
                  <Button onClick={() => setDispenseOpen(true)}>
                    {t('detail.kind.dispense')}
                  </Button>
                </PermissionGuard>
                <Button asChild variant="ghost" size="sm">
                  <Link
                    to="/inventory/$itemId"
                    params={{ itemId: linked.id }}
                  >
                    {t('lowStock.viewItem')}
                  </Link>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dispenseOpen} onOpenChange={setDispenseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('detail.kind.dispense')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="dispense-qty">{t('dialog.quantity')}</Label>
              <Input
                id="dispense-qty"
                type="number"
                step="0.01"
                min="0"
                value={dispenseQty}
                onChange={(e) => setDispenseQty(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dispense-dosage">
                {tPharm('dispense.dosageInstructions')}
              </Label>
              <Textarea
                id="dispense-dosage"
                rows={2}
                value={dosageInstructions}
                onChange={(e) => setDosageInstructions(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="dispense-route">{tPharm('dispense.route')}</Label>
                <Select value={route} onValueChange={setRoute}>
                  <SelectTrigger id="dispense-route">
                    <SelectValue placeholder={tPharm('dispense.routePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUTES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {tPharm(`dispense.routes.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="dispense-frequency">
                  {tPharm('dispense.frequency')}
                </Label>
                <Input
                  id="dispense-frequency"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  placeholder={tPharm('dispense.frequencyPlaceholder')}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispenseOpen(false)}>
              {t('dialog.cancel')}
            </Button>
            <Button onClick={handleDispense} disabled={submitting}>
              {submitting ? t('dialog.recording') : t('dialog.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FeatureGate>
  )
}

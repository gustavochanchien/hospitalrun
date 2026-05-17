import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import i18next from 'i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { PdfExportButton } from '@/components/pdf-export-button'
import { db } from '@/lib/db'
import { resolveOrgName } from '@/lib/pdf/org'
import { useAuthStore } from '@/features/auth/auth.store'
import type {
  InventoryTransaction,
  Medication,
} from '@/lib/db/schema'
import { dispenseMedication } from './dispense'

const ROUTES = ['oral', 'topical', 'inhaled', 'injection', 'rectal', 'ophthalmic', 'otic'] as const

interface DispenseDialogProps {
  medication: Medication
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DispenseDialog({
  medication,
  open,
  onOpenChange,
}: DispenseDialogProps) {
  const { t } = useTranslation('pharmacy')
  const [quantity, setQuantity] = useState('1')
  const [dosageInstructions, setDosageInstructions] = useState(
    medication.dosageInstructions ?? '',
  )
  const [route, setRoute] = useState(medication.route ?? '')
  const [frequency, setFrequency] = useState(medication.frequency ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    medication: Medication
    transaction: InventoryTransaction
  } | null>(null)

  useEffect(() => {
    if (open) {
      setQuantity('1')
      setDosageInstructions(medication.dosageInstructions ?? '')
      setRoute(medication.route ?? '')
      setFrequency(medication.frequency ?? '')
      setResult(null)
    }
  }, [open, medication])

  const patient = useLiveQuery(
    () => db.patients.get(medication.patientId),
    [medication.patientId],
  )
  const item = useLiveQuery(
    () =>
      medication.inventoryItemId
        ? db.inventoryItems.get(medication.inventoryItemId)
        : undefined,
    [medication.inventoryItemId],
  )

  async function handleSubmit() {
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error(t('validation.quantityPositive'))
      return
    }
    const orgId = useAuthStore.getState().orgId
    if (!orgId) return

    setSubmitting(true)
    try {
      const outcome = await dispenseMedication({
        kind: 'queue',
        orgId,
        medication,
        quantity: qty,
        dosageInstructions: dosageInstructions.trim() || null,
        route: route || null,
        frequency: frequency.trim() || null,
      })
      setResult(outcome)
      toast.success(t('dispense.success'))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dispense.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">{t('dispense.medication')}:</span>{' '}
            {medication.name}
          </p>
          {patient && (
            <p>
              <span className="text-muted-foreground">{t('dispense.patient')}:</span>{' '}
              {patient.givenName} {patient.familyName}
            </p>
          )}
          {item && (
            <p>
              <span className="text-muted-foreground">{t('dispense.onHand')}:</span>{' '}
              {item.onHand.toFixed(2)} {item.unit}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="dispense-qty">{t('dispense.quantity')}</Label>
            <Input
              id="dispense-qty"
              type="number"
              step="0.01"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={!!result}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dispense-dosage">{t('dispense.dosageInstructions')}</Label>
            <Textarea
              id="dispense-dosage"
              rows={2}
              value={dosageInstructions}
              onChange={(e) => setDosageInstructions(e.target.value)}
              disabled={!!result}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="dispense-route">{t('dispense.route')}</Label>
              <Select
                value={route}
                onValueChange={setRoute}
                disabled={!!result}
              >
                <SelectTrigger id="dispense-route">
                  <SelectValue placeholder={t('dispense.routePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {ROUTES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`dispense.routes.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="dispense-frequency">{t('dispense.frequency')}</Label>
              <Input
                id="dispense-frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                placeholder={t('dispense.frequencyPlaceholder')}
                disabled={!!result}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          {result && patient && item ? (
            <>
              <PdfExportButton
                filename={`pharmacy-receipt-${result.transaction.id.slice(0, 8)}`}
                label={t('dispense.printReceipt')}
                buildDocument={async () => {
                  const orgName = await resolveOrgName(result.medication.orgId)
                  const { PharmacyReceiptPdf } = await import('./pdf/PharmacyReceiptPdf')
                  return (
                    <PharmacyReceiptPdf
                      orgName={orgName}
                      medication={result.medication}
                      patient={patient}
                      inventoryItem={item}
                      transaction={result.transaction}
                      generatedAt={new Date()}
                      locale={i18next.language}
                    />
                  )
                }}
              />
              <Button onClick={() => onOpenChange(false)}>
                {t('dispense.done')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('dispense.cancel')}
              </Button>
              <Button onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting ? t('dispense.submitting') : t('dispense.submit')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

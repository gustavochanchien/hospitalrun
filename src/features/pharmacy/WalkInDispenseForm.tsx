import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import i18next from 'i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
  Patient,
  InventoryItem,
} from '@/lib/db/schema'
import { dispenseMedication } from './dispense'

const ROUTES = ['oral', 'topical', 'inhaled', 'injection', 'rectal', 'ophthalmic', 'otic'] as const

interface WalkInResult {
  medication: Medication
  transaction: InventoryTransaction
  patient: Patient
  item: InventoryItem
}

export function WalkInDispenseForm() {
  const { t } = useTranslation('pharmacy')
  const [patientId, setPatientId] = useState('')
  const [patientName, setPatientName] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)

  const [inventoryItemId, setInventoryItemId] = useState('')
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [dosageInstructions, setDosageInstructions] = useState('')
  const [route, setRoute] = useState('')
  const [frequency, setFrequency] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<WalkInResult | null>(null)

  const patients = useLiveQuery(
    () => db.patients.filter((p) => !p._deleted).toArray(),
    [],
  )
  const items = useLiveQuery(
    () =>
      db.inventoryItems.filter((i) => !i._deleted && i.active).toArray(),
    [],
  )

  const filteredPatients = useMemo(() => {
    if (!patients) return []
    if (!patientSearch) return patients.slice(0, 10)
    const lower = patientSearch.toLowerCase()
    return patients
      .filter((p) =>
        `${p.givenName} ${p.familyName}`.toLowerCase().includes(lower),
      )
      .slice(0, 10)
  }, [patients, patientSearch])

  function resetForm() {
    setPatientId('')
    setPatientName('')
    setPatientSearch('')
    setInventoryItemId('')
    setName('')
    setQuantity('1')
    setDosageInstructions('')
    setRoute('')
    setFrequency('')
    setResult(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!patientId) {
      toast.error(t('validation.patientRequired'))
      return
    }
    if (!inventoryItemId) {
      toast.error(t('validation.itemRequired'))
      return
    }
    if (!name.trim()) {
      toast.error(t('validation.nameRequired'))
      return
    }
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
        kind: 'walkIn',
        orgId,
        patientId,
        inventoryItemId,
        name: name.trim(),
        quantity: qty,
        dosageInstructions: dosageInstructions.trim() || null,
        route: route || null,
        frequency: frequency.trim() || null,
        requestedBy: useAuthStore.getState().user?.email ?? null,
      })
      const patient = await db.patients.get(patientId)
      const item = await db.inventoryItems.get(inventoryItemId)
      if (patient && item) {
        setResult({
          medication: outcome.medication,
          transaction: outcome.transaction,
          patient,
          item,
        })
      }
      toast.success(t('dispense.success'))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="max-w-xl space-y-4 p-2">
        <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
          <p className="font-medium">{t('walkIn.recorded')}</p>
          <p className="mt-1 text-muted-foreground">
            {t('walkIn.recordedDetail', {
              quantity: result.transaction.quantity,
              unit: result.item.unit,
              item: result.item.name,
              patient: `${result.patient.givenName} ${result.patient.familyName}`,
            })}
          </p>
        </div>
        <div className="flex gap-2">
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
                  patient={result.patient}
                  inventoryItem={result.item}
                  transaction={result.transaction}
                  generatedAt={new Date()}
                  locale={i18next.language}
                />
              )
            }}
          />
          <Button variant="outline" onClick={resetForm}>
            {t('walkIn.another')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4 p-2">
      <div className="space-y-1">
        <Label>{t('walkIn.patient')}</Label>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <div ref={triggerRef}>
              <Input
                placeholder={t('walkIn.patientPlaceholder')}
                value={popoverOpen ? patientSearch : patientName || patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value)
                  if (!popoverOpen) setPopoverOpen(true)
                  if (patientId) {
                    setPatientId('')
                    setPatientName('')
                  }
                }}
                onFocus={() => setPopoverOpen(true)}
              />
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {filteredPatients.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                {t('walkIn.noPatients')}
              </p>
            ) : (
              <ul className="max-h-60 overflow-y-auto">
                {filteredPatients.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                      onClick={() => {
                        setPatientId(p.id)
                        setPatientName(`${p.givenName} ${p.familyName}`)
                        setPatientSearch('')
                        setPopoverOpen(false)
                      }}
                    >
                      {p.givenName} {p.familyName}
                      {p.mrn && (
                        <span className="ml-2 text-muted-foreground">
                          MRN: {p.mrn}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-1">
        <Label htmlFor="walkin-item">{t('walkIn.item')}</Label>
        <Select
          value={inventoryItemId}
          onValueChange={(v) => {
            setInventoryItemId(v)
            const picked = items?.find((i) => i.id === v)
            if (picked && !name) setName(picked.name)
          }}
        >
          <SelectTrigger id="walkin-item">
            <SelectValue placeholder={t('walkIn.itemPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {items?.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name} ({i.sku}) — {i.onHand.toFixed(2)} {i.unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="walkin-name">{t('walkIn.name')}</Label>
          <Input
            id="walkin-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="walkin-qty">{t('dispense.quantity')}</Label>
          <Input
            id="walkin-qty"
            type="number"
            step="0.01"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="walkin-dosage">{t('dispense.dosageInstructions')}</Label>
        <Textarea
          id="walkin-dosage"
          rows={2}
          value={dosageInstructions}
          onChange={(e) => setDosageInstructions(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="walkin-route">{t('dispense.route')}</Label>
          <Select value={route} onValueChange={setRoute}>
            <SelectTrigger id="walkin-route">
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
          <Label htmlFor="walkin-frequency">{t('dispense.frequency')}</Label>
          <Input
            id="walkin-frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            placeholder={t('dispense.frequencyPlaceholder')}
          />
        </div>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? t('dispense.submitting') : t('walkIn.submit')}
      </Button>
    </form>
  )
}

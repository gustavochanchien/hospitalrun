import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PermissionGuard } from '@/components/ui/permission-guard'
import { PdfExportButton } from '@/components/pdf-export-button'
import { PrintButton } from '@/components/print-button'
import { resolveOrgName } from '@/lib/pdf/org'
import { db } from '@/lib/db'
import { dbPut, dbDelete } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import type { Invoice, InvoiceLineItem, ChargeItem } from '@/lib/db/schema'
import { PaymentDialog } from './PaymentDialog'
import { computeInvoiceTotals, formatMoney, inferStatus } from './invoice-totals'

interface InvoiceDetailPageProps {
  invoiceId: string
}

export function InvoiceDetailPage({ invoiceId }: InvoiceDetailPageProps) {
  const { t } = useTranslation('billing')
  const navigate = useNavigate()
  const orgId = useAuthStore((s) => s.orgId)
  const [confirmVoidOpen, setConfirmVoidOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const invoice = useLiveQuery(() => db.invoices.get(invoiceId), [invoiceId])
  const patient = useLiveQuery(
    () => (invoice?.patientId ? db.patients.get(invoice.patientId) : undefined),
    [invoice?.patientId],
  )
  const lineItems = useLiveQuery(
    () =>
      db.invoiceLineItems
        .where('invoiceId')
        .equals(invoiceId)
        .filter((l) => !l._deleted)
        .toArray(),
    [invoiceId],
  )
  const payments = useLiveQuery(
    () =>
      db.payments
        .where('invoiceId')
        .equals(invoiceId)
        .filter((p) => !p._deleted)
        .toArray(),
    [invoiceId],
  )
  const chargeItems = useLiveQuery(
    () => db.chargeItems.filter((c) => !c._deleted && c.active).toArray(),
    [],
  )

  const totals = useMemo(() => {
    if (!invoice) return null
    return computeInvoiceTotals(invoice, lineItems ?? [], payments ?? [])
  }, [invoice, lineItems, payments])

  useEffect(() => {
    if (!invoice || !totals) return
    if (invoice._deleted) return
    const newStatus = inferStatus(invoice.status, totals)
    const drift =
      invoice.subtotal !== totals.subtotal ||
      invoice.total !== totals.total ||
      invoice.amountPaid !== totals.amountPaid ||
      invoice.status !== newStatus
    if (!drift) return
    void dbPut(
      'invoices',
      {
        ...invoice,
        subtotal: totals.subtotal,
        total: totals.total,
        amountPaid: totals.amountPaid,
        status: newStatus,
      },
      'update',
    )
  }, [invoice, totals])

  if (invoice === undefined) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  if (!invoice || invoice._deleted) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <p className="text-muted-foreground">{t('detail.notFound')}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/billing">{t('detail.backToList')}</Link>
        </Button>
      </div>
    )
  }

  const editable = invoice.status === 'draft'
  const patientName = patient
    ? `${patient.givenName} ${patient.familyName}`
    : t('list.unknownPatient')

  async function handleAddLine(values: {
    chargeItemId: string | null
    description: string
    quantity: number
    unitAmount: number
  }) {
    if (!invoice || !orgId) return
    const amount = round2(values.quantity * values.unitAmount)
    await dbPut(
      'invoiceLineItems',
      {
        id: crypto.randomUUID(),
        orgId,
        invoiceId: invoice.id,
        chargeItemId: values.chargeItemId,
        description: values.description,
        quantity: values.quantity,
        unitAmount: values.unitAmount,
        amount,
        deletedAt: null,
        createdAt: '',
        updatedAt: '',
        _synced: false,
        _deleted: false,
      },
      'insert',
    )
  }

  async function handleRemoveLine(line: InvoiceLineItem) {
    await dbDelete('invoiceLineItems', line.id)
  }

  async function handleUpdateTaxDiscount(field: 'tax' | 'discount', value: number) {
    if (!invoice) return
    await dbPut(
      'invoices',
      { ...invoice, [field]: round2(value) },
      'update',
    )
  }

  async function handleIssue() {
    if (!invoice) return
    setSaving(true)
    try {
      await dbPut(
        'invoices',
        {
          ...invoice,
          status: 'issued' as const,
          issuedAt: new Date().toISOString(),
        },
        'update',
      )
      toast.success(t('detail.issued'))
    } finally {
      setSaving(false)
    }
  }

  async function handleVoid() {
    if (!invoice) return
    setSaving(true)
    try {
      await dbPut(
        'invoices',
        { ...invoice, status: 'void' as const },
        'update',
      )
      toast.success(t('detail.voided'))
    } finally {
      setSaving(false)
      setConfirmVoidOpen(false)
    }
  }

  async function handleDelete() {
    if (!invoice) return
    await dbDelete('invoices', invoice.id)
    toast.success(t('detail.deleted'))
    await navigate({ to: '/billing' })
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-xl">{invoice.invoiceNumber}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              <Link
                to="/patients/$patientId"
                params={{ patientId: invoice.patientId }}
                className="text-primary hover:underline"
              >
                {patientName}
              </Link>
            </p>
          </div>
          <Badge variant={statusVariant(invoice.status)}>
            {t(`status.${invoice.status}` as 'status.draft')}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium text-muted-foreground">{t('detail.createdAt')}</p>
              <p>{format(parseISO(invoice.createdAt), 'MMM d, yyyy h:mm a')}</p>
            </div>
            {invoice.issuedAt && (
              <div>
                <p className="font-medium text-muted-foreground">{t('detail.issuedAt')}</p>
                <p>{format(parseISO(invoice.issuedAt), 'MMM d, yyyy h:mm a')}</p>
              </div>
            )}
            {invoice.dueAt && (
              <div>
                <p className="font-medium text-muted-foreground">{t('detail.dueAt')}</p>
                <p>{format(parseISO(invoice.dueAt), 'MMM d, yyyy')}</p>
              </div>
            )}
            {invoice.notes && (
              <div className="sm:col-span-2">
                <p className="font-medium text-muted-foreground">{t('form.notes')}</p>
                <p className="whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('lineItems.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {(lineItems?.length ?? 0) === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{t('lineItems.empty')}</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('lineItems.description')}</TableHead>
                    <TableHead className="text-right">{t('lineItems.quantity')}</TableHead>
                    <TableHead className="text-right">{t('lineItems.unitAmount')}</TableHead>
                    <TableHead className="text-right">{t('lineItems.amount')}</TableHead>
                    {editable && <TableHead className="w-[80px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems!.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{line.description}</TableCell>
                      <TableCell className="text-right">{line.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(line.unitAmount, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(line.amount, invoice.currency)}
                      </TableCell>
                      {editable && (
                        <TableCell>
                          <PermissionGuard permission="write:billing">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleRemoveLine(line)}
                            >
                              {t('lineItems.remove')}
                            </Button>
                          </PermissionGuard>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {editable && (
            <PermissionGuard permission="write:billing">
              <AddLineForm
                chargeItems={chargeItems ?? []}
                currency={invoice.currency}
                onAdd={handleAddLine}
              />
            </PermissionGuard>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('totals.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <TotalRow label={t('totals.subtotal')} value={formatMoney(totals?.subtotal ?? 0, invoice.currency)} />
          {editable ? (
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="invoice-tax">{t('totals.tax')}</Label>
              <Input
                id="invoice-tax"
                type="number"
                step="0.01"
                className="max-w-[140px] text-right"
                value={invoice.tax}
                onChange={(e) => void handleUpdateTaxDiscount('tax', parseFloat(e.target.value) || 0)}
              />
            </div>
          ) : (
            <TotalRow label={t('totals.tax')} value={formatMoney(totals?.tax ?? 0, invoice.currency)} />
          )}
          {editable ? (
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="invoice-discount">{t('totals.discount')}</Label>
              <Input
                id="invoice-discount"
                type="number"
                step="0.01"
                className="max-w-[140px] text-right"
                value={invoice.discount}
                onChange={(e) =>
                  void handleUpdateTaxDiscount('discount', parseFloat(e.target.value) || 0)
                }
              />
            </div>
          ) : (
            <TotalRow label={t('totals.discount')} value={formatMoney(totals?.discount ?? 0, invoice.currency)} />
          )}
          <TotalRow
            label={t('totals.total')}
            value={formatMoney(totals?.total ?? 0, invoice.currency)}
            emphasize
          />
          <TotalRow label={t('totals.amountPaid')} value={formatMoney(totals?.amountPaid ?? 0, invoice.currency)} />
          <TotalRow
            label={t('totals.balance')}
            value={formatMoney(totals?.balance ?? 0, invoice.currency)}
            emphasize
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('payments.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {(payments?.length ?? 0) === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{t('payments.empty')}</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('payments.receivedAt')}</TableHead>
                    <TableHead>{t('payments.method')}</TableHead>
                    <TableHead>{t('payments.reference')}</TableHead>
                    <TableHead className="text-right">{t('payments.amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments!.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{format(parseISO(p.receivedAt), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{t(`method.${p.method}` as 'method.cash')}</TableCell>
                      <TableCell className="text-muted-foreground">{p.reference ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(p.amount, invoice.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {invoice.status !== 'draft' && invoice.status !== 'void' && (
            <PermissionGuard permission="record:payment">
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => setPaymentOpen(true)}
              >
                {t('payments.record')}
              </Button>
            </PermissionGuard>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3" data-print-actions>
        {invoice.status === 'draft' && (lineItems?.length ?? 0) > 0 && (
          <PermissionGuard permission="write:billing">
            <Button onClick={() => void handleIssue()} disabled={saving}>
              {t('actions.issue')}
            </Button>
          </PermissionGuard>
        )}
        {invoice.status !== 'draft' && invoice.status !== 'void' && (
          <PermissionGuard permission="void:invoice">
            <Button variant="outline" onClick={() => setConfirmVoidOpen(true)}>
              {t('actions.void')}
            </Button>
          </PermissionGuard>
        )}
        <PdfExportButton
          filename={`invoice-${invoice.invoiceNumber}`}
          buildDocument={async () => {
            const orgName = await resolveOrgName(orgId)
            const { InvoicePdf } = await import('./pdf/InvoicePdf')
            return (
              <InvoicePdf
                orgName={orgName}
                invoice={invoice}
                patient={patient ?? null}
                lineItems={lineItems ?? []}
                payments={payments ?? []}
                generatedAt={new Date()}
                locale={i18n.language}
              />
            )
          }}
        />
        <PrintButton />
        {invoice.status === 'draft' && (
          <PermissionGuard permission="write:billing">
            <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
              {t('detail.delete')}
            </Button>
          </PermissionGuard>
        )}
      </div>

      <ConfirmDialog
        open={confirmVoidOpen}
        onOpenChange={setConfirmVoidOpen}
        title={t('actions.void')}
        description={t('actions.confirmVoid')}
        confirmLabel={t('actions.void')}
        onConfirm={() => void handleVoid()}
      />
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t('detail.deleteTitle')}
        description={t('detail.deleteDescription')}
        confirmLabel={t('detail.delete')}
        onConfirm={() => void handleDelete()}
      />
      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        invoice={invoice}
      />
    </div>
  )
}

interface AddLineFormProps {
  chargeItems: readonly ChargeItem[]
  currency: string
  onAdd: (values: {
    chargeItemId: string | null
    description: string
    quantity: number
    unitAmount: number
  }) => Promise<void>
}

function AddLineForm({ chargeItems, currency, onAdd }: AddLineFormProps) {
  const { t } = useTranslation('billing')
  const [chargeItemId, setChargeItemId] = useState<string>('custom')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitAmount, setUnitAmount] = useState('0')
  const [submitting, setSubmitting] = useState(false)

  function handleChargeItemChange(id: string) {
    setChargeItemId(id)
    if (id !== 'custom') {
      const item = chargeItems.find((c) => c.id === id)
      if (item) {
        setDescription(item.name)
        setUnitAmount(String(item.unitAmount))
      }
    }
  }

  async function handleAdd() {
    const q = parseFloat(quantity)
    const u = parseFloat(unitAmount)
    if (!description.trim() || !Number.isFinite(q) || q <= 0 || !Number.isFinite(u) || u < 0) {
      toast.error(t('validation.lineItemInvalid'))
      return
    }
    setSubmitting(true)
    try {
      await onAdd({
        chargeItemId: chargeItemId === 'custom' ? null : chargeItemId,
        description: description.trim(),
        quantity: q,
        unitAmount: u,
      })
      setChargeItemId('custom')
      setDescription('')
      setQuantity('1')
      setUnitAmount('0')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-4 grid gap-3 rounded-md border bg-muted/30 p-4 md:grid-cols-[2fr_1fr_1fr_auto]">
      <div className="space-y-2 md:col-span-2">
        <Label>{t('lineItems.description')}</Label>
        {chargeItems.length > 0 ? (
          <Select value={chargeItemId} onValueChange={handleChargeItemChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">{t('lineItems.custom')}</SelectItem>
              {chargeItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name} — {formatMoney(item.unitAmount, currency)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Input
          placeholder={t('lineItems.descriptionPlaceholder')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>{t('lineItems.quantity')}</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>{t('lineItems.unitAmount')}</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={unitAmount}
          onChange={(e) => setUnitAmount(e.target.value)}
        />
      </div>
      <div className="md:col-span-4">
        <Button
          type="button"
          onClick={() => void handleAdd()}
          disabled={submitting || !description.trim()}
        >
          {t('lineItems.addLine')}
        </Button>
      </div>
    </div>
  )
}

function TotalRow({
  label,
  value,
  emphasize = false,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={emphasize ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
      <span className={emphasize ? 'font-medium tabular-nums' : 'tabular-nums'}>{value}</span>
    </div>
  )
}

function statusVariant(status: Invoice['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'paid':
      return 'secondary'
    case 'void':
      return 'destructive'
    case 'partial':
    case 'issued':
      return 'default'
    case 'draft':
    default:
      return 'outline'
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

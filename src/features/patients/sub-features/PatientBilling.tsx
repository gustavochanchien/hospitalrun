import { Link } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FeatureGate } from '@/components/ui/feature-gate'
import { PermissionGuard } from '@/components/ui/permission-guard'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { db } from '@/lib/db'
import type { Invoice } from '@/lib/db/schema'
import { formatMoney } from '@/features/billing/invoice-totals'

interface PatientBillingProps {
  patientId: string
}

export function PatientBilling({ patientId }: PatientBillingProps) {
  const { t } = useTranslation('billing')

  const invoices = useLiveQuery(
    () =>
      db.invoices
        .where('patientId')
        .equals(patientId)
        .filter((i) => !i._deleted)
        .toArray(),
    [patientId],
  )

  return (
    <FeatureGate feature="billing">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">{t('patientTab.title')}</h3>
          <PermissionGuard permission="write:billing">
            <Button asChild size="sm">
              <Link to="/billing/new">{t('list.newInvoice')}</Link>
            </Button>
          </PermissionGuard>
        </div>

        {invoices === undefined ? (
          <p className="py-4 text-sm text-muted-foreground">{t('patientTab.loading')}</p>
        ) : invoices.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('patientTab.empty')}
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('list.columns.invoiceNumber')}</TableHead>
                  <TableHead>{t('list.columns.status')}</TableHead>
                  <TableHead className="text-right">{t('list.columns.total')}</TableHead>
                  <TableHead className="text-right">{t('list.columns.balance')}</TableHead>
                  <TableHead>{t('list.columns.createdAt')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...invoices]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Link
                          to="/billing/$invoiceId"
                          params={{ invoiceId: invoice.id }}
                          className="font-medium text-primary hover:underline"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(invoice.total, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(invoice.total - invoice.amountPaid, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(parseISO(invoice.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </FeatureGate>
  )
}

function StatusBadge({ status }: { status: Invoice['status'] }) {
  const { t } = useTranslation('billing')
  const variant: 'default' | 'secondary' | 'destructive' | 'outline' =
    status === 'paid'
      ? 'secondary'
      : status === 'void'
        ? 'destructive'
        : status === 'partial' || status === 'issued'
          ? 'default'
          : 'outline'
  return <Badge variant={variant}>{t(`status.${status}` as 'status.draft')}</Badge>
}

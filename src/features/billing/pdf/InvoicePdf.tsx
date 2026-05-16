import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'
import i18next from 'i18next'
import type React from 'react'

import { PdfFooter, PdfHeader, pdfStyles, pdfTheme } from '@/lib/pdf'
import type { Invoice, InvoiceLineItem, Patient, Payment } from '@/lib/db/schema'

export interface InvoicePdfProps {
  orgName: string
  invoice: Invoice
  patient: Patient | null
  lineItems: readonly InvoiceLineItem[]
  payments: readonly Payment[]
  generatedAt: Date
  locale: string
}

const DATE_FORMAT = 'MMM d, yyyy'

const localStyles = StyleSheet.create({
  twoColMeta: {
    flexDirection: 'row',
    marginBottom: pdfTheme.spacing.section,
  },
  metaCol: {
    flex: 1,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: pdfTheme.colors.border,
  },
  colDescription: {
    flex: 3,
    fontSize: pdfTheme.fontSizes.body,
  },
  colQty: {
    flex: 1,
    fontSize: pdfTheme.fontSizes.body,
    textAlign: 'right',
  },
  colUnit: {
    flex: 1,
    fontSize: pdfTheme.fontSizes.body,
    textAlign: 'right',
  },
  colAmount: {
    flex: 1,
    fontSize: pdfTheme.fontSizes.body,
    textAlign: 'right',
  },
  tableHeaderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: pdfTheme.fontSizes.small,
    color: pdfTheme.colors.muted,
  },
  totalsBlock: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  totalLabel: {
    width: 90,
    textAlign: 'right',
    color: pdfTheme.colors.muted,
    fontSize: pdfTheme.fontSizes.body,
    paddingRight: 8,
  },
  totalValue: {
    width: 80,
    textAlign: 'right',
    fontSize: pdfTheme.fontSizes.body,
  },
  totalRowBold: {
    flexDirection: 'row',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: pdfTheme.colors.border,
  },
  totalLabelBold: {
    width: 90,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: pdfTheme.fontSizes.body,
    paddingRight: 8,
  },
  totalValueBold: {
    width: 80,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: pdfTheme.fontSizes.body,
  },
  statusBadge: {
    color: pdfTheme.colors.accent,
    fontFamily: 'Helvetica-Bold',
  },
  notesText: {
    color: pdfTheme.colors.muted,
    fontSize: pdfTheme.fontSizes.body,
    marginTop: 2,
  },
})

function formatCurrency(amount: number, locale: string, currency: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
  } catch {
    return String(amount)
  }
}

export function InvoicePdf({
  orgName,
  invoice,
  patient,
  lineItems,
  payments,
  generatedAt,
  locale,
}: InvoicePdfProps): React.JSX.Element {
  const t = i18next.getFixedT(locale, 'billing')

  const patientName =
    patient != null
      ? `${patient.givenName} ${patient.familyName}`.trim()
      : t('list.unknownPatient')

  const activeLineItems = lineItems.filter((li) => !li._deleted)
  const activePayments = payments.filter((p) => !p._deleted)

  const issuedAtFormatted =
    invoice.issuedAt != null ? format(parseISO(invoice.issuedAt), DATE_FORMAT) : '—'
  const dueAtFormatted =
    invoice.dueAt != null ? format(parseISO(invoice.dueAt), DATE_FORMAT) : '—'

  const fmt = (amount: number) => formatCurrency(amount, locale, invoice.currency)

  const generatedLabel = i18next.getFixedT(locale, 'pdf')('footer.generated', {
    date: format(generatedAt, 'PPpp'),
  })
  const pageLabel = i18next.getFixedT(locale, 'pdf')('footer.page', {
    page: '{{page}}',
    total: '{{total}}',
  })

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader
          orgName={orgName || i18next.getFixedT(locale, 'pdf')('common.noOrgName')}
          title={`${t('pdf.title')} — ${invoice.invoiceNumber}`}
        />

        {/* Two-column meta block */}
        <View style={localStyles.twoColMeta}>
          <View style={localStyles.metaCol}>
            <View style={pdfStyles.fieldRow}>
              <Text style={pdfStyles.fieldLabel}>{t('pdf.patient')}</Text>
              <Text style={pdfStyles.fieldValue}>{patientName}</Text>
            </View>
            <View style={pdfStyles.fieldRow}>
              <Text style={pdfStyles.fieldLabel}>{t('pdf.invoiceNumber')}</Text>
              <Text style={pdfStyles.fieldValue}>{invoice.invoiceNumber}</Text>
            </View>
          </View>
          <View style={localStyles.metaCol}>
            <View style={pdfStyles.fieldRow}>
              <Text style={pdfStyles.fieldLabel}>{t('pdf.status')}</Text>
              <Text style={[pdfStyles.fieldValue, localStyles.statusBadge]}>
                {t(`status.${invoice.status}`)}
              </Text>
            </View>
            <View style={pdfStyles.fieldRow}>
              <Text style={pdfStyles.fieldLabel}>{t('pdf.issuedAt')}</Text>
              <Text style={pdfStyles.fieldValue}>{issuedAtFormatted}</Text>
            </View>
            <View style={pdfStyles.fieldRow}>
              <Text style={pdfStyles.fieldLabel}>{t('pdf.dueAt')}</Text>
              <Text style={pdfStyles.fieldValue}>{dueAtFormatted}</Text>
            </View>
          </View>
        </View>

        {/* Line items table */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionHeading}>{t('lineItems.title')}</Text>

          {/* Table header */}
          <View style={localStyles.tableHeaderRow}>
            <Text style={[localStyles.colDescription, localStyles.tableHeaderText]}>
              {t('pdf.description')}
            </Text>
            <Text style={[localStyles.colQty, localStyles.tableHeaderText]}>
              {t('pdf.quantity')}
            </Text>
            <Text style={[localStyles.colUnit, localStyles.tableHeaderText]}>
              {t('pdf.unitAmount')}
            </Text>
            <Text style={[localStyles.colAmount, localStyles.tableHeaderText]}>
              {t('pdf.amount')}
            </Text>
          </View>

          {/* Table body */}
          {activeLineItems.map((li) => (
            <View key={li.id} style={localStyles.tableRow}>
              <Text style={localStyles.colDescription}>{li.description}</Text>
              <Text style={localStyles.colQty}>{String(li.quantity)}</Text>
              <Text style={localStyles.colUnit}>{fmt(li.unitAmount)}</Text>
              <Text style={localStyles.colAmount}>{fmt(li.amount)}</Text>
            </View>
          ))}

          {activeLineItems.length === 0 && (
            <Text style={pdfStyles.muted}>{t('lineItems.empty')}</Text>
          )}
        </View>

        {/* Totals block */}
        <View style={localStyles.totalsBlock}>
          <View style={localStyles.totalRow}>
            <Text style={localStyles.totalLabel}>{t('pdf.subtotal')}</Text>
            <Text style={localStyles.totalValue}>{fmt(invoice.subtotal)}</Text>
          </View>
          <View style={localStyles.totalRow}>
            <Text style={localStyles.totalLabel}>{t('pdf.tax')}</Text>
            <Text style={localStyles.totalValue}>{fmt(invoice.tax)}</Text>
          </View>
          <View style={localStyles.totalRow}>
            <Text style={localStyles.totalLabel}>{t('pdf.discount')}</Text>
            <Text style={localStyles.totalValue}>({fmt(invoice.discount)})</Text>
          </View>
          <View style={localStyles.totalRowBold}>
            <Text style={localStyles.totalLabelBold}>{t('pdf.total')}</Text>
            <Text style={localStyles.totalValueBold}>{fmt(invoice.total)}</Text>
          </View>
          <View style={localStyles.totalRow}>
            <Text style={localStyles.totalLabel}>{t('pdf.amountPaid')}</Text>
            <Text style={localStyles.totalValue}>{fmt(invoice.amountPaid)}</Text>
          </View>
          <View style={localStyles.totalRowBold}>
            <Text style={localStyles.totalLabelBold}>{t('pdf.balance')}</Text>
            <Text style={localStyles.totalValueBold}>
              {fmt(invoice.total - invoice.amountPaid)}
            </Text>
          </View>
        </View>

        {/* Payments table — only when payments exist */}
        {activePayments.length > 0 && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionHeading}>{t('pdf.payments')}</Text>

            <View style={localStyles.tableHeaderRow}>
              <Text style={[localStyles.colDescription, localStyles.tableHeaderText]}>
                {t('pdf.receivedAt')}
              </Text>
              <Text style={[localStyles.colQty, localStyles.tableHeaderText]}>
                {t('pdf.method')}
              </Text>
              <Text style={[localStyles.colUnit, localStyles.tableHeaderText]}>
                {t('pdf.reference')}
              </Text>
              <Text style={[localStyles.colAmount, localStyles.tableHeaderText]}>
                {t('pdf.amount')}
              </Text>
            </View>

            {activePayments.map((p) => (
              <View key={p.id} style={localStyles.tableRow}>
                <Text style={localStyles.colDescription}>
                  {format(parseISO(p.receivedAt), DATE_FORMAT)}
                </Text>
                <Text style={localStyles.colQty}>{t(`method.${p.method}`)}</Text>
                <Text style={localStyles.colUnit}>{p.reference ?? '—'}</Text>
                <Text style={localStyles.colAmount}>{fmt(p.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Notes block — only when notes exist */}
        {invoice.notes != null && invoice.notes.trim().length > 0 && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionHeading}>{t('pdf.notes')}</Text>
            <Text style={localStyles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        <PdfFooter generatedLabel={generatedLabel} pageLabel={pageLabel} />
      </Page>
    </Document>
  )
}

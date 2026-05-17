import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { format } from 'date-fns'
import i18next from 'i18next'
import type React from 'react'

import { PdfFooter, PdfHeader, pdfStyles, pdfTheme } from '@/lib/pdf'
import type { InventoryItem, InventoryTransaction, Medication, Patient } from '@/lib/db/schema'

export interface PharmacyReceiptPdfProps {
  orgName: string
  medication: Medication
  patient: Patient
  inventoryItem: InventoryItem
  transaction: InventoryTransaction
  generatedAt: Date
  locale: string
}

const localStyles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    marginBottom: pdfTheme.spacing.section,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: pdfTheme.fontSizes.small,
    color: pdfTheme.colors.muted,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: pdfTheme.fontSizes.body,
    color: pdfTheme.colors.text,
    fontFamily: 'Helvetica-Bold',
  },
})

export function PharmacyReceiptPdf({
  orgName,
  medication,
  patient,
  inventoryItem,
  transaction,
  generatedAt,
  locale,
}: PharmacyReceiptPdfProps): React.JSX.Element {
  const tPdf = i18next.getFixedT(locale, 'pdf')

  const noOrgName = tPdf('common.notSpecified') as string
  const notSpecified = tPdf('common.notSpecified') as string

  const receiptNumber = transaction.id.slice(0, 8).toUpperCase()
  const dispensedAt = format(new Date(transaction.occurredAt), 'PPpp')

  const patientName = `${patient.givenName} ${patient.familyName}`.trim()
  const mrn = patient.mrn ?? notSpecified

  const allDirectionsNull =
    medication.dosageInstructions == null &&
    medication.route == null &&
    medication.frequency == null

  const dispensedBy =
    transaction.recordedBy ?? medication.requestedBy ?? notSpecified

  const generatedLabel = tPdf('footer.generated', {
    date: format(generatedAt, 'PPpp'),
  }) as string

  const pageLabel = tPdf('footer.page', {
    page: '{{page}}',
    total: '{{total}}',
  }) as string

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader
          orgName={orgName || noOrgName}
          title={tPdf('pharmacy.title') as string}
        />

        {/* Receipt meta line */}
        <View style={localStyles.metaRow}>
          <View style={localStyles.metaItem}>
            <Text style={localStyles.metaLabel}>{tPdf('pharmacy.receiptNumber') as string}</Text>
            <Text style={localStyles.metaValue}>{receiptNumber}</Text>
          </View>
          <View style={localStyles.metaItem}>
            <Text style={localStyles.metaLabel}>{tPdf('pharmacy.fields.dispensedAt') as string}</Text>
            <Text style={localStyles.metaValue}>{dispensedAt}</Text>
          </View>
        </View>

        {/* Patient block */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionHeading}>
            {tPdf('pharmacy.sections.patient') as string}
          </Text>
          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{tPdf('pharmacy.fields.patient') as string}</Text>
            <Text style={pdfStyles.fieldValue}>{patientName}</Text>
          </View>
          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{tPdf('pharmacy.fields.mrn') as string}</Text>
            <Text style={pdfStyles.fieldValue}>{mrn}</Text>
          </View>
        </View>

        {/* Medication block */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionHeading}>
            {tPdf('pharmacy.sections.medication') as string}
          </Text>
          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{tPdf('pharmacy.fields.item') as string}</Text>
            <Text style={pdfStyles.fieldValue}>{inventoryItem.name}</Text>
          </View>
          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{tPdf('pharmacy.fields.quantity') as string}</Text>
            <Text style={pdfStyles.fieldValue}>
              {transaction.quantity.toString()} {inventoryItem.unit}
            </Text>
          </View>
        </View>

        {/* Directions block */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionHeading}>
            {tPdf('pharmacy.sections.directions') as string}
          </Text>
          {allDirectionsNull ? (
            <Text style={pdfStyles.muted}>{tPdf('pharmacy.empty.directions') as string}</Text>
          ) : (
            <>
              <View style={pdfStyles.fieldRow}>
                <Text style={pdfStyles.fieldLabel}>{tPdf('pharmacy.fields.dosage') as string}</Text>
                <Text style={pdfStyles.fieldValue}>
                  {medication.dosageInstructions ?? notSpecified}
                </Text>
              </View>
              <View style={pdfStyles.fieldRow}>
                <Text style={pdfStyles.fieldLabel}>{tPdf('pharmacy.fields.route') as string}</Text>
                <Text style={pdfStyles.fieldValue}>{medication.route ?? notSpecified}</Text>
              </View>
              <View style={pdfStyles.fieldRow}>
                <Text style={pdfStyles.fieldLabel}>{tPdf('pharmacy.fields.frequency') as string}</Text>
                <Text style={pdfStyles.fieldValue}>{medication.frequency ?? notSpecified}</Text>
              </View>
            </>
          )}
        </View>

        {/* Dispensed-by line */}
        <View style={pdfStyles.section}>
          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{tPdf('pharmacy.fields.dispensedBy') as string}</Text>
            <Text style={pdfStyles.fieldValue}>{dispensedBy}</Text>
          </View>
        </View>

        <PdfFooter generatedLabel={generatedLabel} pageLabel={pageLabel} />
      </Page>
    </Document>
  )
}

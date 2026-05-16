import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'
import i18next from 'i18next'
import type React from 'react'

import { PdfFooter, PdfHeader, pdfStyles, pdfTheme } from '@/lib/pdf'
import type { Imaging, Patient } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImagingReportPdfProps {
  orgName: string
  imaging: Imaging
  patient: Patient | null
  imageDataUrl: string | null
  generatedAt: Date
  locale: string
}

// ---------------------------------------------------------------------------
// Local styles
// ---------------------------------------------------------------------------

const localStyles = StyleSheet.create({
  image: {
    maxHeight: 360,
    objectFit: 'contain',
  },
  emptyText: {
    color: pdfTheme.colors.muted,
    fontStyle: 'italic',
  },
  notesParagraph: {
    marginBottom: pdfTheme.spacing.row,
    color: pdfTheme.colors.text,
  },
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATE_FORMAT = 'MMM d, yyyy h:mm a'

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ImagingReportPdf({
  orgName,
  imaging,
  patient,
  imageDataUrl,
  generatedAt,
  locale,
}: ImagingReportPdfProps): React.JSX.Element {
  const t = i18next.getFixedT(locale, 'pdf')

  const patientName =
    patient != null
      ? `${patient.givenName} ${patient.familyName}`.trim()
      : t('common.unknownPatient')

  const mrn = patient?.mrn ?? '—'

  const requestedOnFormatted = format(parseISO(imaging.requestedOn), DATE_FORMAT)
  const completedOnFormatted =
    imaging.completedOn != null ? format(parseISO(imaging.completedOn), DATE_FORMAT) : null

  const notesParagraphs =
    imaging.notes != null && imaging.notes.trim().length > 0
      ? imaging.notes.split('\n\n').filter((p) => p.trim().length > 0)
      : null

  const generatedLabel = t('footer.generated', {
    date: format(generatedAt, 'PPpp'),
  })

  const pageLabel = t('footer.page', { page: '{{page}}', total: '{{total}}' })

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {/* Header */}
        <PdfHeader
          orgName={orgName || t('common.noOrgName')}
          title={t('imagingReport.title')}
          subtitle={t('imagingReport.subtitle', { type: imaging.type })}
        />

        {/* Patient section */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionHeading}>
            {t('imagingReport.sections.patient')}
          </Text>

          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{t('imagingReport.fields.patient')}</Text>
            <Text style={pdfStyles.fieldValue}>{patientName}</Text>
          </View>

          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{t('imagingReport.fields.mrn')}</Text>
            <Text style={pdfStyles.fieldValue}>{mrn}</Text>
          </View>
        </View>

        {/* Study details section */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionHeading}>
            {t('imagingReport.sections.study')}
          </Text>

          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{t('imagingReport.fields.type')}</Text>
            <Text style={pdfStyles.fieldValue}>{imaging.type}</Text>
          </View>

          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{t('imagingReport.fields.code')}</Text>
            <Text style={pdfStyles.fieldValue}>{imaging.code ?? '—'}</Text>
          </View>

          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{t('imagingReport.fields.status')}</Text>
            <Text style={pdfStyles.fieldValue}>{imaging.status}</Text>
          </View>

          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{t('imagingReport.fields.requestedBy')}</Text>
            <Text style={pdfStyles.fieldValue}>{imaging.requestedBy ?? '—'}</Text>
          </View>

          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{t('imagingReport.fields.requestedOn')}</Text>
            <Text style={pdfStyles.fieldValue}>{requestedOnFormatted}</Text>
          </View>

          {completedOnFormatted != null && (
            <View style={pdfStyles.fieldRow}>
              <Text style={pdfStyles.fieldLabel}>
                {t('imagingReport.fields.completedOn')}
              </Text>
              <Text style={pdfStyles.fieldValue}>{completedOnFormatted}</Text>
            </View>
          )}

          {notesParagraphs != null && (
            <View style={pdfStyles.fieldRow}>
              <Text style={pdfStyles.fieldLabel}>{t('imagingReport.fields.notes')}</Text>
              <View style={pdfStyles.fieldValue}>
                {notesParagraphs.map((paragraph, index) => (
                  <Text key={index} style={localStyles.notesParagraph}>
                    {paragraph}
                  </Text>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Image section */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionHeading}>
            {t('imagingReport.sections.image')}
          </Text>

          {imageDataUrl != null ? (
            <Image src={imageDataUrl} style={localStyles.image} />
          ) : imaging.storagePath != null ? (
            <Text style={localStyles.emptyText}>
              {t('imagingReport.empty.imageUnavailable')}
            </Text>
          ) : (
            <Text style={localStyles.emptyText}>{t('imagingReport.empty.image')}</Text>
          )}
        </View>

        {/* Footer */}
        <PdfFooter generatedLabel={generatedLabel} pageLabel={pageLabel} />
      </Page>
    </Document>
  )
}

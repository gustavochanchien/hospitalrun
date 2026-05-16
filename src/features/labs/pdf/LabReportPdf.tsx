import { Document, Page, Text, View } from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'
import i18next from 'i18next'
import type React from 'react'

import { PdfFooter, PdfHeader, pdfStyles } from '@/lib/pdf'
import type { Lab, Patient } from '@/lib/db/schema'

interface LabReportPdfProps {
  orgName: string
  lab: Lab
  patient: Patient | null
  generatedAt: Date
  locale: string
}

const DATE_FORMAT = 'MMM d, yyyy h:mm a'

export function LabReportPdf({
  orgName,
  lab,
  patient,
  generatedAt,
  locale,
}: LabReportPdfProps): React.JSX.Element {
  const t = i18next.getFixedT(locale, 'pdf')

  const patientName =
    patient != null
      ? `${patient.givenName} ${patient.familyName}`.trim()
      : t('common.unknownPatient')

  const mrn = patient?.mrn ?? '—'

  const requestedAtFormatted = format(parseISO(lab.requestedAt), DATE_FORMAT)
  const completedAtFormatted =
    lab.completedAt != null ? format(parseISO(lab.completedAt), DATE_FORMAT) : null

  const resultParagraphs =
    lab.result != null && lab.result.trim().length > 0
      ? lab.result.split('\n\n').filter((p) => p.trim().length > 0)
      : null

  const generatedLabel = t('footer.generated', {
    date: format(generatedAt, 'PPpp'),
  })

  const pageLabel = t('footer.page', { page: '{{page}}', total: '{{total}}' })

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader
          orgName={orgName || t('common.noOrgName')}
          title={t('labReport.title')}
          subtitle={t('labReport.subtitle', { type: lab.type })}
        />

        {/* Patient section */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionHeading}>{t('labReport.sections.patient')}</Text>

          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{t('labReport.fields.patient')}</Text>
            <Text style={pdfStyles.fieldValue}>{patientName}</Text>
          </View>

          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{t('labReport.fields.mrn')}</Text>
            <Text style={pdfStyles.fieldValue}>{mrn}</Text>
          </View>
        </View>

        {/* Order details section */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionHeading}>{t('labReport.sections.order')}</Text>

          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{t('labReport.fields.type')}</Text>
            <Text style={pdfStyles.fieldValue}>{lab.type}</Text>
          </View>

          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{t('labReport.fields.code')}</Text>
            <Text style={pdfStyles.fieldValue}>{lab.code ?? '—'}</Text>
          </View>

          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{t('labReport.fields.status')}</Text>
            <Text style={pdfStyles.fieldValue}>{lab.status}</Text>
          </View>

          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{t('labReport.fields.requestedBy')}</Text>
            <Text style={pdfStyles.fieldValue}>{lab.requestedBy ?? '—'}</Text>
          </View>

          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>{t('labReport.fields.requestedAt')}</Text>
            <Text style={pdfStyles.fieldValue}>{requestedAtFormatted}</Text>
          </View>

          {completedAtFormatted != null && (
            <View style={pdfStyles.fieldRow}>
              <Text style={pdfStyles.fieldLabel}>{t('labReport.fields.completedAt')}</Text>
              <Text style={pdfStyles.fieldValue}>{completedAtFormatted}</Text>
            </View>
          )}

          {lab.notes != null && lab.notes.trim().length > 0 && (
            <View style={pdfStyles.fieldRow}>
              <Text style={pdfStyles.fieldLabel}>{t('labReport.fields.notes')}</Text>
              <Text style={pdfStyles.fieldValue}>{lab.notes}</Text>
            </View>
          )}
        </View>

        {/* Result section */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionHeading}>{t('labReport.sections.result')}</Text>

          {resultParagraphs != null ? (
            resultParagraphs.map((paragraph, index) => (
              <Text key={index} style={pdfStyles.body}>
                {paragraph}
              </Text>
            ))
          ) : (
            <Text style={pdfStyles.muted}>{t('labReport.empty.result')}</Text>
          )}
        </View>

        <PdfFooter generatedLabel={generatedLabel} pageLabel={pageLabel} />
      </Page>
    </Document>
  )
}

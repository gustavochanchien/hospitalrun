import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'
import i18next from 'i18next'
import type React from 'react'

import { PdfFooter } from '@/lib/pdf/Footer'
import { PdfHeader } from '@/lib/pdf/Header'
import { pdfStyles, pdfTheme } from '@/lib/pdf/theme'
import type { Allergy, Diagnosis, Medication, Patient, Visit } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PatientSummaryPdfProps {
  orgName: string
  patient: Patient
  diagnoses: Diagnosis[]
  medications: Medication[]
  allergies: Allergy[]
  visits: Visit[]
  generatedAt: Date
  locale: string
}

// ---------------------------------------------------------------------------
// Local styles (one-offs not in the shared sheet)
// ---------------------------------------------------------------------------

const localStyles = StyleSheet.create({
  listItemText: {
    flex: 1,
    color: pdfTheme.colors.text,
  },
  listItemSub: {
    fontSize: pdfTheme.fontSizes.small,
    color: pdfTheme.colors.muted,
    marginTop: 1,
  },
  emptyText: {
    color: pdfTheme.colors.muted,
    fontStyle: 'italic',
  },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeStr(value: string | null | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value.trim() : fallback
}

function formatDateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null
  try {
    return format(parseISO(iso), 'MMM d, yyyy')
  } catch {
    return null
  }
}

function formatDatetime(iso: string | null | undefined): string | null {
  if (!iso) return null
  try {
    return format(parseISO(iso), 'MMM d, yyyy, h:mm aa')
  } catch {
    return null
  }
}

function buildPatientName(patient: Patient): string {
  const parts = [
    patient.prefix,
    patient.givenName,
    patient.familyName,
    patient.suffix,
  ].filter((p): p is string => Boolean(p && p.trim()))
  return parts.join(' ')
}

function buildAddress(address: Record<string, string> | null | undefined): string | null {
  if (!address) return null
  const parts = [
    address['street'],
    address['city'],
    address['state'],
    address['zip'],
  ].filter((p): p is string => Boolean(p && p.trim()))
  return parts.length > 0 ? parts.join(', ') : null
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FieldRowProps {
  label: string
  value: string
}

function FieldRow({ label, value }: FieldRowProps) {
  return (
    <View style={pdfStyles.fieldRow}>
      <Text style={pdfStyles.fieldLabel}>{label}</Text>
      <Text style={pdfStyles.fieldValue}>{value}</Text>
    </View>
  )
}

interface SectionProps {
  heading: string
  children: React.ReactNode
}

function Section({ heading, children }: SectionProps) {
  return (
    <View style={pdfStyles.section}>
      <Text style={pdfStyles.sectionHeading}>{heading}</Text>
      {children}
    </View>
  )
}

interface EmptyNoteProps {
  label: string
}

function EmptyNote({ label }: EmptyNoteProps) {
  return <Text style={localStyles.emptyText}>{label}</Text>
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PatientSummaryPdf({
  orgName,
  patient,
  diagnoses,
  medications,
  allergies,
  visits,
  generatedAt,
  locale,
}: PatientSummaryPdfProps): React.JSX.Element {
  const t = i18next.getFixedT(locale, 'pdf')

  const notSpecified = t('common.notSpecified')
  const resolvedOrgName = safeStr(orgName, t('common.noOrgName'))

  // Demographics values
  const patientName = safeStr(buildPatientName(patient), notSpecified)
  const dob = formatDateOnly(patient.dateOfBirth) ?? notSpecified
  const sex = safeStr(patient.sex, notSpecified)
  const bloodType = safeStr(patient.bloodType, notSpecified)
  const phone = safeStr(patient.phone, notSpecified)
  const email = safeStr(patient.email, notSpecified)
  const address = buildAddress(patient.address) ?? notSpecified
  const preferredLanguage = safeStr(patient.preferredLanguage, notSpecified)
  const status = safeStr(patient.status, notSpecified)

  const generatedLabel = t('footer.generated', {
    date: format(generatedAt, 'PPpp'),
  })
  const pageLabel = t('footer.page', { page: '{{page}}', total: '{{total}}' })

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {/* Header */}
        <PdfHeader
          orgName={resolvedOrgName}
          title={t('patientSummary.title')}
          subtitle={t('patientSummary.subtitle', { mrn: patient.mrn ?? '—' })}
        />

        {/* Demographics */}
        <Section heading={t('patientSummary.sections.demographics')}>
          <FieldRow label={t('patientSummary.fields.name')} value={patientName} />
          <FieldRow label={t('patientSummary.fields.dateOfBirth')} value={dob} />
          <FieldRow label={t('patientSummary.fields.sex')} value={sex} />
          <FieldRow label={t('patientSummary.fields.bloodType')} value={bloodType} />
          <FieldRow label={t('patientSummary.fields.phone')} value={phone} />
          <FieldRow label={t('patientSummary.fields.email')} value={email} />
          <FieldRow label={t('patientSummary.fields.address')} value={address} />
          <FieldRow
            label={t('patientSummary.fields.preferredLanguage')}
            value={preferredLanguage}
          />
          <FieldRow label={t('patientSummary.fields.status')} value={status} />
        </Section>

        {/* Active diagnoses */}
        <Section heading={t('patientSummary.sections.diagnoses')}>
          {diagnoses.length === 0 ? (
            <EmptyNote label={t('patientSummary.empty.diagnoses')} />
          ) : (
            diagnoses.map((dx) => (
              <View key={dx.id} style={pdfStyles.listItem}>
                <Text style={pdfStyles.listBullet}>{'•'}</Text>
                <View style={localStyles.listItemText}>
                  <Text>
                    {dx.description}
                    {dx.icdCode ? `  (${dx.icdCode})` : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Section>

        {/* Active medications */}
        <Section heading={t('patientSummary.sections.medications')}>
          {medications.length === 0 ? (
            <EmptyNote label={t('patientSummary.empty.medications')} />
          ) : (
            medications.map((med) => {
              const meta: string[] = []
              if (med.quantity) meta.push(med.quantity)
              if (med.priority) meta.push(med.priority)
              return (
                <View key={med.id} style={pdfStyles.listItem}>
                  <Text style={pdfStyles.listBullet}>{'•'}</Text>
                  <View style={localStyles.listItemText}>
                    <Text>{med.name}</Text>
                    {meta.length > 0 ? (
                      <Text style={localStyles.listItemSub}>{meta.join(' · ')}</Text>
                    ) : null}
                  </View>
                </View>
              )
            })
          )}
        </Section>

        {/* Allergies */}
        <Section heading={t('patientSummary.sections.allergies')}>
          {allergies.length === 0 ? (
            <EmptyNote label={t('patientSummary.empty.allergies')} />
          ) : (
            allergies.map((al) => {
              const meta: string[] = []
              if (al.severity) meta.push(al.severity)
              if (al.reaction) meta.push(al.reaction)
              return (
                <View key={al.id} style={pdfStyles.listItem}>
                  <Text style={pdfStyles.listBullet}>{'•'}</Text>
                  <View style={localStyles.listItemText}>
                    <Text>{al.allergen}</Text>
                    {meta.length > 0 ? (
                      <Text style={localStyles.listItemSub}>{meta.join(' · ')}</Text>
                    ) : null}
                  </View>
                </View>
              )
            })
          )}
        </Section>

        {/* Recent visits */}
        <Section heading={t('patientSummary.sections.visits')}>
          {visits.length === 0 ? (
            <EmptyNote label={t('patientSummary.empty.visits')} />
          ) : (
            visits.map((v) => {
              const visitDate = formatDatetime(v.startDatetime) ?? notSpecified
              const sub: string[] = [visitDate]
              if (v.type) sub.push(v.type)
              if (v.location) sub.push(v.location)
              return (
                <View key={v.id} style={pdfStyles.listItem}>
                  <Text style={pdfStyles.listBullet}>{'•'}</Text>
                  <View style={localStyles.listItemText}>
                    {v.reason ? <Text>{v.reason}</Text> : null}
                    <Text style={localStyles.listItemSub}>{sub.join(' · ')}</Text>
                  </View>
                </View>
              )
            })
          )}
        </Section>

        {/* Footer */}
        <PdfFooter generatedLabel={generatedLabel} pageLabel={pageLabel} />
      </Page>
    </Document>
  )
}

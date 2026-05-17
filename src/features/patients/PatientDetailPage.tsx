import { useMemo, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PdfExportButton } from '@/components/pdf-export-button'
import { PrintButton } from '@/components/print-button'
import { resolveOrgName } from '@/lib/pdf/org'
import { recordAccessEvent } from '@/lib/db/access-log'
import { useAuthStore } from '@/features/auth/auth.store'
import { useLogAccess } from '@/hooks/useLogAccess'
import { db } from '@/lib/db'
import type { AccessResourceType } from '@/lib/db/schema'
import { PatientAppointments } from './sub-features/PatientAppointments'
import { PatientDiagnoses } from './sub-features/PatientDiagnoses'
import { PatientAllergies } from './sub-features/PatientAllergies'
import { PatientMedications } from './sub-features/PatientMedications'
import { PatientLabs } from './sub-features/PatientLabs'
import { PatientImaging } from './sub-features/PatientImaging'
import { PatientNotes } from './sub-features/PatientNotes'
import { PatientVisits } from './sub-features/PatientVisits'
import { PatientRelatedPersons } from './sub-features/PatientRelatedPersons'
import { PatientCareGoals } from './sub-features/PatientCareGoals'
import { PatientCarePlans } from './sub-features/PatientCarePlans'
import { PatientHistory } from './sub-features/PatientHistory'
import { PatientBilling } from './sub-features/PatientBilling'
import { PatientVitals } from './sub-features/PatientVitals'
import { FeatureGate } from '@/components/ui/feature-gate'
import { Link } from '@tanstack/react-router'

interface PatientDetailPageProps {
  patientId: string
}

const TAB_TO_RESOURCE: Record<string, AccessResourceType> = {
  appointments: 'appointment',
  diagnoses: 'diagnosis',
  allergies: 'allergy',
  medications: 'medication',
  labs: 'lab',
  imaging: 'imaging',
  notes: 'note',
  visits: 'visit',
  related: 'related_person',
  goals: 'care_goal',
  plans: 'care_plan',
  vitals: 'vital',
}

export function PatientDetailPage({ patientId }: PatientDetailPageProps) {
  const { t } = useTranslation('patient')
  const orgId = useAuthStore((s) => s.orgId)
  const patient = useLiveQuery(() => db.patients.get(patientId), [patientId])
  const history = useLiveQuery(
    () =>
      db.patientHistory
        .where('patientId')
        .equals(patientId)
        .reverse()
        .sortBy('changedAt'),
    [patientId],
  )
  const lastUpdatedByField = useMemo(() => {
    const map: Record<string, string> = {}
    if (!history) return map
    for (const entry of history) {
      if (!map[entry.fieldName]) map[entry.fieldName] = entry.changedAt
    }
    return map
  }, [history])
  useLogAccess({
    action: 'view',
    resourceType: 'patient',
    resourceId: patientId,
    patientId,
    enabled: !!patient && !patient._deleted,
  })
  const loggedTabs = useRef<Set<string>>(new Set())
  function handleTabChange(value: string) {
    const resource = TAB_TO_RESOURCE[value]
    if (!resource) return
    const key = `${patientId}:${value}`
    if (loggedTabs.current.has(key)) return
    loggedTabs.current.add(key)
    void recordAccessEvent({
      action: 'view',
      resourceType: resource,
      patientId,
      context: { tab: value, parentPatientId: patientId },
    })
  }
  const tabTriggerClass =
    'h-auto rounded-full px-4 py-2 text-sm font-medium border border-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-primary/30 dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground dark:data-[state=active]:border-transparent'

  if (patient === undefined) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!patient || patient._deleted) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <p className="text-muted-foreground">{t('detail.notFound')}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/patients">{t('detail.backToPatients')}</Link>
        </Button>
      </div>
    )
  }

  const statusKey =
    patient.status === 'active' || patient.status === 'inactive' || patient.status === 'deceased'
      ? (`status.${patient.status}` as 'status.active' | 'status.inactive' | 'status.deceased')
      : null

  return (
    <div className="space-y-6 p-6">
      {/* Demographics Card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-xl">
              {patient.prefix ? `${patient.prefix} ` : ''}
              {patient.givenName} {patient.familyName}
              {patient.suffix ? ` ${patient.suffix}` : ''}
            </CardTitle>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              {patient.mrn && <span>{t('detail.mrnLabel', { mrn: patient.mrn })}</span>}
              {patient.sex && (
                <span>
                  {patient.sex === 'male' || patient.sex === 'female' || patient.sex === 'other' || patient.sex === 'unknown'
                    ? t(`sex.${patient.sex}` as 'sex.male' | 'sex.female' | 'sex.other' | 'sex.unknown')
                    : patient.sex}
                </span>
              )}
              {patient.dateOfBirth && (
                <span>
                  {t('detail.dobLabel', {
                    date: format(parseISO(patient.dateOfBirth), 'MMM d, yyyy'),
                  })}
                </span>
              )}
              {patient.bloodType && (
                <span>{t('detail.bloodTypeLabel', { type: patient.bloodType })}</span>
              )}
              {patient.maritalStatus && (
                <span>
                  {t(`maritalStatus.${patient.maritalStatus}` as 'maritalStatus.single' | 'maritalStatus.partnered' | 'maritalStatus.married' | 'maritalStatus.separated' | 'maritalStatus.divorced' | 'maritalStatus.widowed')}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                patient.status === 'active'
                  ? 'default'
                  : patient.status === 'deceased'
                    ? 'destructive'
                    : 'secondary'
              }
            >
              {statusKey ? t(statusKey) : patient.status}
            </Badge>
            {patient.isHeadOfHousehold && (
              <Badge variant="secondary">{t('detail.headOfHousehold')}</Badge>
            )}
            <span data-print-actions className="flex flex-wrap items-center gap-2">
              <PdfExportButton
                filename={`patient-${patient.familyName.toLowerCase()}-summary`}
                onBeforeGenerate={() =>
                  void recordAccessEvent({
                    action: 'export',
                    resourceType: 'patient',
                    resourceId: patientId,
                    patientId,
                    context: { format: 'pdf', document: 'patient-summary' },
                  })
                }
                buildDocument={async () => {
                  const orgName = await resolveOrgName(orgId)
                  const [diagnoses, medications, allergies, visits] = await Promise.all([
                    db.diagnoses
                      .where({ patientId })
                      .filter((d) => !d._deleted && d.status !== 'inactive' && d.status !== 'resolved')
                      .toArray(),
                    db.medications
                      .where({ patientId })
                      .filter((m) => !m._deleted && (m.status === 'active' || m.status === 'draft'))
                      .toArray(),
                    db.allergies
                      .where({ patientId })
                      .filter((a) => !a._deleted)
                      .toArray(),
                    db.visits
                      .where({ patientId })
                      .filter((v) => !v._deleted)
                      .reverse()
                      .sortBy('startDatetime'),
                  ])
                  const recentVisits = visits.slice(0, 5)
                  const { PatientSummaryPdf } = await import('./pdf/PatientSummaryPdf')
                  return (
                    <PatientSummaryPdf
                      orgName={orgName}
                      patient={patient}
                      diagnoses={diagnoses}
                      medications={medications}
                      allergies={allergies}
                      visits={recentVisits}
                      generatedAt={new Date()}
                      locale={i18n.language}
                    />
                  )
                }}
              />
              <PrintButton
                onBeforePrint={() =>
                  void recordAccessEvent({
                    action: 'print',
                    resourceType: 'patient',
                    resourceId: patientId,
                    patientId,
                  })
                }
              />
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link
                to="/patients/$patientId"
                params={{ patientId }}
                search={{ edit: true }}
              >
                {t('detail.edit')}
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <FieldRow label={t('fields.phone')} value={patient.phone} updatedAt={lastUpdatedByField.phone} />
            <FieldRow label={t('fields.email')} value={patient.email} updatedAt={lastUpdatedByField.email} />
            <FieldRow label={t('fields.occupation')} value={patient.occupation} updatedAt={lastUpdatedByField.occupation} />
            <FieldRow label={t('detail.language')} value={patient.preferredLanguage} updatedAt={lastUpdatedByField.preferredLanguage} />
            {patient.educationLevel && (
              <FieldRow
                label={t('fields.educationLevel')}
                value={t(`educationLevel.${patient.educationLevel}` as 'educationLevel.none' | 'educationLevel.primary' | 'educationLevel.secondary' | 'educationLevel.tertiary' | 'educationLevel.unknown')}
                updatedAt={lastUpdatedByField.educationLevel}
               
              />
            )}
            {patient.nationalId && (
              <FieldRow
                label={t('fields.nationalId')}
                value={patient.nationalIdType ? `${patient.nationalIdType}: ${patient.nationalId}` : patient.nationalId}
                updatedAt={lastUpdatedByField.nationalId ?? lastUpdatedByField.nationalIdType}
               
              />
            )}
            {patient.numberOfChildren != null && (
              <FieldRow
                label={t('fields.numberOfChildren')}
                value={String(patient.numberOfChildren)}
                updatedAt={lastUpdatedByField.numberOfChildren}
               
              />
            )}
            {patient.numberOfHouseholdMembers != null && (
              <FieldRow
                label={t('fields.numberOfHouseholdMembers')}
                value={String(patient.numberOfHouseholdMembers)}
                updatedAt={lastUpdatedByField.numberOfHouseholdMembers}
               
              />
            )}
            {patient.address && (
              <FieldRow
                label={t('fields.address')}
                value={
                  [
                    patient.address.street,
                    patient.address.city,
                    patient.address.state,
                    patient.address.zip,
                  ]
                    .filter(Boolean)
                    .join(', ') || null
                }
                updatedAt={lastUpdatedByField.address}
               
                className="sm:col-span-2"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sub-feature Tabs */}
      <Tabs defaultValue="appointments" onValueChange={handleTabChange}>
        <TabsList className="flex flex-wrap group-data-horizontal/tabs:h-auto gap-2 rounded-full bg-muted/50 p-2">
          <TabsTrigger value="all" className={tabTriggerClass}>{t('tabs.all')}</TabsTrigger>
          <TabsTrigger value="appointments" className={tabTriggerClass}>{t('tabs.appointments')}</TabsTrigger>
          <TabsTrigger value="diagnoses" className={tabTriggerClass}>{t('tabs.diagnoses')}</TabsTrigger>
          <TabsTrigger value="allergies" className={tabTriggerClass}>{t('tabs.allergies')}</TabsTrigger>
          <TabsTrigger value="medications" className={tabTriggerClass}>{t('tabs.medications')}</TabsTrigger>
          <TabsTrigger value="labs" className={tabTriggerClass}>{t('tabs.labs')}</TabsTrigger>
          <TabsTrigger value="imaging" className={tabTriggerClass}>{t('tabs.imaging')}</TabsTrigger>
          <TabsTrigger value="notes" className={tabTriggerClass}>{t('tabs.notes')}</TabsTrigger>
          <TabsTrigger value="visits" className={tabTriggerClass}>{t('tabs.visits')}</TabsTrigger>
          <TabsTrigger value="related" className={tabTriggerClass}>{t('tabs.relatedPersons')}</TabsTrigger>
          <TabsTrigger value="goals" className={tabTriggerClass}>{t('tabs.careGoals')}</TabsTrigger>
          <TabsTrigger value="plans" className={tabTriggerClass}>{t('tabs.carePlans')}</TabsTrigger>
          <TabsTrigger value="history" className={tabTriggerClass}>{t('tabs.history')}</TabsTrigger>
          <FeatureGate feature="billing">
            <TabsTrigger value="billing" className={tabTriggerClass}>{t('tabs.billing')}</TabsTrigger>
          </FeatureGate>
          <FeatureGate feature="vitals">
            <TabsTrigger value="vitals" className={tabTriggerClass}>{t('tabs.vitals')}</TabsTrigger>
          </FeatureGate>
        </TabsList>

        <TabsContent value="all">
          <PatientAllView patientId={patientId} />
        </TabsContent>
        <TabsContent value="appointments">
          <PatientAppointments patientId={patientId} />
        </TabsContent>
        <TabsContent value="diagnoses">
          <PatientDiagnoses patientId={patientId} />
        </TabsContent>
        <TabsContent value="allergies">
          <PatientAllergies patientId={patientId} />
        </TabsContent>
        <TabsContent value="medications">
          <PatientMedications patientId={patientId} />
        </TabsContent>
        <TabsContent value="labs">
          <PatientLabs patientId={patientId} />
        </TabsContent>
        <TabsContent value="imaging">
          <PatientImaging patientId={patientId} />
        </TabsContent>
        <TabsContent value="notes">
          <PatientNotes patientId={patientId} />
        </TabsContent>
        <TabsContent value="visits">
          <PatientVisits patientId={patientId} />
        </TabsContent>
        <TabsContent value="related">
          <PatientRelatedPersons patientId={patientId} />
        </TabsContent>
        <TabsContent value="goals">
          <PatientCareGoals patientId={patientId} />
        </TabsContent>
        <TabsContent value="plans">
          <PatientCarePlans patientId={patientId} />
        </TabsContent>
        <TabsContent value="history">
          <PatientHistory patientId={patientId} />
        </TabsContent>
        <TabsContent value="billing">
          <PatientBilling patientId={patientId} />
        </TabsContent>
        <TabsContent value="vitals">
          <PatientVitals patientId={patientId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface FieldRowProps {
  label: string
  value: string | null | undefined
  updatedAt: string | undefined
  className?: string
}

function FieldRow({ label, value, updatedAt, className }: FieldRowProps) {
  const { t } = useTranslation('patient')
  return (
    <div className={className}>
      <p className="font-medium text-muted-foreground">{label}</p>
      <p>{value || '—'}</p>
      {updatedAt && (
        <p className="mt-0.5 text-xs text-muted-foreground/70">
          {t('detail.lastUpdated', {
            relative: formatDistanceToNow(parseISO(updatedAt), { addSuffix: true }),
          })}
        </p>
      )}
    </div>
  )
}

interface PatientAllViewProps {
  patientId: string
}

function PatientAllView({ patientId }: PatientAllViewProps) {
  return (
    <div className="space-y-8">
      <section><PatientAllergies patientId={patientId} /></section>
      <section><PatientDiagnoses patientId={patientId} /></section>
      <section><PatientMedications patientId={patientId} /></section>
      <section><PatientCarePlans patientId={patientId} /></section>
      <section><PatientCareGoals patientId={patientId} /></section>
      <section><PatientVisits patientId={patientId} /></section>
      <section><PatientAppointments patientId={patientId} /></section>
      <section><PatientLabs patientId={patientId} /></section>
      <section><PatientImaging patientId={patientId} /></section>
      <section><PatientNotes patientId={patientId} /></section>
      <section><PatientHistory patientId={patientId} /></section>
      <section><PatientRelatedPersons patientId={patientId} /></section>
      <FeatureGate feature="billing">
        <section><PatientBilling patientId={patientId} /></section>
      </FeatureGate>
      <FeatureGate feature="vitals">
        <section><PatientVitals patientId={patientId} /></section>
      </FeatureGate>
    </div>
  )
}

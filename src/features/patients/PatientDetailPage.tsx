import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { format, parseISO } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PdfExportButton } from '@/components/pdf-export-button'
import { PrintButton } from '@/components/print-button'
import { resolveOrgName } from '@/lib/pdf/org'
import { useAuthStore } from '@/features/auth/auth.store'
import { db } from '@/lib/db'
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
import { Link } from '@tanstack/react-router'

interface PatientDetailPageProps {
  patientId: string
}

export function PatientDetailPage({ patientId }: PatientDetailPageProps) {
  const { t } = useTranslation('patient')
  const orgId = useAuthStore((s) => s.orgId)
  const patient = useLiveQuery(() => db.patients.get(patientId), [patientId])

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
            <span data-print-actions className="flex flex-wrap items-center gap-2">
              <PdfExportButton
                filename={`patient-${patient.familyName.toLowerCase()}-summary`}
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
              <PrintButton />
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
            <div>
              <p className="font-medium text-muted-foreground">{t('fields.phone')}</p>
              <p>{patient.phone ?? '—'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">{t('fields.email')}</p>
              <p>{patient.email ?? '—'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">{t('fields.occupation')}</p>
              <p>{patient.occupation ?? '—'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">{t('detail.language')}</p>
              <p>{patient.preferredLanguage ?? '—'}</p>
            </div>
            {patient.address && (
              <div className="sm:col-span-2">
                <p className="font-medium text-muted-foreground">{t('fields.address')}</p>
                <p>
                  {[
                    patient.address.street,
                    patient.address.city,
                    patient.address.state,
                    patient.address.zip,
                  ]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sub-feature Tabs */}
      <Tabs defaultValue="appointments">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="appointments">{t('tabs.appointments')}</TabsTrigger>
          <TabsTrigger value="diagnoses">{t('tabs.diagnoses')}</TabsTrigger>
          <TabsTrigger value="allergies">{t('tabs.allergies')}</TabsTrigger>
          <TabsTrigger value="medications">{t('tabs.medications')}</TabsTrigger>
          <TabsTrigger value="labs">{t('tabs.labs')}</TabsTrigger>
          <TabsTrigger value="imaging">{t('tabs.imaging')}</TabsTrigger>
          <TabsTrigger value="notes">{t('tabs.notes')}</TabsTrigger>
          <TabsTrigger value="visits">{t('tabs.visits')}</TabsTrigger>
          <TabsTrigger value="related">{t('tabs.relatedPersons')}</TabsTrigger>
          <TabsTrigger value="goals">{t('tabs.careGoals')}</TabsTrigger>
          <TabsTrigger value="plans">{t('tabs.carePlans')}</TabsTrigger>
          <TabsTrigger value="history">{t('tabs.history')}</TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  )
}

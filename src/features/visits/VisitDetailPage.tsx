import { Link } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { db } from '@/lib/db'
import { useLogAccess } from '@/hooks/useLogAccess'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PatientDiagnoses } from '@/features/patients/sub-features/PatientDiagnoses'
import { PatientLabs } from '@/features/patients/sub-features/PatientLabs'
import { PatientMedications } from '@/features/patients/sub-features/PatientMedications'
import { PatientImaging } from '@/features/patients/sub-features/PatientImaging'
import { PatientNotes } from '@/features/patients/sub-features/PatientNotes'

interface VisitDetailPageProps {
  visitId: string
}

export function VisitDetailPage({ visitId }: VisitDetailPageProps) {
  const { t } = useTranslation('patient')
  const visit = useLiveQuery(() => db.visits.get(visitId), [visitId])
  const patient = useLiveQuery(
    () => (visit?.patientId ? db.patients.get(visit.patientId) : undefined),
    [visit?.patientId],
  )
  useLogAccess({
    action: 'view',
    resourceType: 'visit',
    resourceId: visitId,
    patientId: visit?.patientId,
    enabled: !!visit && !visit._deleted,
  })

  if (visit === undefined) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!visit || visit._deleted) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <p className="text-muted-foreground">{t('subFeatures.visits.notFound')}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/patients">{t('subFeatures.visits.backToPatients')}</Link>
        </Button>
      </div>
    )
  }

  const patientName = patient
    ? `${patient.givenName} ${patient.familyName}`
    : t('subFeatures.visits.patientFallback')

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">
              {visit.type ?? 'Visit'}{' '}
              <Badge variant="secondary" className="ml-2 align-middle">
                {visit.status}
              </Badge>
            </CardTitle>
            {patient && (
              <p className="text-sm text-muted-foreground">
                <Link
                  to="/patients/$patientId"
                  params={{ patientId: visit.patientId }}
                  className="text-primary hover:underline"
                >
                  {patientName}
                </Link>
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground">{t('subFeatures.visits.fields.start')}</p>
            <p>
              {visit.startDatetime
                ? format(parseISO(visit.startDatetime), 'MMM d, yyyy h:mm a')
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">{t('subFeatures.visits.fields.end')}</p>
            <p>
              {visit.endDatetime
                ? format(parseISO(visit.endDatetime), 'MMM d, yyyy h:mm a')
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">{t('subFeatures.visits.fields.location')}</p>
            <p>{visit.location ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">{t('subFeatures.visits.fields.reason')}</p>
            <p>{visit.reason ?? '—'}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="diagnoses">
        <TabsList>
          <TabsTrigger value="diagnoses">{t('subFeatures.visits.tabs.diagnoses')}</TabsTrigger>
          <TabsTrigger value="labs">{t('subFeatures.visits.tabs.labs')}</TabsTrigger>
          <TabsTrigger value="medications">{t('subFeatures.visits.tabs.medications')}</TabsTrigger>
          <TabsTrigger value="imaging">{t('subFeatures.visits.tabs.imaging')}</TabsTrigger>
          <TabsTrigger value="notes">{t('subFeatures.visits.tabs.notes')}</TabsTrigger>
        </TabsList>
        <TabsContent value="diagnoses" className="pt-4">
          <PatientDiagnoses patientId={visit.patientId} visitId={visitId} />
        </TabsContent>
        <TabsContent value="labs" className="pt-4">
          <PatientLabs patientId={visit.patientId} visitId={visitId} />
        </TabsContent>
        <TabsContent value="medications" className="pt-4">
          <PatientMedications patientId={visit.patientId} visitId={visitId} />
        </TabsContent>
        <TabsContent value="imaging" className="pt-4">
          <PatientImaging patientId={visit.patientId} visitId={visitId} />
        </TabsContent>
        <TabsContent value="notes" className="pt-4">
          <PatientNotes patientId={visit.patientId} visitId={visitId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

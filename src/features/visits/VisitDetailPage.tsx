import { Link } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { db } from '@/lib/db'
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
  const visit = useLiveQuery(() => db.visits.get(visitId), [visitId])
  const patient = useLiveQuery(
    () => (visit?.patientId ? db.patients.get(visit.patientId) : undefined),
    [visit?.patientId],
  )

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
        <p className="text-muted-foreground">Visit not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/patients">Back to Patients</Link>
        </Button>
      </div>
    )
  }

  const patientName = patient
    ? `${patient.givenName} ${patient.familyName}`
    : 'Patient'

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
            <p className="text-xs uppercase text-muted-foreground">Start</p>
            <p>
              {visit.startDatetime
                ? format(parseISO(visit.startDatetime), 'MMM d, yyyy h:mm a')
                : '\u2014'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">End</p>
            <p>
              {visit.endDatetime
                ? format(parseISO(visit.endDatetime), 'MMM d, yyyy h:mm a')
                : '\u2014'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Location</p>
            <p>{visit.location ?? '\u2014'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Reason</p>
            <p>{visit.reason ?? '\u2014'}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="diagnoses">
        <TabsList>
          <TabsTrigger value="diagnoses">Diagnoses</TabsTrigger>
          <TabsTrigger value="labs">Labs</TabsTrigger>
          <TabsTrigger value="medications">Medications</TabsTrigger>
          <TabsTrigger value="imaging">Imaging</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
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

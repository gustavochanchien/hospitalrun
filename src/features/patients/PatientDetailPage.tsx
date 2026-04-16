import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
        <p className="text-muted-foreground">Patient not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/patients">Back to Patients</Link>
        </Button>
      </div>
    )
  }

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
              {patient.mrn && <span>MRN: {patient.mrn}</span>}
              {patient.sex && (
                <span className="capitalize">{patient.sex}</span>
              )}
              {patient.dateOfBirth && (
                <span>
                  DOB: {format(parseISO(patient.dateOfBirth), 'MMM d, yyyy')}
                </span>
              )}
              {patient.bloodType && (
                <span>Blood Type: {patient.bloodType}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                patient.status === 'active'
                  ? 'default'
                  : patient.status === 'deceased'
                    ? 'destructive'
                    : 'secondary'
              }
            >
              {patient.status}
            </Badge>
            <Button variant="outline" size="sm" asChild>
              <Link
                to="/patients/$patientId"
                params={{ patientId }}
                search={{ edit: true }}
              >
                Edit
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="font-medium text-muted-foreground">Phone</p>
              <p>{patient.phone ?? '\u2014'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Email</p>
              <p>{patient.email ?? '\u2014'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Occupation</p>
              <p>{patient.occupation ?? '\u2014'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Language</p>
              <p>{patient.preferredLanguage ?? '\u2014'}</p>
            </div>
            {patient.address && (
              <div className="sm:col-span-2">
                <p className="font-medium text-muted-foreground">Address</p>
                <p>
                  {[
                    patient.address.street,
                    patient.address.city,
                    patient.address.state,
                    patient.address.zip,
                  ]
                    .filter(Boolean)
                    .join(', ') || '\u2014'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sub-feature Tabs */}
      <Tabs defaultValue="appointments">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="diagnoses">Diagnoses</TabsTrigger>
          <TabsTrigger value="allergies">Allergies</TabsTrigger>
          <TabsTrigger value="medications">Medications</TabsTrigger>
          <TabsTrigger value="labs">Labs</TabsTrigger>
          <TabsTrigger value="imaging">Imaging</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="visits">Visits</TabsTrigger>
          <TabsTrigger value="related">Related Persons</TabsTrigger>
          <TabsTrigger value="goals">Care Goals</TabsTrigger>
          <TabsTrigger value="plans">Care Plans</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
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

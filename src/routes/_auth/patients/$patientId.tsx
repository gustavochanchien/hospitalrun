import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { PatientDetailPage } from '@/features/patients/PatientDetailPage'
import { PatientForm } from '@/features/patients/PatientForm'
import {
  diffPatientFields,
  formToPatientFields,
} from '@/features/patients/patient-payload'
import { db } from '@/lib/db'
import { dbPut, recordPatientHistory } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import type { PatientFormValues } from '@/features/patients/patient.schema'

interface PatientSearch {
  edit?: boolean
}

export const Route = createFileRoute('/_auth/patients/$patientId')({
  component: PatientDetailRoute,
  validateSearch: (search: Record<string, unknown>): PatientSearch => ({
    edit: search.edit === true,
  }),
})

function PatientDetailRoute() {
  const { patientId } = Route.useParams()
  const { edit } = Route.useSearch()
  const navigate = Route.useNavigate()
  const patient = useLiveQuery(() => db.patients.get(patientId), [patientId])

  if (edit && patient && !patient._deleted) {
    return (
      <>
        <PageHeader
          title="Edit Patient"
          breadcrumbs={[
            { label: 'Patients', to: '/patients' },
            {
              label: `${patient.givenName} ${patient.familyName}`,
              to: `/patients/${patientId}`,
            },
            { label: 'Edit' },
          ]}
        />
        <div className="p-6">
          <PatientForm
            patient={patient}
            defaultValues={{
              prefix: patient.prefix ?? '',
              givenName: patient.givenName,
              familyName: patient.familyName,
              suffix: patient.suffix ?? '',
              dateOfBirth: patient.dateOfBirth ?? '',
              sex: patient.sex ?? undefined,
              bloodType: (patient.bloodType as import('@/features/patients/patient.schema').PatientFormValues['bloodType']) ?? undefined,
              maritalStatus: patient.maritalStatus ?? null,
              educationLevel: patient.educationLevel ?? null,
              nationalId: patient.nationalId ?? '',
              nationalIdType: patient.nationalIdType ?? '',
              numberOfChildren: patient.numberOfChildren != null ? String(patient.numberOfChildren) : '',
              numberOfHouseholdMembers: patient.numberOfHouseholdMembers != null ? String(patient.numberOfHouseholdMembers) : '',
              isHeadOfHousehold: patient.isHeadOfHousehold ?? false,
              occupation: patient.occupation ?? '',
              preferredLanguage: patient.preferredLanguage ?? '',
              phone: patient.phone ?? '',
              email: patient.email ?? '',
              address: (patient.address as { street?: string; city?: string; state?: string; zip?: string }) ?? {
                street: '',
                city: '',
                state: '',
                zip: '',
              },
            }}
            onSubmit={async (data: PatientFormValues) => {
              const nextPatient = {
                ...patient,
                ...formToPatientFields(data),
              }
              const changes = diffPatientFields(patient, nextPatient)
              await dbPut('patients', nextPatient, 'update')
              if (changes.length > 0) {
                const userId = useAuthStore.getState().user?.id ?? null
                await recordPatientHistory({
                  orgId: patient.orgId,
                  patientId,
                  changedBy: userId,
                  changes,
                })
              }
              toast.success('Patient updated')
              await navigate({ search: { edit: undefined } })
            }}
          />
        </div>
      </>
    )
  }

  const name = patient ? `${patient.givenName} ${patient.familyName}` : patientId

  return (
    <>
      <PageHeader
        title={name}
        breadcrumbs={[
          { label: 'Patients', to: '/patients' },
          { label: name },
        ]}
      />
      <PatientDetailPage patientId={patientId} />
    </>
  )
}

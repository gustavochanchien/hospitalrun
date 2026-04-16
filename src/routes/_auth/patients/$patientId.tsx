import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { PatientDetailPage } from '@/features/patients/PatientDetailPage'
import { PatientForm } from '@/features/patients/PatientForm'
import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
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
              await dbPut(
                'patients',
                {
                  ...patient,
                  prefix: data.prefix || null,
                  givenName: data.givenName,
                  familyName: data.familyName,
                  suffix: data.suffix || null,
                  dateOfBirth: data.dateOfBirth || null,
                  sex: data.sex ?? null,
                  bloodType: data.bloodType || null,
                  occupation: data.occupation || null,
                  preferredLanguage: data.preferredLanguage || null,
                  phone: data.phone || null,
                  email: data.email || null,
                  address: data.address ?? null,
                },
                'update',
              )
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

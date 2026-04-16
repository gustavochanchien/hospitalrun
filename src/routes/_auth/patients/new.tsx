import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { PatientForm } from '@/features/patients/PatientForm'
import { DuplicatePatientDialog } from '@/features/patients/DuplicatePatientDialog'
import { dbPut } from '@/lib/db/write'
import { generateCode } from '@/lib/db/code-generator'
import { useAuthStore } from '@/features/auth/auth.store'
import type { PatientFormValues } from '@/features/patients/patient.schema'

export const Route = createFileRoute('/_auth/patients/new')({
  component: NewPatientPage,
})

function NewPatientPage() {
  const navigate = useNavigate()
  const [pendingData, setPendingData] = useState<PatientFormValues | null>(null)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)

  async function createPatient(data: PatientFormValues) {
    const orgId = useAuthStore.getState().orgId ?? ''
    const id = crypto.randomUUID()
    const mrn = await generateCode('P', orgId)

    await dbPut(
      'patients',
      {
        id,
        orgId,
        mrn,
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
        status: 'active' as const,
        deletedAt: null,
        createdAt: '',
        updatedAt: '',
        _synced: false,
        _deleted: false,
      },
      'insert',
    )

    toast.success('Patient created')
    await navigate({ to: '/patients/$patientId', params: { patientId: id } })
  }

  async function handleSubmit(data: PatientFormValues) {
    setPendingData(data)
    setShowDuplicateDialog(true)
  }

  return (
    <>
      <PageHeader
        title="New Patient"
        breadcrumbs={[
          { label: 'Patients', to: '/patients' },
          { label: 'New Patient' },
        ]}
      />
      <div className="p-6">
        <PatientForm onSubmit={handleSubmit} />
      </div>
      {pendingData && (
        <DuplicatePatientDialog
          open={showDuplicateDialog}
          onOpenChange={(open) => {
            setShowDuplicateDialog(open)
            if (!open) setPendingData(null)
          }}
          givenName={pendingData.givenName}
          familyName={pendingData.familyName}
          onConfirm={() => {
            setShowDuplicateDialog(false)
            if (pendingData) void createPatient(pendingData)
          }}
        />
      )}
    </>
  )
}

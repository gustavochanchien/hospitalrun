import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { IncidentForm } from '@/features/incidents/IncidentForm'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import type { IncidentFormValues } from '@/features/incidents/incident.schema'

export const Route = createFileRoute('/_auth/incidents/new')({
  component: NewIncidentPage,
})

function NewIncidentPage() {
  const navigate = useNavigate()

  async function handleSubmit(data: IncidentFormValues) {
    const orgId = useAuthStore.getState().orgId ?? ''
    const user = useAuthStore.getState().user
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await dbPut(
      'incidents',
      {
        id,
        orgId,
        reportedBy: user?.user_metadata?.full_name as string | null ?? null,
        reportedOn: now,
        patientId: data.patientId || null,
        department: data.department || null,
        category: data.category || null,
        categoryItem: data.categoryItem || null,
        description: data.description,
        status: 'reported' as const,
        resolvedOn: null,
        deletedAt: null,
        createdAt: '',
        updatedAt: '',
        _synced: false,
        _deleted: false,
      },
      'insert',
    )

    toast.success('Incident reported')
    await navigate({
      to: '/incidents/$incidentId',
      params: { incidentId: id },
    })
  }

  return (
    <>
      <PageHeader
        title="Report Incident"
        breadcrumbs={[
          { label: 'Incidents', to: '/incidents' },
          { label: 'Report Incident' },
        ]}
      />
      <div className="p-6">
        <IncidentForm onSubmit={handleSubmit} />
      </div>
    </>
  )
}

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { LabForm } from '@/features/labs/LabForm'
import { dbPut } from '@/lib/db/write'
import { generateCode } from '@/lib/db/code-generator'
import { useAuthStore } from '@/features/auth/auth.store'
import type { LabFormValues } from '@/features/labs/lab.schema'

export const Route = createFileRoute('/_auth/labs/new')({
  component: NewLabPage,
})

function NewLabPage() {
  const navigate = useNavigate()

  async function handleSubmit(data: LabFormValues) {
    const orgId = useAuthStore.getState().orgId ?? ''
    const id = crypto.randomUUID()
    const code = data.code || (await generateCode('L', orgId))

    await dbPut(
      'labs',
      {
        id,
        orgId,
        patientId: data.patientId,
        visitId: null,
        code,
        type: data.type,
        status: 'requested' as const,
        requestedBy: useAuthStore.getState().user?.email ?? null,
        requestedAt: new Date().toISOString(),
        completedAt: null,
        canceledAt: null,
        result: null,
        notes: data.notes || null,
        deletedAt: null,
        createdAt: '',
        updatedAt: '',
        _synced: false,
        _deleted: false,
      },
      'insert',
    )

    toast.success('Lab requested')
    await navigate({ to: '/labs/$labId', params: { labId: id } })
  }

  return (
    <>
      <PageHeader
        title="New Lab"
        breadcrumbs={[
          { label: 'Labs', to: '/labs' },
          { label: 'New Lab' },
        ]}
      />
      <div className="p-6">
        <LabForm onSubmit={handleSubmit} />
      </div>
    </>
  )
}
